import type { LLMProvider, Msg, StreamCallbacks } from "./index.js";
import { spawn } from "node:child_process";

const DEBUG = process.env.DEBUG === "true";

function flattenMessages(messages: Msg[]): string {
  // The Claude CLI expects a single prompt, not role-prefixed messages
  // We'll combine system and user messages into a coherent prompt
  const systemMessages = messages.filter((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role === "user");

  if (DEBUG) {
    console.error("\n=== DEBUG: flattenMessages ===");
    console.error("Total messages:", messages.length);
    console.error("System messages:", systemMessages.length);
    console.error("User messages:", userMessages.length);
    messages.forEach((m, i) => {
      console.error(
        `Message ${i} [${m.role}]: ${m.content.substring(0, 100)}...`
      );
    });
  }

  let prompt = "";

  // Add system context if present
  if (systemMessages.length > 0) {
    prompt += systemMessages.map((m) => m.content).join("\n\n");
    prompt += "\n\n";
  }

  // Add user messages
  if (userMessages.length > 0) {
    prompt += userMessages.map((m) => m.content).join("\n\n");
  }

  const result = prompt.trim();

  if (DEBUG) {
    console.error("Final prompt length:", result.length);
    console.error("First 200 chars:", result.substring(0, 200));
    console.error(
      "Last 200 chars:",
      result.substring(Math.max(0, result.length - 200))
    );
    console.error("==============================\n");
  }

  return result;
}

// Streaming message types
interface StreamMessage {
  type: "system" | "assistant" | "user" | "result";
  subtype?: "init" | "success" | "error";
  message?: {
    content?: Array<{
      type: "text" | "tool_use" | "tool_result";
      text?: string;
      name?: string;
      input?: any;
      tool_use_id?: string;
      is_error?: boolean;
    }>;
  };
  result?: string;
  is_error?: boolean;
  total_cost_usd?: number;
  duration_ms?: number;
  session_id?: string;
}

async function runClaudeCLI(
  cwd: string,
  prompt: string,
  mode: "plan" | "default" | "acceptEdits",
  allowedTools?: string[],
  sessionId?: string,
  model?: string,
  isInitialized?: boolean,
  callbacks?: StreamCallbacks
): Promise<string | undefined> {
  // Build args for streaming
  const args = ["-p", "--permission-mode", mode, "--output-format", "stream-json", "--verbose"];

  if (model) {
    args.push("--model", model);
  }

  if (allowedTools && allowedTools.length > 0) {
    args.push("--allowedTools", ...allowedTools);
  }

  // Handle session continuity
  if (isInitialized && sessionId) {
    args.push("--resume", sessionId);
  } else if (sessionId) {
    args.push("--session-id", sessionId);
  }

  if (DEBUG) {
    console.error("\n=== DEBUG: runClaudeCLI (streaming) ===");
    console.error("CWD:", cwd);
    console.error("Mode:", mode);
    console.error("Allowed tools:", allowedTools);
    console.error("Command: claude", args.join(" "));
    console.error("Prompt via stdin, length:", prompt.length);
    console.error("======================================\n");
  }

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "inherit"],
    });

    let buffer = '';
    let finalResult: string | undefined;
    let maybePartialResult = '';
    let collectingResult = false;

    // Send prompt
    child.stdin.write(prompt);
    child.stdin.end();

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line

      for (const line of lines) {
        // Check if this line starts the result message
        if (line.includes('"type":"result"')) {
          maybePartialResult = line;
          collectingResult = true;
          continue;
        }

        // Only process non-result messages for streaming
        if (!collectingResult && line.trim()) {
          try {
            const message: StreamMessage = JSON.parse(line);
            handleStreamMessage(message, callbacks);
          } catch (error) {
            console.error('Failed to parse stream JSON:', line.slice(0, 100), error);
          }
        }
      }
    });

    // Use 'end' event on stdout to ensure all data is processed before 'close'
    child.stdout.on('end', () => {
      if (collectingResult) {
        // Append any remaining buffer to complete the result message
        if (buffer.trim()) {
          maybePartialResult += buffer;
        }

        // Parse the complete result message
        try {
          const resultMessage: StreamMessage = JSON.parse(maybePartialResult);
          if (resultMessage.is_error) {
            reject(new Error(`Claude CLI error: ${resultMessage.result}`));
            return;
          }
          finalResult = resultMessage.result;
          callbacks?.onComplete?.(resultMessage.total_cost_usd || 0, resultMessage.duration_ms || 0);
        } catch (error) {
          console.error('Failed to parse result JSON:', maybePartialResult.slice(0, 200), error);
        }
      }

      if (DEBUG) {
        console.error('=== Stream ended, result collected:', collectingResult);
        console.error('=== Final result:', finalResult !== undefined ? `"${finalResult.slice(0, 100)}..."` : 'undefined');
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(finalResult); // undefined if no result received
      } else {
        reject(new Error(`Claude CLI exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

function handleStreamMessage(message: StreamMessage, callbacks?: StreamCallbacks) {
  switch (message.type) {
    case 'assistant':
      const content = message.message?.content || [];
      for (const item of content) {
        if (item.type === 'text' && item.text) {
          // Clean up text and handle streaming properly
          const text = item.text.trim();
          if (text) {
            callbacks?.onProgress?.(text);
          }
        } else if (item.type === 'tool_use') {
          callbacks?.onToolUse?.(item.name || 'unknown', item.input);
        }
      }
      break;

    case 'user':
      const toolResult = message.message?.content?.[0];
      if (toolResult?.type === 'tool_result') {
        callbacks?.onToolResult?.(toolResult.is_error || false);
      }
      break;
  }
}

const anthropic: LLMProvider = {
  name: "claude-code-headless-cli",
  async query({
    cwd,
    messages,
    mode = "default",
    allowedTools,
    sessionId,
    model,
    isInitialized,
    callbacks,
  }) {
    const prompt = flattenMessages(messages);
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await runClaudeCLI(cwd, prompt, mode, allowedTools, sessionId, model, isInitialized, callbacks);

        // Check if result is empty, undefined, or the literal string "undefined"
        if (result === undefined || result === null || result === "undefined" || result.trim() === "") {
          if (DEBUG) {
            console.error(`=== DEBUG: Query attempt ${attempt}/${maxRetries} returned empty result ===`);
            console.error("Result:", result);
            console.error("Type:", typeof result);
            console.error("===============================================");
          }

          if (attempt === maxRetries) {
            console.error(`❌ Provider query failed after ${maxRetries} attempts - no content received from Claude CLI`);
            return undefined; // Return undefined to maintain existing behavior
          }

          // Exponential backoff: wait 1s, then 2s, then 4s
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          if (DEBUG) {
            console.error(`Retrying in ${delayMs}ms...`);
          }
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        // Valid result received
        if (attempt > 1 && DEBUG) {
          console.error(`✅ Provider query succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        if (DEBUG) {
          console.error(`=== DEBUG: Query attempt ${attempt}/${maxRetries} failed ===`);
          console.error("Error:", error instanceof Error ? error.message : String(error));
          console.error("===============================================");
        }

        if (attempt === maxRetries) {
          throw error; // Re-throw the last error
        }

        // Exponential backoff for errors too
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        if (DEBUG) {
          console.error(`Retrying in ${delayMs}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return undefined; // This should never be reached, but TypeScript needs it
  },
};

export default anthropic;

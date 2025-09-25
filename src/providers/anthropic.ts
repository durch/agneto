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
): Promise<string> {
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
    let finalResult = '';

    // Send prompt
    child.stdin.write(prompt);
    child.stdin.end();

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message: StreamMessage = JSON.parse(line);
            handleStreamMessage(message, callbacks);

            if (message.type === 'result') {
              if (message.is_error) {
                reject(new Error(`Claude CLI error: ${message.result}`));
                return;
              }
              finalResult = message.result || '';
              callbacks?.onComplete?.(message.total_cost_usd || 0, message.duration_ms || 0);
            }
          } catch (error) {
            console.error('Failed to parse stream JSON:', line.slice(0, 100), error);
          }
        }
      }
    });

    child.on('close', (code) => {
      // Process any remaining buffered data before resolving
      if (buffer.trim()) {
        try {
          const message: StreamMessage = JSON.parse(buffer.trim());
          handleStreamMessage(message, callbacks);

          if (message.type === 'result') {
            if (message.is_error) {
              reject(new Error(`Claude CLI error: ${message.result}`));
              return;
            }
            finalResult = message.result || '';
            callbacks?.onComplete?.(message.total_cost_usd || 0, message.duration_ms || 0);
          }
        } catch (error) {
          console.error('Failed to parse final buffer JSON:', buffer.slice(0, 100), error);
        }
      }

      if (code === 0) {
        resolve(finalResult);
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
    return runClaudeCLI(cwd, prompt, mode, allowedTools, sessionId, model, isInitialized, callbacks);
  },
};

export default anthropic;

import type { LLMProvider, Msg } from "./index.js";
import { execFileSync, spawn } from "node:child_process";

const DEBUG = process.env.DEBUG === "true";
const NO_STREAM = process.env.NO_STREAM === "true";

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

// Interface for the Claude CLI JSON response
interface ClaudeCliResponse {
  type: "result";
  subtype: "success" | "error";
  is_error: boolean;
  result: string;
  session_id: string;
  total_cost_usd: number;
  duration_ms: number;
  num_turns?: number;
  usage?: any;
  modelUsage?: any;
  permission_denials?: any[];
  uuid?: string;
}

function runClaudeCLI(
  cwd: string,
  prompt: string,
  mode: "plan" | "default" | "acceptEdits",
  allowedTools?: string[],
  sessionId?: string,
  model?: string,
  isInitialized?: boolean
): string {
  // Build args: -p to print non-interactive; set permission mode; ALWAYS use JSON output
  const args = ["-p", "--permission-mode", mode, "--output-format", "json"];

  if (model) {
    args.push("--model", model);
  }

  if (allowedTools && allowedTools.length > 0) {
    args.push("--allowedTools", ...allowedTools);
  }

  if (DEBUG) {
    console.error("\n=== DEBUG: runClaudeCLI ===");
    console.error("CWD:", cwd);
    console.error("Mode:", mode);
    console.error("Allowed tools:", allowedTools);
    console.error("Command: claude", args.join(" "));
    console.error("Prompt via stdin, length:", prompt.length);
    console.error("===========================\n");
  }

  // Handle session continuity
  let out;
  if (isInitialized) {
    if (sessionId) {
      args.push("--resume", sessionId);
    }

    out = execFileSync("claude", args, {
      cwd,
      env: process.env,
      encoding: "utf8",
      input: prompt,
      stdio: ["pipe", "pipe", "inherit"],
    });
  } else {
    if (sessionId) {
      args.push("--session-id", sessionId);
    }
    out = execFileSync("claude", args, {
      cwd,
      env: process.env,
      encoding: "utf8",
      input: prompt,
      stdio: ["pipe", "pipe", "inherit"],
    });
  }

  if (DEBUG) {
    console.error("\n=== DEBUG: Claude CLI Raw Response ===");
    console.error("Raw output length:", out.length);
    console.error("Raw output:", JSON.stringify(out));
    console.error("======================================\n");
  }

  // Parse the JSON response from Claude CLI
  let cliResponse: ClaudeCliResponse;
  try {
    cliResponse = JSON.parse(out);
  } catch (error) {
    console.error("Failed to parse Claude CLI JSON response:", out);
    throw new Error(`Claude CLI returned invalid JSON: ${error}`);
  }

  if (DEBUG) {
    console.error("\n=== DEBUG: Parsed CLI Response ===");
    console.error("Type:", cliResponse.type);
    console.error("Subtype:", cliResponse.subtype);
    console.error("Is Error:", cliResponse.is_error);
    console.error("Session ID:", cliResponse.session_id);
    console.error("Cost (USD):", cliResponse.total_cost_usd);
    console.error("Duration (ms):", cliResponse.duration_ms);
    console.error("Result length:", cliResponse.result?.length);
    console.error("Result (first 500 chars):", cliResponse.result?.substring(0, 500));
    console.error("==================================\n");
  }

  // Check for errors in the response
  if (cliResponse.is_error) {
    throw new Error(`Claude CLI error: ${cliResponse.result}`);
  }

  // Return the result field which contains the agent's actual response
  // This may be JSON (for Coder/Reviewer) or plain text (for others)
  return cliResponse.result;
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
  }) {
    const prompt = flattenMessages(messages);
    return runClaudeCLI(cwd, prompt, mode, allowedTools, sessionId, model, isInitialized);
  },
};

export default anthropic;

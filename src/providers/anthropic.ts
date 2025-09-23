import type { LLMProvider, Msg } from "./index.js";
import { execFileSync } from "node:child_process";

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

function runClaudeCLI(
  cwd: string,
  prompt: string,
  mode: "plan" | "default" | "acceptEdits",
  allowedTools?: string[],
  sessionId?: string,
  model?: string
): string {
  // Build args: -p to print non-interactive; set permission mode; optionally allowed tools
  const args = ["-p", "--permission-mode", mode];

  if (model) {
    args.push("--model", model);
  }

  if (allowedTools && allowedTools.length > 0) {
    // CLI supports either --allowedTools or --allowed-tools; we'll use the former as shown in help.
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

  // Pass prompt via stdin instead of as an argument
  let out;
  try {
    if (sessionId) {
      args.push("--resume", sessionId);
    }

    out = execFileSync("claude", args, {
      cwd,
      env: process.env,
      encoding: "utf8",
      input: prompt, // Pass prompt through stdin
      stdio: ["pipe", "pipe", "inherit"], // Changed first stdio from "ignore" to "pipe"
    });
  } catch (error) {
    console.debug("Error running claude CLI:", error);
    args.pop(); // remove --resume and sessionId for logging
    args.pop();
    if (sessionId) {
      args.push("--session-id", sessionId);
    }
    out = execFileSync("claude", args, {
      cwd,
      env: process.env,
      encoding: "utf8",
      input: prompt, // Pass prompt through stdin
      stdio: ["pipe", "pipe", "inherit"], // Changed first stdio from "ignore" to "pipe"
    });
  }

  if (DEBUG) {
    console.error("\n=== DEBUG: Claude CLI Response ===");
    console.error("Raw output length:", out.length);
    console.error("Raw output:", JSON.stringify(out));
    console.error("Trimmed output:", JSON.stringify(out.trim()));
    console.error("==================================\n");
  }

  return out.trim();
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
  }) {
    const prompt = flattenMessages(messages);
    return runClaudeCLI(cwd, prompt, mode, allowedTools, sessionId, model);
  },
};

export default anthropic;

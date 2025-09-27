import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import type { CurmudgeonVerdict, CurmudgeonResult } from "../types.js";
import { log } from "../ui/log.js";
import { interpretCurmudgeonResponse } from "../protocol/interpreter.js";

export async function runCurmudgeon(
  provider: LLMProvider,
  cwd: string,
  planMd: string,
  taskDescription?: string
): Promise<CurmudgeonResult | null> {
  const sys = readFileSync(
    new URL("../prompts/curmudgeon.md", import.meta.url),
    "utf8"
  );

  log.startStreaming("Curmudgeon");

  // Build the user message with optional task description
  let userMessage = "";
  if (taskDescription) {
    userMessage = `Task Requirements:\n\n${taskDescription}\n\n`;
  }
  userMessage += `Plan (Markdown):\n\n${planMd}\n\nReview this plan for over-engineering, unnecessary complexity, or scope creep`;
  if (taskDescription) {
    userMessage += " in the context of the stated requirements";
  }
  userMessage += ". Provide your verdict.";

  const res = await provider.query({
    cwd,
    mode: "plan", // Read-only mode since Curmudgeon only reviews plans
    messages: [
      { role: "system", content: sys },
      {
        role: "user",
        content: userMessage,
      },
    ],
    callbacks: {
      onProgress: log.streamProgress,
      onToolUse: (tool, input) => log.toolUse("Curmudgeon", tool, input),
      onToolResult: (isError) => log.toolResult("Curmudgeon", isError),
      onComplete: (cost, duration) =>
        log.complete("Curmudgeon", cost, duration),
    },
  });

  // Use interpreter to extract verdict from natural language response
  const interpretation = await interpretCurmudgeonResponse(provider, res, cwd);

  if (!interpretation) {
    log.warn("Failed to interpret Curmudgeon response - proceeding without review");
    return null;
  }

  // Return both the verdict and the full original response for planner context
  return {
    verdict: interpretation.verdict,
    reasoning: res?.trim() || "No response received",
  };
}
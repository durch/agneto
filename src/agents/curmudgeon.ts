import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import type { CurmudgeonResult } from "../types.js";
import { log } from "../ui/log.js";

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
  userMessage += `Plan (Markdown):\n\n${planMd}\n\nReview this plan for over-engineering, unnecessary complexity, integration gaps, or scope creep`;
  if (taskDescription) {
    userMessage += " in the context of the stated requirements";
  }
  userMessage += ". Provide your assessment.";

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

  // Log the curmudgeon response for visibility
  log.curmudgeon(res?.trim() || "No response received", 'CURMUDGEONING');

  // Return the raw natural language feedback - let Planner interpret it
  const feedback = res?.trim();
  if (!feedback) {
    log.warn("No response from Curmudgeon - proceeding without review");
    return null;
  }

  return {
    feedback,
  };
}
import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import type { CurmudgeonVerdict, CurmudgeonResult } from "../types.js";
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

  // Parse the response to extract verdict and reasoning
  const lines = res?.trim().split("\n");
  if (!lines) {
    log.warn("Failed to get response from Curmudgeon - proceeding without review");
    return null;
  }

  const verdictLine = lines.find((line) => line.startsWith("VERDICT:"));
  const reasoningLine = lines.find((line) => line.startsWith("REASONING:"));
  const suggestionLines = lines.filter((line) => line.startsWith("SUGGESTION:"));

  // Parse verdict, return null if we can't parse it
  if (!verdictLine) {
    log.warn("Could not parse VERDICT from Curmudgeon response - proceeding without review");
    return null;
  }

  let verdict: CurmudgeonVerdict;
  if (verdictLine.includes("approve")) {
    verdict = "approve";
  } else if (verdictLine.includes("reject")) {
    verdict = "reject";
  } else if (verdictLine.includes("simplify")) {
    verdict = "simplify";
  } else {
    log.warn(`Unknown verdict in Curmudgeon response: ${verdictLine} - proceeding without review`);
    return null;
  }

  const reasoning =
    reasoningLine?.replace("REASONING:", "").trim() ||
    "No reasoning provided";

  const suggestions =
    suggestionLines.length > 0
      ? suggestionLines.map((line) => line.replace("SUGGESTION:", "").trim())
      : undefined;

  return { verdict, reasoning, suggestions };
}
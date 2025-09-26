import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import type { CurmudgeonVerdict, CurmudgeonResult } from "../types.js";
import { log } from "../ui/log.js";

export async function runCurmudgeon(
  provider: LLMProvider,
  cwd: string,
  planMd: string
): Promise<CurmudgeonResult> {
  const sys = readFileSync(
    new URL("../prompts/curmudgeon.md", import.meta.url),
    "utf8"
  );

  log.startStreaming("Curmudgeon");

  const res = await provider.query({
    cwd,
    mode: "plan", // Read-only mode since Curmudgeon only reviews plans
    messages: [
      { role: "system", content: sys },
      {
        role: "user",
        content: `Plan (Markdown):\n\n${planMd}\n\nReview this plan for over-engineering, unnecessary complexity, or scope creep. Provide your verdict.`,
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
    console.error("Failed to get response from Curmudgeon");
    return {
      verdict: "simplify",
      reasoning: "No response received - defaulting to simplification request",
    };
  }

  const verdictLine = lines.find((line) => line.startsWith("VERDICT:"));
  const reasoningLine = lines.find((line) => line.startsWith("REASONING:"));
  const suggestionLines = lines.filter((line) => line.startsWith("SUGGESTION:"));

  // Parse verdict with fallback to simplify
  let verdict: CurmudgeonVerdict = "simplify";
  if (verdictLine) {
    if (verdictLine.includes("approve")) {
      verdict = "approve";
    } else if (verdictLine.includes("reject")) {
      verdict = "reject";
    } else if (verdictLine.includes("simplify")) {
      verdict = "simplify";
    }
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
import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import type { SuperReviewerVerdict, SuperReviewerResult } from "../types.js";
import { log } from "../ui/log.js";
import { interpretSuperReviewerResponse } from "../protocol/interpreter.js";

export async function runSuperReviewer(
  provider: LLMProvider,
  cwd: string,
  planMd: string
): Promise<SuperReviewerResult> {
  const sys = readFileSync(
    new URL("../prompts/super-reviewer.md", import.meta.url),
    "utf8"
  );

  log.startStreaming("Super-Reviewer");

  const res = await provider.query({
    cwd,
    mode: "default", // Allow read tools for comprehensive review
    allowedTools: ["ReadFile", "Grep", "Bash"], // Include Bash for test/build verification
    messages: [
      { role: "system", content: sys },
      {
        role: "user",
        content: `Plan (Markdown):\n\n${planMd}\n\nPerform comprehensive review and provide verdict on the implementation.`,
      },
    ],
    callbacks: {
      onProgress: log.streamProgress,
      onToolUse: (tool, input) => log.toolUse("Super-Reviewer", tool, input),
      onToolResult: (isError) => log.toolResult("Super-Reviewer", isError),
      onComplete: (cost, duration) =>
        log.complete("Super-Reviewer", cost, duration),
    },
  });

  // Use interpreter to extract verdict and details from response
  const interpretation = await interpretSuperReviewerResponse(provider, res, cwd);

  if (!interpretation) {
    console.error("Failed to interpret SuperReviewer response");
    return {
      verdict: "needs-human",
      summary: "No response received",
      issues: [],
    };
  }

  return {
    verdict: interpretation.verdict,
    summary: interpretation.summary,
    issues: interpretation.issues || [],
  };
}

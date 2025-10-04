import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import type { SuperReviewerVerdict, SuperReviewerResult } from "../types.js";
import { log } from "../ui/log.js";
import { interpretSuperReviewerResponse } from "../protocol/interpreter.js";
import { summarizeToolParams } from "../utils/tool-summary.js";
import type { TaskStateMachine } from "../task-state-machine.js";

export async function runSuperReviewer(
  provider: LLMProvider,
  cwd: string,
  planMd: string,
  taskStateMachine?: TaskStateMachine,
  baselineCommit?: string
): Promise<SuperReviewerResult> {
  const sys = readFileSync(
    new URL("../prompts/super-reviewer.md", import.meta.url),
    "utf8"
  );

  log.startStreaming("Super-Reviewer");

  // Construct user message with baseline commit information
  let userMessage = "";
  if (baselineCommit) {
    userMessage += `**Task Baseline Commit**: \`${baselineCommit}\`\n\n`;
    userMessage += `IMPORTANT: Compare changes ONLY against this baseline commit using \`git diff ${baselineCommit}..HEAD\`. Do NOT compare against master/main.\n\n`;
  }
  userMessage += `**Plan (Markdown)**:\n\n${planMd}\n\nPerform comprehensive review and provide verdict on the implementation.`;

  const res = await provider.query({
    cwd,
    mode: "default", // Allow read tools for comprehensive review
    allowedTools: ["ReadFile", "Grep", "Bash"], // Include Bash for test/build verification
    messages: [
      { role: "system", content: sys },
      {
        role: "user",
        content: userMessage,
      },
    ],
    callbacks: {
      onProgress: log.streamProgress,
      onToolUse: (tool, input) => {
        log.toolUse("Super-Reviewer", tool, input);
        if (taskStateMachine) {
          taskStateMachine.setToolStatus("Super-Reviewer", tool, summarizeToolParams(tool, input));
        }
      },
      onToolResult: (isError) => {
        log.toolResult("Super-Reviewer", isError);
        if (taskStateMachine) {
          taskStateMachine.clearToolStatus();
        }
      },
      onComplete: (cost, duration) =>
        log.complete("Super-Reviewer", cost, duration),
    },
    taskStateMachine,
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

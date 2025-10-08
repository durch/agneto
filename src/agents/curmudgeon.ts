import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import type { CurmudgeonResult } from "../types.js";
import { log } from "../ui/log.js";
import { summarizeToolParams } from "../utils/tool-summary.js";
import type { TaskStateMachine } from "../task-state-machine.js";

export async function runCurmudgeon(
  provider: LLMProvider,
  cwd: string,
  planMd: string,
  taskDescription?: string,
  taskStateMachine?: TaskStateMachine
): Promise<CurmudgeonResult | null> {
  let sys = readFileSync(
    new URL("../prompts/curmudgeon.md", import.meta.url),
    "utf8"
  );

  // Append project-specific prompt additions if configured
  const customPrompt = taskStateMachine?.getAgentPromptConfig('curmudgeon');
  if (customPrompt) {
    sys += `\n\n## Project-Specific Instructions\n\n${customPrompt}`;
    log.curmudgeon("🤨 Curmudgeon: Using project-specific prompt additions", 'CURMUDGEONING');
  }

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
    mode: "default", // Curmudgeon needs tools to verify claims about codebase
    allowedTools: ["ReadFile", "ListDir", "Grep", "Bash"],
    messages: [
      { role: "system", content: sys },
      {
        role: "user",
        content: userMessage,
      },
    ],
    callbacks: {
      onProgress: (update: string) => {
        log.streamProgress(update);
        if (taskStateMachine) {
          taskStateMachine.setLiveActivityMessage("Curmudgeon", update);
        }
      },
      onToolUse: (tool, input) => {
        log.toolUse("Curmudgeon", tool, input);
        if (taskStateMachine) {
          taskStateMachine.setToolStatus("Curmudgeon", tool, summarizeToolParams(tool, input));
        }
      },
      onToolResult: (isError) => {
        log.toolResult("Curmudgeon", isError);
        if (taskStateMachine) {
          taskStateMachine.clearToolStatus();
        }
      },
      onComplete: (cost, duration, tokens) => {
        log.complete("Curmudgeon", cost, duration);
        taskStateMachine?.recordAgentUsage("Curmudgeon", cost, duration, tokens);
      },
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
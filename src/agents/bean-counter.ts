import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import { log } from "../ui/log.js";
import { interpretBeanCounterResponse, type BeanCounterInterpretation } from "../protocol/interpreter.js";
import { summarizeToolParams } from "../utils/tool-summary.js";
import type { CoderReviewerStateMachine } from "../state-machine.js";

const DEBUG = process.env.DEBUG === "true";

// AIDEV-NOTE: Bean Counter agent handles all work chunking decisions.
// It breaks down high-level plans into implementable chunks and tracks progress through completion.

export interface BeanCounterChunk {
  type: "WORK_CHUNK" | "TASK_COMPLETE";
  description: string;
  requirements: string[];
  context: string;
  bdIssueId?: string;  // bd issue ID for chunk (present for WORK_CHUNK)
}

export interface BeanCounterResult {
  rawResponse: string;
  chunk: BeanCounterChunk;
}

// Unified chunking: Get next chunk (first or subsequent)
export async function getNextChunk(
  provider: LLMProvider,
  cwd: string,
  planMd: string,
  sessionId: string,
  isInitialized: boolean,
  previousApproval?: string,
  stateMachine?: CoderReviewerStateMachine,
  taskStateMachine?: any
): Promise<BeanCounterResult | null> {
  let sys = readFileSync(
    new URL("../prompts/bean-counter.md", import.meta.url),
    "utf8"
  );

  const messages: Msg[] = [];

  if (!isInitialized) {
    // First call: establish context with system prompt and plan
    const customPrompt = taskStateMachine?.getAgentPromptConfig?.('bean-counter');
    if (customPrompt) {
      sys += `\n\n## Project-Specific Instructions\n\n${customPrompt}`;
      log.beanCounter("🧮 Bean Counter: Using custom prompt from .agneto.json");
    }

    // Get bd epic ID from state machine
    const bdEpicId = stateMachine?.getBdEpicId();
    const bdContext = bdEpicId ? `bd epic: ${bdEpicId}\n\n` : '';

    messages.push(
      { role: "system", content: sys },
      {
        role: "user",
        content: `${bdContext}High-Level Plan:\n\n${planMd}\n\nWhat's the next chunk to work on?`,
      }
    );
  } else {
    // Subsequent call: provide approval and ask for next chunk
    const approvalMsg = previousApproval || "Previous work was approved";
    messages.push({
      role: "user",
      content: `Work completed: ${approvalMsg}\n\nWhat's the next chunk, or is the task complete?`,
    });
  }

  try {
    if (!isInitialized) {
      log.startStreaming("Bean Counter");
    }

    const rawResponse = await provider.query({
      cwd,
      mode: "default",
      allowedTools: ["ReadFile", "Grep", "Bash"],
      sessionId,
      isInitialized,
      messages,
      callbacks: {
        onProgress: log.streamProgress,
        onToolUse: (tool, input) => {
          log.toolUse("Bean Counter", tool, input);
          if (stateMachine) {
            stateMachine.setToolStatus("Bean Counter", tool, summarizeToolParams(tool, input));
          }
        },
        onToolResult: (isError) => {
          log.toolResult("Bean Counter", isError);
          if (stateMachine) {
            stateMachine.clearToolStatus();
          }
        },
        onComplete: (cost, duration) =>
          log.complete("Bean Counter", cost, duration),
      },
      taskStateMachine,
    });

    // Validate response
    if (!rawResponse || !rawResponse.trim()) {
      console.error("Bean Counter returned empty response");
      return null;
    }

    // Display the Bean Counter response
    log.beanCounter(rawResponse);

    // Use interpreter to extract structured decision
    const interpretation = await interpretBeanCounterResponse(provider, rawResponse, cwd);
    if (!interpretation) {
      console.error("Failed to interpret Bean Counter response");
      return null;
    }

    return {
      rawResponse,
      chunk: interpretation
    };
  } catch (error) {
    console.error("Failed to get chunk from Bean Counter:", error);
    return null;
  }
}

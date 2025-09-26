import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import { log } from "../ui/log.js";
import { interpretBeanCounterResponse, type BeanCounterInterpretation } from "../protocol/interpreter.js";

// AIDEV-NOTE: Bean Counter agent handles all work chunking decisions - both initial and progressive.
// It breaks down high-level plans into implementable chunks and tracks progress through completion.

export interface BeanCounterChunk {
  type: "WORK_CHUNK" | "TASK_COMPLETE";
  description: string;
  requirements: string[];
  context: string;
}

// Initial chunking: Break down high-level plan into first implementable chunk
export async function getInitialChunk(
  provider: LLMProvider,
  cwd: string,
  planMd: string,
  sessionId?: string,
  isInitialized?: boolean
): Promise<BeanCounterChunk | null> {
  const template = readFileSync(
    new URL("../prompts/bean-counter.md", import.meta.url),
    "utf8"
  );

  const messages: Msg[] = [];

  if (!isInitialized) {
    // First call: establish context with system prompt and plan
    messages.push(
      { role: "system", content: template },
      {
        role: "user",
        content: `High-Level Plan (Markdown):\n\n${planMd}\n\n[INITIAL CHUNKING]\n\nBreak down this plan into the first implementable chunk. Focus on creating a small, reviewable piece of work that establishes a foundation for subsequent chunks.`,
      }
    );
  } else {
    // This shouldn't happen for initial chunking, but handle gracefully
    messages.push({
      role: "user",
      content:
        "[INITIAL CHUNKING]\n\nProvide the first implementable chunk for the given plan.",
    });
  }

  try {
    if (!isInitialized) {
      log.startStreaming("Bean Counter");
    }

    const rawResponse = await provider.query({
      cwd,
      mode: "default", // Use default mode for consistent streaming
      allowedTools: ["ReadFile", "Grep", "Bash"], // Read tools for context
      sessionId,
      isInitialized,
      messages,
      callbacks: {
        onProgress: log.streamProgress,
        onToolUse: (tool, input) => log.toolUse("Bean Counter", tool, input),
        onToolResult: (isError) => log.toolResult("Bean Counter", isError),
        onComplete: (cost, duration) =>
          log.complete("Bean Counter", cost, duration),
      },
    });

    log.orchestrator(`Raw bean counter initial response: ${rawResponse}`);

    // Use interpreter to avoid false positives from partial word matches
    const interpretation = await interpretBeanCounterResponse(provider, rawResponse, cwd);
    if (!interpretation) {
      console.error("Failed to interpret Bean Counter response");
      return null;
    }

    // Convert interpretation to BeanCounterChunk format
    return interpretation;
  } catch (error) {
    console.error("Failed to get initial chunk from Bean Counter:", error);
    return null;
  }
}

// Progressive chunking: After approval, determine next chunk or completion
export async function getNextChunk(
  provider: LLMProvider,
  cwd: string,
  planMd: string,
  approvalMessage: string,
  sessionId: string, // Required for progressive chunking to maintain ledger
  isInitialized: boolean
): Promise<BeanCounterChunk | null> {
  const messages: Msg[] = [];

  if (!isInitialized) {
    // This shouldn't happen for progressive chunking
    throw new Error(
      "Bean Counter session must be initialized for progressive chunking"
    );
  }

  // Progressive call: update ledger with approval and determine next chunk
  messages.push({
    role: "user",
    content: `[CHUNK COMPLETED]\n\nApproved work: ${approvalMessage}\n\n[NEXT CHUNKING]\n\nUpdate your progress ledger and determine the next implementable chunk, or signal completion if all work is done.`,
  });

  try {
    const rawResponse = await provider.query({
      cwd,
      mode: "default", // Use default mode for consistent streaming
      allowedTools: ["ReadFile", "Grep", "Bash"], // Read tools for context
      sessionId,
      isInitialized: true,
      messages,
      callbacks: {
        onProgress: log.streamProgress,
        onToolUse: (tool, input) => log.toolUse("Bean Counter", tool, input),
        onToolResult: (isError) => log.toolResult("Bean Counter", isError),
        onComplete: (cost, duration) =>
          log.complete("Bean Counter", cost, duration),
      },
    });

    log.orchestrator(`Raw bean counter progressive response: ${rawResponse}`);

    // Use interpreter to avoid false positives from partial word matches
    const interpretation = await interpretBeanCounterResponse(provider, rawResponse, cwd);
    if (!interpretation) {
      console.error("Failed to interpret Bean Counter response");
      return null;
    }

    // Convert interpretation to BeanCounterChunk format
    return interpretation;
  } catch (error) {
    console.error("Failed to get next chunk from Bean Counter:", error);
    return null;
  }
}

// DEPRECATED: Old parsing function that had false positive bug with partial word matches
// Kept for reference only - now using interpretBeanCounterResponse() instead
// This function incorrectly triggered on "complete" appearing in words like "completion"
// which caused premature task termination. The interpreter pattern fixes this issue.

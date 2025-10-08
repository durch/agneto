/**
 * Stateless Summarizer Functions
 *
 * Extracts concise summaries from Coder and Reviewer outputs for activity streams.
 * Uses fast Sonnet model for quick processing, following the Interpreter pattern.
 */

import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";

/**
 * Summarize Coder output into a concise 3-5 line summary
 *
 * @param provider - The LLM provider (Anthropic Claude CLI)
 * @param output - Raw Coder response text
 * @param cwd - Current working directory for Claude CLI context
 * @returns Concise summary string or fallback text on error
 */
export async function summarizeCoderOutput(
  provider: LLMProvider,
  output: string,
  cwd: string
): Promise<string> {
  // Load Coder summarizer prompt
  const template = readFileSync(
    new URL("../prompts/summarizer-coder.md", import.meta.url),
    "utf8"
  );

  const messages: Msg[] = [
    { role: "system", content: template },
    {
      role: "user",
      content: `Extract a concise summary from this Coder response:\n\n${output}`,
    },
  ];

  try {
    const summary = await provider.query({
      cwd,
      mode: "default",
      allowedTools: [],
      model: "haiku",
      messages,
    });

    if (!summary || summary.trim() === "") {
      return `Coder completed work (summary unavailable)`;
    }

    return summary.trim();
  } catch (error) {
    console.error("Failed to summarize Coder output:", error);
    return `Coder completed work (summary error: ${error instanceof Error ? error.message : "unknown"})`;
  }
}

/**
 * Summarize Reviewer output into a concise 3-5 line summary
 *
 * @param provider - The LLM provider (Anthropic Claude CLI)
 * @param output - Raw Reviewer response text
 * @param cwd - Current working directory for Claude CLI context
 * @returns Concise summary string or fallback text on error
 */
export async function summarizeReviewerOutput(
  provider: LLMProvider,
  output: string,
  cwd: string
): Promise<string> {
  // Load Reviewer summarizer prompt
  const template = readFileSync(
    new URL("../prompts/summarizer-reviewer.md", import.meta.url),
    "utf8"
  );

  const messages: Msg[] = [
    { role: "system", content: template },
    {
      role: "user",
      content: `Extract a concise summary from this Reviewer response:\n\n${output}`,
    },
  ];

  try {
    const summary = await provider.query({
      cwd,
      mode: "default",
      allowedTools: [],
      model: "haiku",
      messages,
    });

    if (!summary || summary.trim() === "") {
      return `Reviewer provided feedback (summary unavailable)`;
    }

    return summary.trim();
  } catch (error) {
    console.error("Failed to summarize Reviewer output:", error);
    return `Reviewer provided feedback (summary error: ${error instanceof Error ? error.message : "unknown"})`;
  }
}
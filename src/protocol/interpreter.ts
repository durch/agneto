/**
 * Stateless LLM Response Interpreter
 *
 * Replaces rigid JSON schema validation with natural language interpretation.
 * Uses a fast Sonnet model to extract structured decisions from any response format.
 */

import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import type { CoderResponse, ReviewerResponse } from "./schemas.js";
import { cleanJsonResponse } from "../utils/json-cleaner.js";

// Interpreter result types
export interface CoderInterpretation {
  action: "continue" | "complete" | "implemented";
  description?: string;
  steps?: string[];
  files?: string[];
  filesChanged?: string[];
}

export interface ReviewerInterpretation {
  verdict: "approve" | "revise" | "reject" | "needs_human";
  feedback: string;
  continueNext?: boolean;
}

/**
 * Stateless interpreter for Coder responses
 */
export async function interpretCoderResponse(
  provider: LLMProvider,
  rawResponse: string,
  cwd: string
): Promise<CoderInterpretation | null> {

  // Load interpreter prompt
  const template = readFileSync(
    new URL("../prompts/interpreter-coder.md", import.meta.url),
    "utf8"
  );

  const messages: Msg[] = [
    { role: "system", content: template },
    {
      role: "user",
      content: `Extract the decision from this Coder response:\n\n${rawResponse}`
    }
  ];

  try {
    const response = await provider.query({
      cwd,
      mode: "plan", // Read-only mode, no tools needed
      allowedTools: [],
      messages
    });

    // Parse the interpreter's JSON response (clean markdown if present)
    const parsed = JSON.parse(cleanJsonResponse(response));

    // Validate basic structure
    if (!parsed.action || !["continue", "complete", "implemented"].includes(parsed.action)) {
      console.warn("Interpreter returned invalid action:", parsed.action);
      return null;
    }

    return parsed as CoderInterpretation;

  } catch (error) {
    console.error("Interpreter failed to parse Coder response:", error);
    console.error("Raw response was:", rawResponse);
    return null;
  }
}

/**
 * Stateless interpreter for Reviewer responses
 */
export async function interpretReviewerResponse(
  provider: LLMProvider,
  rawResponse: string,
  cwd: string
): Promise<ReviewerInterpretation | null> {

  // Load interpreter prompt
  const template = readFileSync(
    new URL("../prompts/interpreter-reviewer.md", import.meta.url),
    "utf8"
  );

  const messages: Msg[] = [
    { role: "system", content: template },
    {
      role: "user",
      content: `Extract the decision from this Reviewer response:\n\n${rawResponse}`
    }
  ];

  try {
    const response = await provider.query({
      cwd,
      mode: "plan", // Read-only mode, no tools needed
      allowedTools: [],
      messages
    });

    // Parse the interpreter's JSON response (clean markdown if present)
    const parsed = JSON.parse(cleanJsonResponse(response));

    // Validate basic structure
    if (!parsed.verdict || !["approve", "revise", "reject", "needs_human"].includes(parsed.verdict)) {
      console.warn("Interpreter returned invalid verdict:", parsed.verdict);
      return null;
    }

    // Ensure feedback is present
    if (!parsed.feedback) {
      parsed.feedback = "";
    }

    return parsed as ReviewerInterpretation;

  } catch (error) {
    console.error("Interpreter failed to parse Reviewer response:", error);
    console.error("Raw response was:", rawResponse);
    return null;
  }
}

/**
 * Convert interpreted Coder response to legacy format for orchestrator compatibility
 */
export function convertCoderInterpretation(
  interpretation: CoderInterpretation,
  rawResponse: string
): CoderResponse | null {

  switch (interpretation.action) {
    case "complete":
      return { action: "complete" };

    case "implemented":
      return {
        action: "implemented",
        data: {
          description: interpretation.description || "Implementation completed",
          filesChanged: interpretation.filesChanged || []
        }
      };

    case "continue":
      // This maps to propose_plan in the legacy format
      return {
        action: "propose_plan",
        data: {
          description: interpretation.description || "Continue with next step",
          steps: interpretation.steps || [],
          files: interpretation.files || []
        }
      };

    default:
      console.warn("Unknown Coder interpretation action:", interpretation.action);
      return null;
  }
}

/**
 * Convert interpreted Reviewer response to legacy format for orchestrator compatibility
 */
export function convertReviewerInterpretation(
  interpretation: ReviewerInterpretation
): ReviewerResponse {

  return {
    action: "review",
    verdict: interpretation.verdict,
    feedback: interpretation.feedback,
    continueNext: interpretation.continueNext
  };
}
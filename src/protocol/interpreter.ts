/**
 * Stateless LLM Response Interpreter
 *
 * Replaces rigid JSON schema validation with natural language interpretation.
 * Uses a fast Sonnet model to extract structured decisions from any response format.
 */

import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import type { CoderResponse, ReviewerResponse } from "./schemas.js";

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
      model: "sonnet",
      messages
    });

    // Parse interpreter's simple keyword response
    return parseCoderKeywords(response, rawResponse);

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
      model: "sonnet",
      messages
    });

    // Parse interpreter's simple keyword response
    return parseReviewerKeywords(response, rawResponse);

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

/**
 * Parse Coder interpreter keywords
 */
function parseCoderKeywords(response: string, originalResponse: string): CoderInterpretation | null {
  const lowerResponse = response.toLowerCase().trim();

  if (lowerResponse.includes('complete')) {
    return { action: "complete" };
  }

  if (lowerResponse.includes('implemented')) {
    return {
      action: "implemented",
      description: extractDescription(originalResponse),
      filesChanged: extractFiles(originalResponse)
    };
  }

  // Default to continue
  return {
    action: "continue",
    description: extractDescription(originalResponse),
    steps: extractSteps(originalResponse),
    files: extractFiles(originalResponse)
  };
}

/**
 * Parse Reviewer interpreter keywords
 */
function parseReviewerKeywords(response: string, originalResponse: string): ReviewerInterpretation | null {
  const lowerResponse = response.toLowerCase().trim();
  let verdict: "approve" | "revise" | "reject" | "needs_human" = "needs_human";
  let continueNext: boolean | undefined;

  if (lowerResponse.includes('approve_complete')) {
    verdict = "approve";
    continueNext = false;
  } else if (lowerResponse.includes('approve_continue')) {
    verdict = "approve";
    continueNext = true;
  } else if (lowerResponse.includes('approve')) {
    verdict = "approve";
    continueNext = true; // Default to continue for plain approve
  } else if (lowerResponse.includes('revise')) {
    verdict = "revise";
  } else if (lowerResponse.includes('reject')) {
    verdict = "reject";
  } else if (lowerResponse.includes('needs_human')) {
    verdict = "needs_human";
  }
  // Default to needs_human

  return {
    verdict,
    feedback: originalResponse.trim(),
    continueNext
  };
}

/**
 * Extract description from response text
 */
function extractDescription(response: string): string {
  // Look for common description patterns
  const lines = response.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes('description:') ||
        line.toLowerCase().includes('summary:') ||
        line.toLowerCase().includes('implementing:')) {
      return line.split(':')[1]?.trim() || '';
    }
  }

  // Fallback: use first meaningful sentence
  const sentences = response.split(/[.!?]/);
  for (const sentence of sentences) {
    if (sentence.trim().length > 10) {
      return sentence.trim();
    }
  }

  return 'Continue with implementation';
}

/**
 * Extract file mentions from response text
 */
function extractFiles(response: string): string[] {
  const files: string[] = [];

  // Look for common file patterns
  const fileMatches = response.match(/[\w/-]+\.(ts|js|md|json|tsx|jsx)/g);
  if (fileMatches) {
    files.push(...fileMatches);
  }

  // Look for src/ patterns
  const srcMatches = response.match(/src\/[^\s,]+/g);
  if (srcMatches) {
    files.push(...srcMatches);
  }

  return [...new Set(files)]; // Remove duplicates
}

/**
 * Extract steps from response text
 */
function extractSteps(response: string): string[] {
  const steps: string[] = [];
  const lines = response.split('\n');

  for (const line of lines) {
    // Look for numbered steps
    if (/^\s*\d+\./.test(line)) {
      steps.push(line.replace(/^\s*\d+\.\s*/, '').trim());
    }
    // Look for bullet points
    else if (/^\s*[-*]/.test(line)) {
      steps.push(line.replace(/^\s*[-*]\s*/, '').trim());
    }
  }

  return steps;
}
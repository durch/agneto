/**
 * Stateless LLM Response Interpreter
 *
 * Replaces rigid JSON schema validation with natural language interpretation.
 * Uses a fast Sonnet model to extract structured decisions from any response format.
 */

import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import type { CoderResponse, ReviewerResponse } from "./schemas.js";
import type { BeanCounterChunk } from "../agents/bean-counter.js";
import type { SuperReviewerVerdict } from "../types.js";

// Interpreter result types
export interface CoderInterpretation {
  action: "continue" | "complete" | "implemented";
  description?: string;
  steps?: string[];
  files?: string[];
  filesChanged?: string[];
}

export interface ReviewerInterpretation {
  verdict: "approve" | "revise" | "reject" | "needs_human" | "already_complete";
  feedback: string | undefined;
  continueNext?: boolean;
}

export interface BeanCounterInterpretation {
  type: "WORK_CHUNK" | "TASK_COMPLETE";
  description: string;
  requirements: string[];
  context: string;
}

export interface SuperReviewerInterpretation {
  verdict: SuperReviewerVerdict;
  summary: string;
  issues?: string[];
}

export interface CurmudgeonInterpretation {
  verdict: "APPROVE" | "SIMPLIFY" | "REJECT" | "NEEDS_HUMAN";
  feedback: string;
}

export type RefinerInterpretation =
  | { type: "question"; question: string }
  | { type: "refinement"; content: string };

/**
 * Stateless interpreter for Coder responses
 */
export async function interpretCoderResponse(
  provider: LLMProvider,
  rawResponse: string | undefined,
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
      content: `Extract the decision from this Coder response:\n\n${rawResponse}`,
    },
  ];

  try {
    const response = await provider.query({
      cwd,
      mode: "default", // Use default mode for consistent streaming
      allowedTools: [],
      model: "sonnet",
      messages,
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
  rawResponse: string | undefined,
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
      content: `Extract the decision from this Reviewer response:\n\n${rawResponse}`,
    },
  ];

  try {
    const response = await provider.query({
      cwd,
      mode: "default", // Use default mode for consistent streaming
      allowedTools: [],
      model: "sonnet",
      messages,
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
 * Stateless interpreter for Bean Counter responses
 */
export async function interpretBeanCounterResponse(
  provider: LLMProvider,
  rawResponse: string | undefined,
  cwd: string
): Promise<BeanCounterInterpretation | null> {
  // Load interpreter prompt
  const template = readFileSync(
    new URL("../prompts/interpreter-bean-counter.md", import.meta.url),
    "utf8"
  );

  const messages: Msg[] = [
    { role: "system", content: template },
    {
      role: "user",
      content: `Extract the decision from this Bean Counter response:\n\n${rawResponse}`,
    },
  ];

  try {
    const response = await provider.query({
      cwd,
      mode: "default", // Use default mode for consistent streaming
      allowedTools: [],
      model: "sonnet",
      messages,
    });

    // Parse interpreter's simple keyword response
    return parseBeanCounterKeywords(response, rawResponse);
  } catch (error) {
    console.error("Interpreter failed to parse Bean Counter response:", error);
    console.error("Raw response was:", rawResponse);
    return null;
  }
}

/**
 * Stateless interpreter for SuperReviewer responses
 */
export async function interpretSuperReviewerResponse(
  provider: LLMProvider,
  rawResponse: string | undefined,
  cwd: string
): Promise<SuperReviewerInterpretation | null> {
  // Load interpreter prompt
  const template = readFileSync(
    new URL("../prompts/interpreter-super-reviewer.md", import.meta.url),
    "utf8"
  );

  const messages: Msg[] = [
    { role: "system", content: template },
    {
      role: "user",
      content: `Extract the decision from this SuperReviewer response:\n\n${rawResponse}`,
    },
  ];

  try {
    const response = await provider.query({
      cwd,
      mode: "default", // Use default mode for consistent streaming
      allowedTools: [],
      model: "sonnet",
      messages,
    });

    // Parse interpreter's simple keyword response
    return parseSuperReviewerKeywords(response, rawResponse);
  } catch (error) {
    console.error("Interpreter failed to parse SuperReviewer response:", error);
    console.error("Raw response was:", rawResponse);
    return null;
  }
}

/**
 * Stateless interpreter for Refiner responses
 */
export async function interpretRefinerResponse(
  provider: LLMProvider,
  rawResponse: string | undefined,
  cwd: string
): Promise<RefinerInterpretation | null> {
  // Load interpreter prompt
  const template = readFileSync(
    new URL("../prompts/interpreter-refiner.md", import.meta.url),
    "utf8"
  );

  const messages: Msg[] = [
    { role: "system", content: template },
    {
      role: "user",
      content: `Extract the decision from this Refiner response:\n\n${rawResponse}`,
    },
  ];

  try {
    const response = await provider.query({
      cwd,
      mode: "default", // Use default mode for consistent streaming
      allowedTools: [],
      model: "sonnet",
      messages,
    });

    // Parse interpreter's simple keyword response
    return parseRefinerKeywords(response, rawResponse);
  } catch (error) {
    console.error("Interpreter failed to parse Refiner response:", error);
    console.error("Raw response was:", rawResponse);
    return null;
  }
}

/**
 * Stateless interpreter for Curmudgeon responses
 */
export async function interpretCurmudgeonResponse(
  provider: LLMProvider,
  rawResponse: string | undefined,
  cwd: string
): Promise<CurmudgeonInterpretation | null> {
  // Load interpreter prompt
  const template = readFileSync(
    new URL("../prompts/interpreter-curmudgeon.md", import.meta.url),
    "utf8"
  );

  const messages: Msg[] = [
    { role: "system", content: template },
    {
      role: "user",
      content: `Extract the decision from this Curmudgeon response:\n\n${rawResponse}`,
    },
  ];

  try {
    const response = await provider.query({
      cwd,
      mode: "default", // Use default mode for consistent streaming
      allowedTools: [],
      model: "sonnet",
      messages,
    });

    // Parse interpreter's simple keyword response
    return parseCurmudgeonKeywords(response, rawResponse);
  } catch (error) {
    console.error("Interpreter failed to parse Curmudgeon response:", error);
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
          filesChanged: interpretation.filesChanged || [],
        },
      };

    case "continue":
      // This maps to propose_plan in the legacy format
      return {
        action: "propose_plan",
        data: {
          description: interpretation.description || "Continue with next step",
          steps: interpretation.steps || [],
          files: interpretation.files || [],
        },
      };

    default:
      console.warn(
        "Unknown Coder interpretation action:",
        interpretation.action
      );
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
    continueNext: interpretation.continueNext,
  };
}

// convertCurmudgeonInterpretation removed - Curmudgeon now returns raw feedback directly

/**
 * Parse Coder interpreter keywords
 */
function parseCoderKeywords(
  response: string | undefined,
  originalResponse: string | undefined
): CoderInterpretation | null {
  const lowerResponse = response?.toLowerCase().trim();

  if (lowerResponse?.includes("complete")) {
    return { action: "complete" };
  }

  if (lowerResponse?.includes("implemented")) {
    return {
      action: "implemented",
      description: extractDescription(originalResponse),
      filesChanged: extractFiles(originalResponse),
    };
  }

  // Default to continue
  return {
    action: "continue",
    description: extractDescription(originalResponse),
    steps: extractSteps(originalResponse),
    files: extractFiles(originalResponse),
  };
}

/**
 * Parse Reviewer interpreter keywords
 */
function parseReviewerKeywords(
  response: string | undefined,
  originalResponse: string | undefined
): ReviewerInterpretation | null {
  const lowerResponse = response?.toLowerCase().trim();
  let verdict:
    | "approve"
    | "revise"
    | "reject"
    | "needs_human"
    | "already_complete" = "needs_human";
  let continueNext: boolean | undefined;

  if (lowerResponse?.includes("already_complete")) {
    verdict = "already_complete";
    continueNext = false;
  } else if (lowerResponse?.includes("approve_complete")) {
    verdict = "approve";
    continueNext = false;
  } else if (lowerResponse?.includes("approve_continue")) {
    verdict = "approve";
    continueNext = true;
  } else if (lowerResponse?.includes("approve")) {
    verdict = "approve";
    continueNext = true; // Default to continue for plain approve
  } else if (lowerResponse?.includes("revise")) {
    verdict = "revise";
  } else if (lowerResponse?.includes("reject")) {
    verdict = "reject";
  } else if (lowerResponse?.includes("needs_human")) {
    verdict = "needs_human";
  }
  // Default to needs_human

  return {
    verdict,
    feedback: originalResponse?.trim(),
    continueNext,
  };
}

/**
 * Parse Bean Counter interpreter keywords
 */
function parseBeanCounterKeywords(
  response: string | undefined,
  originalResponse: string | undefined
): BeanCounterInterpretation | null {
  const lowerResponse = response?.toLowerCase().trim();

  // Determine chunk type based on keywords
  const type: "WORK_CHUNK" | "TASK_COMPLETE" = lowerResponse?.includes("task_complete") ? "TASK_COMPLETE" : "WORK_CHUNK";

  return {
    type,
    description: extractDescription(originalResponse) || "Continue with next chunk",
    requirements: extractRequirements(originalResponse) || [],
    context: extractContext(originalResponse) || "",
  };
}

/**
 * Parse SuperReviewer interpreter keywords
 */
function parseSuperReviewerKeywords(
  response: string | undefined,
  originalResponse: string | undefined
): SuperReviewerInterpretation | null {
  const lowerResponse = response?.toLowerCase().trim();

  // Extract verdict from interpreter keywords
  let verdict: SuperReviewerVerdict = "needs-human"; // Default to needs-human for safety

  if (lowerResponse?.includes("approve")) {
    verdict = "approve";
  } else if (lowerResponse?.includes("needs_human")) {
    verdict = "needs-human";
  }
  // Default to needs-human if no clear verdict

  // Extract issues from original response
  const issues = extractIssues(originalResponse);

  return {
    verdict,
    summary: originalResponse?.trim() || "SuperReviewer completed review",
    issues: issues.length > 0 ? issues : undefined,
  };
}

/**
 * Extract description from response text
 */
function extractDescription(response: string | undefined): string | undefined {
  if (!response) return undefined;

  // Look for common description patterns
  const lines = response?.split("\n");

  for (const line of lines) {
    if (
      line.toLowerCase().includes("description:") ||
      line.toLowerCase().includes("summary:") ||
      line.toLowerCase().includes("implementing:")
    ) {
      return line.split(":")[1]?.trim() || "";
    }
  }

  // Fallback: use first meaningful sentence
  const sentences = response?.split(/[.!?]/);

  if (!sentences) return "Continue with implementation";

  for (const sentence of sentences) {
    if (sentence.trim().length > 10) {
      return sentence.trim();
    }
  }

  return "Continue with implementation";
}

/**
 * Extract file mentions from response text
 */
function extractFiles(response: string | undefined): string[] | undefined {
  if (!response) return undefined;
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
function extractSteps(response: string | undefined): string[] | undefined {
  if (!response) return undefined;
  const steps: string[] = [];
  const lines = response.split("\n");

  for (const line of lines) {
    // Look for numbered steps
    if (/^\s*\d+\./.test(line)) {
      steps.push(line.replace(/^\s*\d+\.\s*/, "").trim());
    }
    // Look for bullet points
    else if (/^\s*[-*]/.test(line)) {
      steps.push(line.replace(/^\s*[-*]\s*/, "").trim());
    }
  }

  return steps;
}

/**
 * Extract requirements from response text for Bean Counter
 */
function extractRequirements(response: string | undefined): string[] {
  if (!response) return [];
  const requirements: string[] = [];
  const lines = response.split("\n");

  for (const line of lines) {
    // Look for requirement patterns
    if (
      line.toLowerCase().includes("requirement") ||
      line.toLowerCase().includes("must") ||
      line.toLowerCase().includes("should")
    ) {
      const cleanLine = line.replace(/^\s*[-*]\s*/, "").trim();
      if (cleanLine.length > 5) {
        requirements.push(cleanLine);
      }
    }
    // Look for numbered requirements
    else if (/^\s*\d+\./.test(line)) {
      const cleanLine = line.replace(/^\s*\d+\.\s*/, "").trim();
      if (cleanLine.length > 5) {
        requirements.push(cleanLine);
      }
    }
    // Look for bullet points that might be requirements
    else if (/^\s*[-*]/.test(line)) {
      const cleanLine = line.replace(/^\s*[-*]\s*/, "").trim();
      if (cleanLine.length > 5) {
        requirements.push(cleanLine);
      }
    }
  }

  return requirements;
}

/**
 * Extract context from response text for Bean Counter
 */
function extractContext(response: string | undefined): string {
  if (!response) return "";

  // Look for context section
  const lines = response.split("\n");
  const contextLines: string[] = [];
  let inContextSection = false;

  for (const line of lines) {
    if (line.toLowerCase().includes("context:")) {
      inContextSection = true;
      const contextPart = line.split(":")[1]?.trim();
      if (contextPart) contextLines.push(contextPart);
      continue;
    }

    if (inContextSection) {
      if (line.trim() === "" || line.toLowerCase().includes("requirement")) {
        break;
      }
      contextLines.push(line.trim());
    }
  }

  // If no explicit context section, use first few sentences as context
  if (contextLines.length === 0) {
    const sentences = response.split(/[.!?]/);
    for (let i = 0; i < Math.min(2, sentences.length); i++) {
      if (sentences[i].trim().length > 10) {
        contextLines.push(sentences[i].trim());
      }
    }
  }

  return contextLines.join(" ").trim();
}

/**
 * Parse Curmudgeon interpreter keywords
 */
function parseCurmudgeonKeywords(
  response: string | undefined,
  originalResponse: string | undefined
): CurmudgeonInterpretation | null {
  const lowerResponse = response?.toLowerCase().trim();

  // Determine verdict based on keywords from interpreter
  let verdict: "APPROVE" | "SIMPLIFY" | "REJECT" | "NEEDS_HUMAN" = "NEEDS_HUMAN";

  if (lowerResponse?.includes("approve")) {
    verdict = "APPROVE";
  } else if (lowerResponse?.includes("simplify")) {
    verdict = "SIMPLIFY";
  } else if (lowerResponse?.includes("reject")) {
    verdict = "REJECT";
  } else if (lowerResponse?.includes("needs_human")) {
    verdict = "NEEDS_HUMAN";
  }
  // Default to NEEDS_HUMAN for safety

  return {
    verdict,
    feedback: originalResponse?.trim() || "",
  };
}

/**
 * Parse Refiner interpreter keywords
 */
function parseRefinerKeywords(
  response: string | undefined,
  originalResponse: string | undefined
): RefinerInterpretation | null {
  const lowerResponse = response?.toLowerCase().trim();

  // Check if interpreter detected a question
  if (lowerResponse?.includes("question")) {
    // Extract the question from original response
    const question = extractQuestion(originalResponse);

    // Validate question is non-empty before returning
    if (!question || question.trim().length === 0) {
      console.warn("Detected question type but could not extract question text");
      return null;
    }

    return {
      type: "question",
      question: question.trim(),
    };
  }

  // Default to refinement - return full response as content
  return {
    type: "refinement",
    content: originalResponse?.trim() || "",
  };
}

/**
 * Extract question from refiner response
 */
function extractQuestion(response: string | undefined): string {
  if (!response) return "";

  const lines = response.split("\n");

  // Look for explicit question markers
  for (const line of lines) {
    if (
      line.toLowerCase().includes("i need to clarify") ||
      line.toLowerCase().includes("could you specify") ||
      line.toLowerCase().includes("could you clarify")
    ) {
      // Return the line after the marker, or the full line if it contains the question
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        return line.substring(colonIndex + 1).trim();
      }
      return line.trim();
    }
  }

  // Look for question marks in early sentences (first 2 sentences)
  const sentences = response.split(/[.!?]/);
  for (let i = 0; i < Math.min(2, sentences.length); i++) {
    if (sentences[i].includes("?")) {
      return sentences[i].trim() + "?";
    }
  }

  // Fallback: return first meaningful sentence
  for (const sentence of sentences) {
    if (sentence.trim().length > 10) {
      return sentence.trim();
    }
  }

  return "";
}

/**
 * Extract issues from SuperReviewer response text
 */
function extractIssues(response: string | undefined): string[] {
  if (!response) return [];
  const issues: string[] = [];
  const lines = response.split("\n");

  for (const line of lines) {
    // Look for ISSUE: patterns
    if (line.toLowerCase().includes("issue:")) {
      const issuePart = line.split(":")[1]?.trim();
      if (issuePart && issuePart.length > 5) {
        issues.push(issuePart);
      }
    }
  }

  return issues;
}

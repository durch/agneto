/**
 * JSON Schema validators for agent responses
 * Provides validation and detailed error feedback for schema mismatches
 */

import { Ajv, ValidateFunction } from "ajv";
import { schemas, CoderResponse, ReviewerResponse } from "./schemas.js";

// Initialize AJV with verbose errors for better feedback
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false
});

// Create validators from schema definitions
const validateCoderPlanProposal = ajv.compile(schemas.coder.planProposal);
const validateCoderComplete = ajv.compile(schemas.coder.complete);
const validateCoderImplemented = ajv.compile(schemas.coder.implemented);
const validateReviewerSchema = ajv.compile(schemas.reviewer);

/**
 * Format validation errors into human-readable feedback
 */
function formatValidationErrors(validator: ValidateFunction): string {
  if (!validator.errors) return "Unknown validation error";

  const errors = validator.errors.map(err => {
    const path = err.instancePath || "root";
    const message = err.message || "validation failed";

    switch (err.keyword) {
      case "required":
        return `Missing required field: ${path}${path ? '.' : ''}${err.params.missingProperty}`;
      case "enum":
        return `${path}: ${message} (allowed: ${err.params.allowableValues?.join(", ")})`;
      case "type":
        return `${path}: Expected ${err.params.type}, got ${typeof err.data}`;
      case "const":
        return `${path}: Must be exactly "${err.params.allowedValue}"`;
      case "additionalProperties":
        return `Unexpected field: ${path}.${err.params.additionalProperty}`;
      default:
        return `${path}: ${message}`;
    }
  });

  return errors.join("; ");
}

/**
 * Result of validation - either success with typed data or failure with feedback
 */
export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: string; feedback: string };

/**
 * Validate a Coder response against the appropriate schema
 */
export function validateCoderResponse(response: any): ValidationResult<CoderResponse> {
  // First check if it's even an object
  if (!response || typeof response !== "object") {
    return {
      valid: false,
      error: "Response must be a JSON object",
      feedback: "Your response must be a valid JSON object with an 'action' field"
    };
  }

  // Check action field to determine which schema to use
  const action = response.action;

  if (!action) {
    return {
      valid: false,
      error: "Missing 'action' field",
      feedback: "Your response must include an 'action' field with one of: 'propose_plan', 'complete', 'implemented'"
    };
  }

  let validator: ValidateFunction;

  switch (action) {
    case "propose_plan":
      validator = validateCoderPlanProposal;
      break;
    case "complete":
      validator = validateCoderComplete;
      break;
    case "implemented":
      validator = validateCoderImplemented;
      break;
    default:
      return {
        valid: false,
        error: `Invalid action: ${action}`,
        feedback: `Invalid action '${action}'. Valid actions are: 'propose_plan', 'complete', 'implemented'`
      };
  }

  if (validator(response)) {
    return { valid: true, data: response as CoderResponse };
  }

  const errors = formatValidationErrors(validator);
  return {
    valid: false,
    error: errors,
    feedback: `JSON schema validation failed: ${errors}. Please correct your response to match the required schema.`
  };
}

/**
 * Validate a Reviewer response
 */
export function validateReviewerResponse(response: any): ValidationResult<ReviewerResponse> {
  // First check if it's even an object
  if (!response || typeof response !== "object") {
    return {
      valid: false,
      error: "Response must be a JSON object",
      feedback: "Your response must be a valid JSON object with 'action' and 'verdict' fields"
    };
  }

  // Check for required fields
  if (response.action !== "review") {
    return {
      valid: false,
      error: "Invalid action field",
      feedback: "The 'action' field must be exactly 'review'"
    };
  }

  if (!response.verdict) {
    return {
      valid: false,
      error: "Missing verdict field",
      feedback: "You must include a 'verdict' field with one of: 'approve', 'revise', 'reject', 'needs_human'"
    };
  }

  // Validate against schema
  if (validateReviewerSchema(response)) {
    // Type guard - response is now known to be ReviewerResponse-shaped
    const reviewerResponse = response as unknown as ReviewerResponse;

    // Additional semantic validation
    if (reviewerResponse.verdict !== "approve" && !reviewerResponse.feedback) {
      return {
        valid: false,
        error: "Missing feedback for non-approve verdict",
        feedback: `Verdict '${reviewerResponse.verdict}' requires a 'feedback' field explaining your decision`
      };
    }

    if (reviewerResponse.verdict === "approve" && reviewerResponse.continueNext === undefined) {
      return {
        valid: false,
        error: "Missing continueNext for approve verdict",
        feedback: "Approve verdict requires 'continueNext': true if more steps remain, false if task is complete"
      };
    }

    return { valid: true, data: reviewerResponse };
  }

  const errors = formatValidationErrors(validateReviewerSchema);
  return {
    valid: false,
    error: errors,
    feedback: `JSON schema validation failed: ${errors}. Please correct your response to match the required schema.`
  };
}

/**
 * Helper to create a schema mismatch message for agents
 */
export function createSchemaMismatchMessage(agentType: "coder" | "reviewer", feedback: string): string {
  return `[SCHEMA VALIDATION ERROR]

Your response did not match the required JSON schema.

${feedback}

Please provide a new response that matches the schema exactly. Remember to output valid JSON only, with no additional text.`;
}
/**
 * Protocol Schema Definitions
 * Single source of truth for all agent communication schemas
 */

// Individual schema components for reuse
export const schemas = {
  coder: {
    planProposal: {
      type: "object",
      required: ["action", "data"],
      properties: {
        action: { const: "propose_plan" },
        data: {
          type: "object",
          required: ["description", "steps", "files"],
          properties: {
            description: {
              type: "string",
              description: "One-line summary of what will be implemented"
            },
            steps: {
              type: "array",
              items: { type: "string" },
              description: "Specific steps to implement the plan"
            },
            files: {
              type: "array",
              items: { type: "string" },
              description: "Files that will be created or modified"
            }
          }
        }
      }
    },
    complete: {
      type: "object",
      required: ["action"],
      properties: {
        action: { const: "complete" }
      },
      additionalProperties: false
    },
    implemented: {
      type: "object",
      required: ["action", "data"],
      properties: {
        action: { const: "implemented" },
        data: {
          type: "object",
          required: ["description", "filesChanged"],
          properties: {
            description: {
              type: "string",
              description: "What was actually implemented"
            },
            filesChanged: {
              type: "array",
              items: { type: "string" },
              description: "Files that were actually modified"
            }
          }
        }
      }
    }
  },

  reviewer: {
    type: "object",
    required: ["action", "verdict"],
    properties: {
      action: {
        const: "review",
        description: "Always 'review' for reviewer responses"
      },
      verdict: {
        enum: ["approve", "revise", "reject", "needs_human"],
        description: "The review decision"
      },
      feedback: {
        type: "string",
        description: "Explanation of the verdict (required for non-approve verdicts)"
      },
      continueNext: {
        type: "boolean",
        description: "For approve: true if more steps remain, false if task is complete"
      }
    },
    additionalProperties: false
  }
};

// Complete schema for Coder (combines all possible responses)
export const CODER_COMPLETE_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Coder Response Schema",
  "description": "Valid response formats for the Coder agent",
  "oneOf": [
    schemas.coder.planProposal,
    schemas.coder.complete,
    schemas.coder.implemented
  ]
};

// Complete schema for Reviewer
export const REVIEWER_COMPLETE_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Reviewer Response Schema",
  "description": "Valid response format for the Reviewer agent",
  ...schemas.reviewer
};

// Export as formatted JSON strings for injection into prompts
export const CODER_SCHEMA_JSON = JSON.stringify(CODER_COMPLETE_SCHEMA, null, 2);
export const REVIEWER_SCHEMA_JSON = JSON.stringify(REVIEWER_COMPLETE_SCHEMA, null, 2);

// TypeScript types derived from schemas
export interface CoderPlanProposal {
  action: "propose_plan";
  data: {
    description: string;
    steps: string[];
    files: string[];
  };
}

export interface CoderComplete {
  action: "complete";
}

export interface CoderImplemented {
  action: "implemented";
  data: {
    description: string;
    filesChanged: string[];
  };
}

export type CoderResponse = CoderPlanProposal | CoderComplete | CoderImplemented;

export interface ReviewerResponse {
  action: "review";
  verdict: "approve" | "revise" | "reject" | "needs_human" | "already_complete";
  feedback?: string;
  continueNext?: boolean;
}
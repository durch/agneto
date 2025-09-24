import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import type { CoderPlanProposal } from "../types.js";
import { CODER_SCHEMA_JSON, type CoderResponse } from "../protocol/schemas.js";
import { renderPrompt } from "../protocol/prompt-template.js";
import { validateCoderResponse, createSchemaMismatchMessage } from "../protocol/validators.js";
import { cleanJsonResponse } from "../utils/json-cleaner.js";

// Phase 1: Propose implementation plan (no tools)
export async function proposePlan(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    stepDescription: string,
    feedback?: string,
    sessionId?: string,
    isInitialized?: boolean,
    retryCount: number = 0
): Promise<CoderPlanProposal | null> {
    // Load and render the prompt template with schema
    const template = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");
    const sys = renderPrompt(template, { CODER_SCHEMA: CODER_SCHEMA_JSON });

    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and plan
        messages.push(
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n\n[PLANNING MODE]\n\nPropose your implementation approach for: ${stepDescription}` }
        );
    } else {
        // Subsequent calls: feedback on previous plan proposal
        const userContent = feedback
            ? `[PLANNING MODE]\n\n${feedback}\n\nPlease revise your plan proposal.`
            : `[PLANNING MODE]\n\nPropose your implementation approach for the next step.`;
        messages.push({ role: "user", content: userContent });
    }

    const response = await provider.query({
        cwd,
        mode: "default",  // Default mode for structured responses
        allowedTools: ["ReadFile", "Grep", "Bash"],  // Read-only tools for context
        sessionId,
        isInitialized,
        messages
    });

    // Parse and validate the JSON response
    try {
        const cleanedResponse = cleanJsonResponse(response);
        const parsed = JSON.parse(cleanedResponse);
        const validation = validateCoderResponse(parsed);

        if (!validation.valid) {
            // Schema mismatch - retry up to 2 times
            if (retryCount < 2) {
                const retryFeedback = createSchemaMismatchMessage("coder", validation.feedback);
                return proposePlan(
                    provider, cwd, planMd, stepDescription,
                    retryFeedback, sessionId, true, retryCount + 1
                );
            }
            console.error("Coder response validation failed after retries:", validation.feedback);
            return null;
        }

        // Check if it's a completion signal or plan proposal
        const coderResponse = validation.data;
        if (coderResponse.action === "complete") {
            // Return special proposal indicating completion
            return {
                type: "PLAN_PROPOSAL",
                description: "COMPLETE",
                steps: [],
                affectedFiles: []
            };
        } else if (coderResponse.action === "propose_plan") {
            // Convert to legacy format for now (will be updated later)
            return {
                type: "PLAN_PROPOSAL",
                description: coderResponse.data.description,
                steps: coderResponse.data.steps,
                affectedFiles: coderResponse.data.files
            };
        }

        return null;
    } catch (error) {
        console.error("Failed to parse Coder JSON response:", error);
        console.error("Response was:", response);

        // If it's a parse error and we haven't retried yet, ask for proper JSON
        if (retryCount < 2) {
            const retryFeedback = createSchemaMismatchMessage(
                "coder",
                "Your response was not valid JSON. Please respond with ONLY valid JSON matching the schema."
            );
            return proposePlan(
                provider, cwd, planMd, stepDescription,
                retryFeedback, sessionId, true, retryCount + 1
            );
        }

        return null;
    }
}

// Phase 2: Implement the approved plan (with tools)
export async function implementPlan(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    approvedPlan: CoderPlanProposal,
    feedback?: string,
    sessionId?: string,
    isInitialized?: boolean,
    retryCount: number = 0
): Promise<string> {
    // Load and render the prompt template with schema
    const template = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");
    const sys = renderPrompt(template, { CODER_SCHEMA: CODER_SCHEMA_JSON });

    const messages: Msg[] = [];

    if (!isInitialized) {
        // Should not happen - we should have initialized during planning
        messages.push(
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}` }
        );
    }

    // Implementation instruction
    const implementInstruction = feedback
        ? `[IMPLEMENTATION MODE]\n\n${feedback}\n\nPlease revise your implementation.`
        : `[IMPLEMENTATION MODE]\n\nYour plan has been approved:\n${approvedPlan.description}\n\nSteps to implement:\n${approvedPlan.steps.map((s: string) => `- ${s}`).join('\n')}\n\nProceed with implementation using file tools.`;

    messages.push({ role: "user", content: implementInstruction });

    const response = await provider.query({
        cwd,
        mode: "default",  // Implementation mode - with tools
        allowedTools: ["ReadFile", "ListDir", "Grep", "Bash", "Write", "Edit", "MultiEdit"],
        sessionId,
        isInitialized: true,  // Always true in implementation phase
        messages
    });

    // Parse and validate the JSON response
    try {
        const cleanedResponse = cleanJsonResponse(response);
        const parsed = JSON.parse(cleanedResponse);
        const validation = validateCoderResponse(parsed);

        if (!validation.valid) {
            // Schema mismatch - retry up to 2 times
            if (retryCount < 2) {
                const retryFeedback = createSchemaMismatchMessage("coder", validation.feedback);
                return implementPlan(
                    provider, cwd, planMd, approvedPlan,
                    retryFeedback, sessionId, true, retryCount + 1
                );
            }
            console.error("Coder implementation response validation failed:", validation.feedback);
            return "";
        }

        const coderResponse = validation.data;
        if (coderResponse.action === "implemented") {
            // Return formatted string for backward compatibility
            // Will update orchestrator later to handle JSON directly
            return `CODE_APPLIED: ${coderResponse.data.description}`;
        }

        return "";
    } catch (error) {
        console.error("Failed to parse Coder implementation response:", error);

        // If it's a parse error and we haven't retried yet, ask for proper JSON
        if (retryCount < 2) {
            const retryFeedback = createSchemaMismatchMessage(
                "coder",
                "Your response was not valid JSON. Please respond with ONLY valid JSON matching the schema."
            );
            return implementPlan(
                provider, cwd, planMd, approvedPlan,
                retryFeedback, sessionId, true, retryCount + 1
            );
        }

        return "";
    }
}


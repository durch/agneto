import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import type { CoderPlanProposal, ReviewerPlanVerdict, ReviewerCodeVerdict } from "../types.js";
import { REVIEWER_SCHEMA_JSON, type ReviewerResponse } from "../protocol/schemas.js";
import { renderPrompt } from "../protocol/prompt-template.js";
import { validateReviewerResponse, createSchemaMismatchMessage } from "../protocol/validators.js";
import { cleanJsonResponse } from "../utils/json-cleaner.js";

// Phase 1: Review implementation plan (no tools needed)
export async function reviewPlan(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    proposal: CoderPlanProposal,
    sessionId?: string,
    isInitialized?: boolean,
    retryCount: number = 0
): Promise<ReviewerPlanVerdict> {
    // Load and render the prompt template with schema
    const template = readFileSync(new URL("../prompts/reviewer.md", import.meta.url), "utf8");
    const sys = renderPrompt(template, { REVIEWER_SCHEMA: REVIEWER_SCHEMA_JSON });

    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and plan
        messages.push(
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n\n[PLAN REVIEW MODE]\n\nThe Coder proposes the following approach:\n\nDescription: ${proposal.description}\n\nSteps:\n${proposal.steps.map(s => `- ${s}`).join('\n')}\n\nAffected Files:\n${proposal.affectedFiles.map(f => `- ${f}`).join('\n')}\n\nReview this approach.` }
        );
    } else {
        // Subsequent calls: reviewing revised plan
        messages.push({ role: "user", content: `[PLAN REVIEW MODE]\n\nThe Coder has revised their approach:\n\nDescription: ${proposal.description}\n\nSteps:\n${proposal.steps.map(s => `- ${s}`).join('\n')}\n\nAffected Files:\n${proposal.affectedFiles.map(f => `- ${f}`).join('\n')}\n\nReview this revised approach.` });
    }

    const res = await provider.query({
        cwd,
        mode: "default",  // Reviewer always needs tools to verify things
        allowedTools: ["ReadFile", "Grep", "Bash"],
        sessionId,
        isInitialized,
        messages
    });

    // Parse and validate the JSON response
    try {
        const cleanedResponse = cleanJsonResponse(res);
        const parsed = JSON.parse(cleanedResponse);
        const validation = validateReviewerResponse(parsed);

        if (!validation.valid) {
            // Schema mismatch - retry up to 2 times
            if (retryCount < 2) {
                const retryFeedback = createSchemaMismatchMessage("reviewer", validation.feedback);
                // Send retry request
                const retryMessages: Msg[] = [{ role: "user", content: retryFeedback }];
                const retryRes = await provider.query({
                    cwd,
                    mode: "default",
                    allowedTools: ["ReadFile", "Grep", "Bash"],
                    sessionId,
                    isInitialized: true,
                    messages: retryMessages
                });

                // Try parsing retry response
                return parseReviewerResponseToLegacy(retryRes, "plan", retryCount + 1,
                    provider, cwd, planMd, proposal, sessionId);
            }
            console.error("Reviewer response validation failed after retries:", validation.feedback);
            console.error("Raw response was:", res);
            console.error("Parsed response was:", parsed);
            return { type: "PLAN_VERDICT", verdict: "needs-human", feedback: validation.feedback || "Invalid response format" };
        }

        // Convert to legacy format
        const reviewerResponse = validation.data;
        return convertToLegacyPlanVerdict(reviewerResponse);
    } catch (error) {
        console.error("Failed to parse Reviewer JSON response:", error);
        console.error("Raw response was:", res);

        // If parse error and haven't retried, ask for proper JSON
        if (retryCount < 2) {
            const retryFeedback = createSchemaMismatchMessage(
                "reviewer",
                "Your response was not valid JSON. Please respond with ONLY valid JSON matching the schema."
            );
            // Recursive retry
            const retryMessages: Msg[] = [{ role: "user", content: retryFeedback }];
            const retryRes = await provider.query({
                cwd,
                mode: "default",
                allowedTools: ["ReadFile", "Grep", "Bash"],
                sessionId,
                isInitialized: true,
                messages: retryMessages
            });

            return parseReviewerResponseToLegacy(retryRes, "plan", retryCount + 1,
                provider, cwd, planMd, proposal, sessionId);
        }

        return { type: "PLAN_VERDICT", verdict: "needs-human", feedback: "Failed to parse response" };
    }
}

// Helper for recursive retries on plan review
async function parseReviewerResponseToLegacy(
    response: string,
    mode: "plan",
    retryCount: number,
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    proposal: CoderPlanProposal,
    sessionId?: string
): Promise<ReviewerPlanVerdict>

async function parseReviewerResponseToLegacy(
    response: string,
    mode: "code",
    retryCount: number,
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    changeDesc: string,
    sessionId?: string
): Promise<ReviewerCodeVerdict>

async function parseReviewerResponseToLegacy(
    response: string,
    mode: "plan" | "code",
    retryCount: number,
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    proposalOrDesc: CoderPlanProposal | string,
    sessionId?: string
): Promise<ReviewerPlanVerdict | ReviewerCodeVerdict> {
    try {
        const parsed = JSON.parse(response);
        const validation = validateReviewerResponse(parsed);

        if (validation.valid) {
            const reviewerResponse = validation.data;
            if (mode === "plan") {
                return convertToLegacyPlanVerdict(reviewerResponse);
            } else {
                return convertToLegacyCodeVerdict(reviewerResponse);
            }
        }
    } catch (e) {
        // Continue to error handling
    }

    if (mode === "plan") {
        return { type: "PLAN_VERDICT", verdict: "needs-human", feedback: "Invalid response" };
    } else {
        return { type: "CODE_VERDICT", verdict: "needs-human", feedback: "Invalid response" };
    }
}

// Convert new JSON format to legacy format
function convertToLegacyPlanVerdict(response: ReviewerResponse): ReviewerPlanVerdict {
    // Map verdict values for plan review
    let legacyVerdict: ReviewerPlanVerdict["verdict"] = "needs-human";

    switch(response.verdict) {
        case "approve":
            legacyVerdict = "approve-plan";
            break;
        case "revise":
            legacyVerdict = "revise-plan";
            break;
        case "reject":
            legacyVerdict = "reject-plan";
            break;
        case "needs_human":
            legacyVerdict = "needs-human";
            break;
    }

    return {
        type: "PLAN_VERDICT",
        verdict: legacyVerdict,
        feedback: response.feedback
    };
}

// Phase 2: Review actual code changes (with git tools)
export async function reviewCode(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    changeDescription: string,
    sessionId?: string,
    isInitialized?: boolean,
    retryCount: number = 0
): Promise<ReviewerCodeVerdict> {
    // Load and render the prompt template with schema
    const template = readFileSync(new URL("../prompts/reviewer.md", import.meta.url), "utf8");
    const sys = renderPrompt(template, { REVIEWER_SCHEMA: REVIEWER_SCHEMA_JSON });

    const messages: Msg[] = [];

    if (!isInitialized) {
        // Should not happen - we should have initialized during planning
        messages.push(
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}` }
        );
    }

    // Code review instruction
    messages.push({ role: "user", content: `[CODE REVIEW MODE]\n\nThe Coder has implemented changes: "${changeDescription}"\n\nUse git diff HEAD to review the actual changes.` });

    const res = await provider.query({
        cwd,
        mode: "default",  // Need tools for git diff
        allowedTools: ["ReadFile", "Grep", "Bash"],
        sessionId,
        isInitialized: true,  // Always true in implementation phase
        messages
    });

    // Parse and validate the JSON response
    try {
        const cleanedResponse = cleanJsonResponse(res);
        const parsed = JSON.parse(cleanedResponse);
        const validation = validateReviewerResponse(parsed);

        if (!validation.valid) {
            // Schema mismatch - retry up to 2 times
            if (retryCount < 2) {
                const retryFeedback = createSchemaMismatchMessage("reviewer", validation.feedback);
                const retryMessages: Msg[] = [{ role: "user", content: retryFeedback }];
                const retryRes = await provider.query({
                    cwd,
                    mode: "default",
                    allowedTools: ["ReadFile", "Grep", "Bash"],
                    sessionId,
                    isInitialized: true,
                    messages: retryMessages
                });

                // Try parsing retry response
                return parseReviewerResponseToLegacy(retryRes, "code", retryCount + 1,
                    provider, cwd, planMd, changeDescription, sessionId);
            }
            console.error("Reviewer code review validation failed:", validation.feedback);
            return { type: "CODE_VERDICT", verdict: "needs-human", feedback: "Invalid response format" };
        }

        // Convert to legacy format
        const reviewerResponse = validation.data;
        return convertToLegacyCodeVerdict(reviewerResponse);
    } catch (error) {
        console.error("Failed to parse Reviewer code review JSON:", error);

        // If parse error and haven't retried, ask for proper JSON
        if (retryCount < 2) {
            const retryFeedback = createSchemaMismatchMessage(
                "reviewer",
                "Your response was not valid JSON. Please respond with ONLY valid JSON matching the schema."
            );
            const retryMessages: Msg[] = [{ role: "user", content: retryFeedback }];
            const retryRes = await provider.query({
                cwd,
                mode: "default",
                allowedTools: ["ReadFile", "Grep", "Bash"],
                sessionId,
                isInitialized: true,
                messages: retryMessages
            });

            return parseReviewerResponseToLegacy(retryRes, "code", retryCount + 1,
                provider, cwd, planMd, changeDescription, sessionId);
        }

        return { type: "CODE_VERDICT", verdict: "needs-human", feedback: "Failed to parse response" };
    }
}

// Convert new JSON format to legacy code verdict format
function convertToLegacyCodeVerdict(response: ReviewerResponse): ReviewerCodeVerdict {
    // Map verdict values for code review
    let legacyVerdict: ReviewerCodeVerdict["verdict"] = "needs-human";

    if (response.verdict === "approve") {
        // Check continueNext to differentiate between step-complete and task-complete
        if (response.continueNext === true) {
            legacyVerdict = "step-complete";
        } else if (response.continueNext === false) {
            legacyVerdict = "task-complete";
        } else {
            // Default to approve-code if continueNext not specified
            legacyVerdict = "approve-code";
        }
    } else {
        switch(response.verdict) {
            case "revise":
                legacyVerdict = "revise-code";
                break;
            case "reject":
                legacyVerdict = "reject-code";
                break;
            case "needs_human":
                legacyVerdict = "needs-human";
                break;
        }
    }

    return {
        type: "CODE_VERDICT",
        verdict: legacyVerdict,
        feedback: response.feedback
    };
}


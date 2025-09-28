import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import type { CoderPlanProposal, ReviewerPlanVerdict, ReviewerCodeVerdict } from "../types.js";
import { interpretReviewerResponse, convertReviewerInterpretation } from "../protocol/interpreter.js";
import { log } from "../ui/log.js";

const DEBUG = process.env.DEBUG === "true";

// Phase 1: Review implementation plan (no tools needed)
export async function reviewPlan(
    provider: LLMProvider,
    cwd: string,
    chunkContext: { description: string; requirements: string[]; context: string; },
    proposal: CoderPlanProposal,
    sessionId?: string,
    isInitialized?: boolean
): Promise<ReviewerPlanVerdict> {
    // Load the natural language prompt (no schema injection)
    const template = readFileSync(new URL("../prompts/reviewer.md", import.meta.url), "utf8");

    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and chunk requirements
        messages.push(
            { role: "system", content: template },
            { role: "user", content: `Current Work Chunk:\n\nDescription: ${chunkContext.description}\n\nRequirements:\n${chunkContext.requirements.map(r => `- ${r}`).join('\n')}\n\nContext: ${chunkContext.context}\n\n[PLAN REVIEW MODE]\n\nThe Coder proposes the following approach:\n\nDescription: ${proposal.description}\n\nSteps:\n${proposal.steps.map(s => `- ${s}`).join('\n')}\n\nAffected Files:\n${proposal.affectedFiles.map(f => `- ${f}`).join('\n')}\n\nReview this approach against the chunk requirements above.` }
        );
    } else {
        // Subsequent calls: reviewing revised plan
        messages.push({ role: "user", content: `[PLAN REVIEW MODE]\n\nThe Coder has revised their approach:\n\nDescription: ${proposal.description}\n\nSteps:\n${proposal.steps.map(s => `- ${s}`).join('\n')}\n\nAffected Files:\n${proposal.affectedFiles.map(f => `- ${f}`).join('\n')}\n\nReview this revised approach against the current work chunk requirements.` });
    }

    if (!isInitialized) {
        log.startStreaming("Reviewer");
    }

    const rawResponse = await provider.query({
        cwd,
        mode: "default",  // Reviewer always needs tools to verify things
        allowedTools: ["ReadFile", "Grep", "Bash"],
        sessionId,
        isInitialized,
        messages,
        callbacks: {
            onProgress: log.streamProgress,
            onToolUse: (tool, input) => log.toolUse("Reviewer", tool, input),
            onToolResult: (isError) => log.toolResult("Reviewer", isError),
            onComplete: (cost, duration) => log.complete("Reviewer", cost, duration)
        }
    });

    // Log the raw response for debugging
    if (DEBUG) {
        log.review(`Raw plan review response: ${rawResponse}`);
    }

    // Interpret the natural language response
    const interpretation = await interpretReviewerResponse(provider, rawResponse, cwd);
    if (!interpretation) {
        console.error("Failed to interpret Reviewer plan response:", rawResponse);
        return { type: "PLAN_VERDICT", verdict: "needs-human", feedback: "Failed to interpret response" };
    }

    // Log the interpreted decision
    log.review(`Interpreted plan review as: ${interpretation.verdict} - ${interpretation.feedback}`);

    // Convert to legacy format for orchestrator compatibility
    return convertToLegacyPlanVerdict(interpretation);
}


// Convert interpreted response to legacy plan verdict format
function convertToLegacyPlanVerdict(interpretation: any): ReviewerPlanVerdict {
    // Map verdict values for plan review
    let legacyVerdict: ReviewerPlanVerdict["verdict"] = "needs-human";

    switch(interpretation.verdict) {
        case "approve":
            legacyVerdict = "approve-plan";
            break;
        case "already_complete":
            legacyVerdict = "already-complete";
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
        feedback: interpretation.feedback || ""
    };
}

// Phase 2: Review actual code changes (with git tools)
export async function reviewCode(
    provider: LLMProvider,
    cwd: string,
    chunkContext: { description: string; requirements: string[]; context: string; } | null,
    changeDescription: string,
    sessionId?: string,
    isInitialized?: boolean
): Promise<ReviewerCodeVerdict> {
    // Load the natural language prompt (no schema injection)
    const template = readFileSync(new URL("../prompts/reviewer.md", import.meta.url), "utf8");

    const messages: Msg[] = [];

    if (!isInitialized) {
        // Should not happen - we should have initialized during planning
        messages.push(
            { role: "system", content: template },
            { role: "user", content: chunkContext ? `Current Work Chunk:\n\nDescription: ${chunkContext.description}\n\nRequirements:\n${chunkContext.requirements.map(r => `- ${r}`).join('\n')}\n\nContext: ${chunkContext.context}` : `No chunk context available` }
        );
    }

    // Code review instruction
    messages.push({ role: "user", content: `[CODE REVIEW MODE]\n\nThe Coder has implemented changes: "${changeDescription}"\n\nUse git diff HEAD to review the actual changes against the current work chunk requirements.` });

    if (!sessionId || !isInitialized) {
        log.startStreaming("Reviewer");
    }

    const rawResponse = await provider.query({
        cwd,
        mode: "default",  // Need tools for git diff
        allowedTools: ["ReadFile", "Grep", "Bash"],
        sessionId,
        isInitialized: true,  // Always true in implementation phase
        messages,
        callbacks: {
            onProgress: log.streamProgress,
            onToolUse: (tool, input) => log.toolUse("Reviewer", tool, input),
            onToolResult: (isError) => log.toolResult("Reviewer", isError),
            onComplete: (cost, duration) => log.complete("Reviewer", cost, duration)
        }
    });

    // Log the raw response for debugging
    if (DEBUG) {
        log.review(`Raw code review response: ${rawResponse}`);
    }

    // Interpret the natural language response
    const interpretation = await interpretReviewerResponse(provider, rawResponse, cwd);
    if (!interpretation) {
        console.error("Failed to interpret Reviewer code response:", rawResponse);
        return { type: "CODE_VERDICT", verdict: "needs-human", feedback: "Failed to interpret response" };
    }

    // Log the interpreted decision
    log.review(`Interpreted code review as: ${interpretation.verdict} - ${interpretation.feedback}`);

    // Convert to legacy format for orchestrator compatibility
    return convertToLegacyCodeVerdict(interpretation);
}

// Convert interpreted response to legacy code verdict format
function convertToLegacyCodeVerdict(interpretation: any): ReviewerCodeVerdict {
    // Map verdict values for code review
    let legacyVerdict: ReviewerCodeVerdict["verdict"] = "needs-human";

    if (interpretation.verdict === "approve") {
        // Check continueNext to differentiate between step-complete and task-complete
        if (interpretation.continueNext === true) {
            legacyVerdict = "step-complete";
        } else if (interpretation.continueNext === false) {
            legacyVerdict = "task-complete";
        } else {
            // Default to approve-code if continueNext not specified
            legacyVerdict = "approve-code";
        }
    } else if (interpretation.verdict === "already_complete") {
        legacyVerdict = "task-complete";
    } else {
        switch(interpretation.verdict) {
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
        feedback: interpretation.feedback || ""
    };
}


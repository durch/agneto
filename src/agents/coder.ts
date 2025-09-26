import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import type { CoderPlanProposal } from "../types.js";
import { log } from "../ui/log.js";

// Phase 1: Propose implementation plan (no tools)
export async function proposePlan(
    provider: LLMProvider,
    cwd: string,
    stepDescription: string,
    feedback?: string,
    sessionId?: string,
    isInitialized?: boolean
): Promise<CoderPlanProposal | null> {
    // Load the natural language prompt (no schema injection)
    const template = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");

    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and chunk
        messages.push(
            { role: "system", content: template },
            { role: "user", content: `[PLANNING MODE]\n\nPropose your implementation approach for: ${stepDescription}` }
        );
    } else {
        // Subsequent calls: feedback on previous plan proposal
        const userContent = feedback
            ? `[PLANNING MODE]\n\n${feedback}\n\nPlease revise your plan proposal.`
            : `[PLANNING MODE]\n\nPropose your implementation approach for the next step.`;
        messages.push({ role: "user", content: userContent });
    }

    if (!isInitialized) {
        log.startStreaming("Coder");
    }

    const rawResponse = await provider.query({
        cwd,
        mode: "default",  // Default mode for natural responses
        allowedTools: ["ReadFile", "Grep", "Bash"],  // Read-only tools for context
        sessionId,
        isInitialized,
        messages,
        callbacks: {
            onProgress: log.streamProgress,
            onToolUse: (tool, input) => log.toolUse("Coder", tool, input),
            onToolResult: (isError) => log.toolResult("Coder", isError),
            onComplete: (cost, duration) => log.complete("Coder", cost, duration)
        }
    });

    // Log the raw response for debugging
    log.coder(`Raw response: ${rawResponse}`);

    // Return the raw response as a proposal - no interpretation needed
    // The reviewer will handle whatever the coder said
    if (!rawResponse || rawResponse.trim() === "") {
        // Handle empty response case
        return {
            type: "PLAN_PROPOSAL",
            description: "No changes needed for this chunk",
            steps: [],
            affectedFiles: []
        };
    }

    // Extract a simple description from the first substantial line
    const lines = rawResponse.split('\n').filter(line => line.trim());
    const description = lines[0] || "Implementation approach";

    // Return as proposal for reviewer to evaluate
    return {
        type: "PLAN_PROPOSAL",
        description: description,
        steps: lines.slice(1).filter(line => line.trim()).slice(0, 5), // Take up to 5 lines as steps
        affectedFiles: []
    };
}

// Phase 2: Implement the approved plan (with tools)
export async function implementPlan(
    provider: LLMProvider,
    cwd: string,
    approvedPlan: CoderPlanProposal,
    feedback?: string,
    sessionId?: string,
    isInitialized?: boolean
): Promise<string> {
    // Load the natural language prompt (no schema injection)
    const template = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");

    const messages: Msg[] = [];

    if (!isInitialized) {
        // Should not happen - we should have initialized during planning
        messages.push(
            { role: "system", content: template }
        );
    }

    // Implementation instruction
    const implementInstruction = feedback
        ? `[IMPLEMENTATION MODE]\n\n${feedback}\n\nPlease revise your implementation.`
        : `[IMPLEMENTATION MODE]\n\nYour plan has been approved:\n${approvedPlan.description}\n\nSteps to implement:\n${approvedPlan.steps.map((s: string) => `- ${s}`).join('\n')}\n\nProceed with implementation using file tools.`;

    messages.push({ role: "user", content: implementInstruction });

    // Show streaming for implementation (tools will be visible)
    if (!sessionId || !isInitialized) {
        log.startStreaming("Coder");
    }

    const rawResponse = await provider.query({
        cwd,
        mode: "acceptEdits",  // acceptEdits mode required for Write/Edit/MultiEdit tools
        allowedTools: ["ReadFile", "ListDir", "Grep", "Bash", "Write", "Edit", "MultiEdit"],
        sessionId,
        isInitialized: true,  // Always true in implementation phase
        messages,
        callbacks: {
            onProgress: log.streamProgress,
            onToolUse: (tool, input) => log.toolUse("Coder", tool, input),
            onToolResult: (isError) => log.toolResult("Coder", isError),
            onComplete: (cost, duration) => log.complete("Coder", cost, duration)
        }
    });

    // Log the raw response for debugging
    log.coder(`Raw implementation response: ${rawResponse}`);

    // Return a simple description of what was done
    // The orchestrator expects "CODE_APPLIED:" prefix to know changes were made
    if (rawResponse && rawResponse.trim()) {
        // Extract first line as summary of what was done
        const firstLine = rawResponse.split('\n')[0] || 'Changes applied';
        return `CODE_APPLIED: ${firstLine}`;
    }

    // No response means no changes were needed
    return "";
}


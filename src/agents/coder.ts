import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import type { CoderPlanProposal } from "../types.js";
import { log } from "../ui/log.js";
import { summarizeToolParams } from "../utils/tool-summary.js";
import type { CoderReviewerStateMachine } from "../state-machine.js";

const DEBUG = process.env.DEBUG === "true";

// Phase 1: Propose implementation plan (no tools)
export async function proposePlan(
    provider: LLMProvider,
    cwd: string,
    stepDescription: string,
    feedback?: string,
    sessionId?: string,
    isInitialized?: boolean,
    stateMachine?: CoderReviewerStateMachine,
    taskStateMachine?: any
): Promise<CoderPlanProposal | null> {
    // Load the natural language prompt (no schema injection)
    let sys = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");

    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and chunk
        const customPrompt = taskStateMachine?.getAgentPromptConfig?.('coder');
        if (customPrompt) {
            sys += `\n\n## Custom Instructions\n\n${customPrompt}`;
            log.coder("🤖 Coder: Using custom prompt from .agneto.json");
        }

        messages.push(
            { role: "system", content: sys },
            { role: "user", content: `Current Work Chunk:\n\n${stepDescription}\n\n[PLANNING MODE]\n\nPropose your implementation approach for this chunk.` }
        );
    } else {
        // Subsequent calls: feedback on previous plan proposal
        const userContent = feedback
            ? `[PLANNING MODE]\n\n${feedback}\n\nPlease revise your plan proposal based on this feedback.`
            : `[PLANNING MODE]\n\nThe chunk requirements remain the same. Propose your implementation approach.`;
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
            onToolUse: (tool, input) => {
                log.toolUse("Coder", tool, input);
                if (stateMachine) {
                    stateMachine.setToolStatus("Coder", tool, summarizeToolParams(tool, input));
                }
            },
            onToolResult: (isError) => {
                log.toolResult("Coder", isError);
                if (stateMachine) {
                    stateMachine.clearToolStatus();
                }
            },
            onComplete: (cost, duration) => log.complete("Coder", cost, duration)
        },
        taskStateMachine,
    });

    // Always display the full plan proposal response (will be pretty printed)
    if (rawResponse && rawResponse.trim()) {
        log.coder(rawResponse);
    }

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

    // Pass the FULL response to the reviewer - don't truncate!
    return {
        type: "PLAN_PROPOSAL",
        description: rawResponse, // Full response, not just first line
        steps: [], // Not needed when description has everything
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
    isInitialized?: boolean,
    stateMachine?: CoderReviewerStateMachine,
    taskStateMachine?: any
): Promise<string> {
    // Load the natural language prompt (no schema injection)
    let sys = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");

    const messages: Msg[] = [];

    if (!isInitialized) {
        // Should not happen - we should have initialized during planning
        const customPrompt = taskStateMachine?.getAgentPromptConfig?.('coder');
        if (customPrompt) {
            sys += `\n\n## Custom Instructions\n\n${customPrompt}`;
            log.coder("🤖 Coder: Using custom prompt from .agneto.json");
        }

        messages.push(
            { role: "system", content: sys }
        );
    }

    // Implementation instruction
    const implementInstruction = feedback
        ? `[IMPLEMENTATION MODE]\n\nReviewer feedback:\n${feedback}\n\nPlease revise your implementation to address this feedback.`
        : `[IMPLEMENTATION MODE]\n\nYour implementation plan has been approved. Proceed with implementing the current work chunk using file tools.`;

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
            onToolUse: (tool, input) => {
                log.toolUse("Coder", tool, input);
                if (stateMachine) {
                    stateMachine.setToolStatus("Coder", tool, summarizeToolParams(tool, input));
                }
            },
            onToolResult: (isError) => {
                log.toolResult("Coder", isError);
                if (stateMachine) {
                    stateMachine.clearToolStatus();
                }
            },
            onComplete: (cost, duration) => log.complete("Coder", cost, duration)
        },
        taskStateMachine,
    });

    // Always display the full implementation response
    if (rawResponse && rawResponse.trim()) {
        log.coder(rawResponse);

        // Extract first line as summary for orchestrator tracking
        const firstLine = rawResponse.split('\n')[0] || 'Changes applied';
        return `CODE_APPLIED: ${firstLine}`;
    }

    // No response means no changes were needed
    return "";
}


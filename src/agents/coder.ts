import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import type { CoderPlanProposal } from "../types.js";
import { interpretCoderResponse, convertCoderInterpretation } from "../protocol/interpreter.js";
import { log } from "../ui/log.js";

// Phase 1: Propose implementation plan (no tools)
export async function proposePlan(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    stepDescription: string,
    feedback?: string,
    sessionId?: string,
    isInitialized?: boolean
): Promise<CoderPlanProposal | null> {
    // Load the natural language prompt (no schema injection)
    const template = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");

    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and plan
        messages.push(
            { role: "system", content: template },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n\n[PLANNING MODE]\n\nPropose your implementation approach for: ${stepDescription}` }
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

    // Interpret the natural language response
    const interpretation = await interpretCoderResponse(provider, rawResponse, cwd);
    if (!interpretation) {
        console.error("Failed to interpret Coder response:", rawResponse);
        return null;
    }

    // Log the interpreted decision
    log.coder(`Interpreted as: ${interpretation.action} - ${interpretation.description || 'No description'}`);

    // Convert to legacy format for orchestrator compatibility
    if (interpretation.action === "complete") {
        return {
            type: "PLAN_PROPOSAL",
            description: "COMPLETE",
            steps: [],
            affectedFiles: []
        };
    } else if (interpretation.action === "continue") {
        return {
            type: "PLAN_PROPOSAL",
            description: interpretation.description || "Continue with next step",
            steps: interpretation.steps || [],
            affectedFiles: interpretation.files || []
        };
    }

    return null;
}

// Phase 2: Implement the approved plan (with tools)
export async function implementPlan(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
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
            { role: "system", content: template },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}` }
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
        mode: "default",  // Implementation mode - with tools
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

    // Interpret the natural language response
    const interpretation = await interpretCoderResponse(provider, rawResponse, cwd);
    if (!interpretation) {
        console.error("Failed to interpret Coder implementation response:", rawResponse);
        return "";
    }

    // Log the interpreted decision
    log.coder(`Interpreted as: ${interpretation.action} - ${interpretation.description || 'No description'}`);

    if (interpretation.action === "implemented") {
        // Return formatted string for backward compatibility
        // Will update orchestrator later to handle JSON directly
        return `CODE_APPLIED: ${interpretation.description || 'Changes applied'}`;
    }

    return "";
}


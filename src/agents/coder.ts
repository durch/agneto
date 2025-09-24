import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import type { CoderPlanProposal } from "../types.js";

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
    const sys = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");

    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and plan
        messages.push(
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n\n[PLANNING MODE]\n\nPropose your implementation approach for: ${stepDescription}\n\nProvide a PLAN_PROPOSAL with:\n- Description of your approach\n- Specific steps you'll take\n- Files you'll modify or create` }
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
        mode: "plan",  // Planning mode - no tools
        sessionId,
        isInitialized,
        messages
    });

    // Parse the response to extract plan proposal
    return parsePlanProposal(response);
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
    const sys = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");

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
        : `[IMPLEMENTATION MODE]\n\nYour plan has been approved:\n${approvedPlan.description}\n\nSteps to implement:\n${approvedPlan.steps.map(s => `- ${s}`).join('\n')}\n\nProceed with implementation using file tools. After making changes, respond with:\nCODE_APPLIED: <description of what you implemented>`;

    messages.push({ role: "user", content: implementInstruction });

    const response = await provider.query({
        cwd,
        mode: "default",  // Implementation mode - with tools
        allowedTools: ["ReadFile", "ListDir", "Grep", "Bash", "Write", "Edit", "MultiEdit"],
        sessionId,
        isInitialized: true,  // Always true in implementation phase
        messages
    });

    return response;
}


// Helper function to parse plan proposal from Coder response
function parsePlanProposal(response: string): CoderPlanProposal | null {
    const lines = response.trim().split('\n');

    // Check for completion signal
    if (response.includes('COMPLETE') && !response.includes('PLAN_PROPOSAL')) {
        // Return a special proposal indicating completion
        return {
            type: "PLAN_PROPOSAL",
            description: "COMPLETE",
            steps: [],
            affectedFiles: []
        };
    }

    // Look for PLAN_PROPOSAL marker
    const proposalIndex = lines.findIndex(line => line.includes('PLAN_PROPOSAL'));
    if (proposalIndex === -1) return null;

    // Extract the structured content
    const proposal: CoderPlanProposal = {
        type: "PLAN_PROPOSAL",
        description: "",
        steps: [],
        affectedFiles: []
    };

    let currentSection = "";
    for (let i = proposalIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('Description:') || line.startsWith('Approach:')) {
            currentSection = "description";
            proposal.description = line.split(':').slice(1).join(':').trim();
        } else if (line.startsWith('Steps:')) {
            currentSection = "steps";
        } else if (line.startsWith('Files:') || line.startsWith('Affected Files:')) {
            currentSection = "files";
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            const item = line.substring(2).trim();
            if (currentSection === "steps") {
                proposal.steps.push(item);
            } else if (currentSection === "files") {
                proposal.affectedFiles.push(item);
            }
        } else if (currentSection === "description" && line) {
            proposal.description += " " + line;
        }
    }

    // If we couldn't parse structured format, try to extract from free text
    if (!proposal.description && !proposal.steps.length) {
        proposal.description = response.trim();
        // Try to extract file mentions
        const fileMatches = response.matchAll(/(?:src\/[\w\/-]+\.\w+)|(?:[\w-]+\.\w+)/g);
        for (const match of fileMatches) {
            if (!proposal.affectedFiles.includes(match[0])) {
                proposal.affectedFiles.push(match[0]);
            }
        }
    }

    return proposal;
}

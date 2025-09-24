import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import type { CoderPlanProposal, ReviewerPlanVerdict, ReviewerCodeVerdict } from "../types.js";

// Phase 1: Review implementation plan (no tools needed)
export async function reviewPlan(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    proposal: CoderPlanProposal,
    sessionId?: string,
    isInitialized?: boolean
): Promise<ReviewerPlanVerdict> {
    const sys = readFileSync(new URL("../prompts/reviewer.md", import.meta.url), "utf8");

    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and plan
        messages.push(
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n\n[PLAN REVIEW MODE]\n\nThe Coder proposes the following approach:\n\nDescription: ${proposal.description}\n\nSteps:\n${proposal.steps.map(s => `- ${s}`).join('\n')}\n\nAffected Files:\n${proposal.affectedFiles.map(f => `- ${f}`).join('\n')}\n\nReview this approach and respond with ONE of:\n📋 approve-plan - approach is sound\n🔧 revise-plan - needs adjustments (provide feedback)\n❌ reject-plan - fundamentally wrong approach` }
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

    return parsePlanVerdict(res);
}

// Phase 2: Review actual code changes (with git tools)
export async function reviewCode(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    changeDescription: string,
    sessionId?: string,
    isInitialized?: boolean
): Promise<ReviewerCodeVerdict> {
    const sys = readFileSync(new URL("../prompts/reviewer.md", import.meta.url), "utf8");

    const messages: Msg[] = [];

    if (!isInitialized) {
        // Should not happen - we should have initialized during planning
        messages.push(
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}` }
        );
    }

    // Code review instruction
    messages.push({ role: "user", content: `[CODE REVIEW MODE]\n\nThe Coder has implemented changes: "${changeDescription}"\n\nUse git diff HEAD to review the actual changes, then respond with ONE of:\n✅ approve-code - implementation is correct\n✏️ revise-code - needs fixes (provide feedback)\n🔴 reject-code - wrong implementation\n🟡 needs-human - requires human review\n✨ step-complete - this step is done, more steps remain\n🎉 task-complete - all plan items are implemented` });

    const res = await provider.query({
        cwd,
        mode: "default",  // Need tools for git diff
        allowedTools: ["ReadFile", "Grep", "Bash"],
        sessionId,
        isInitialized: true,  // Always true in implementation phase
        messages
    });

    return parseCodeVerdict(res);
}


// Helper to parse plan review verdict
function parsePlanVerdict(response: string): ReviewerPlanVerdict {
    const lines = response.trim().split('\n');
    const firstLine = lines[0].trim();

    let verdict: ReviewerPlanVerdict['verdict'] = 'revise-plan';
    if (firstLine.includes('approve-plan') || firstLine.includes('📋')) {
        verdict = 'approve-plan';
    } else if (firstLine.includes('reject-plan') || firstLine.includes('❌')) {
        verdict = 'reject-plan';
    } else if (firstLine.includes('revise-plan') || firstLine.includes('🔧')) {
        verdict = 'revise-plan';
    } else if (firstLine.includes('needs-human') || firstLine.includes('🟡')) {
        verdict = 'needs-human';
    }

    // Extract feedback if present
    const feedback = lines.slice(1).join('\n').trim() ||
                    firstLine.split('-').slice(1).join('-').trim();

    return {
        type: "PLAN_VERDICT",
        verdict,
        feedback: feedback || undefined
    };
}

// Helper to parse code review verdict
function parseCodeVerdict(response: string): ReviewerCodeVerdict {
    const lines = response.trim().split('\n');
    const firstLine = lines[0].trim();

    let verdict: ReviewerCodeVerdict['verdict'] = 'revise-code';
    if (firstLine.includes('approve-code') || firstLine.startsWith('✅')) {
        verdict = 'approve-code';
    } else if (firstLine.includes('reject-code') || firstLine.startsWith('🔴')) {
        verdict = 'reject-code';
    } else if (firstLine.includes('revise-code') || firstLine.startsWith('✏️')) {
        verdict = 'revise-code';
    } else if (firstLine.includes('step-complete') || firstLine.startsWith('✨')) {
        verdict = 'step-complete';
    } else if (firstLine.includes('task-complete') || firstLine.startsWith('🎉')) {
        verdict = 'task-complete';
    } else if (firstLine.includes('needs-human') || firstLine.startsWith('🟡')) {
        verdict = 'needs-human';
    }

    // Extract feedback if present
    const feedback = lines.slice(1).join('\n').trim() ||
                    firstLine.split('-').slice(1).join('-').trim();

    return {
        type: "CODE_VERDICT",
        verdict,
        feedback: feedback || undefined
    };
}

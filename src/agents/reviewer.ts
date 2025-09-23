import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";

export type Verdict = "approve" | "needs-human" | "reject" | "revise";
export function parseVerdict(line: string): Verdict {
    if (line.startsWith("✅")) return "approve";
    if (line.startsWith("🟡")) return "needs-human";
    if (line.startsWith("🔴")) return "reject";
    return "revise";
}

export async function reviewProposal(provider: LLMProvider, cwd: string, planMd: string, proposal: string, sessionId?: string, isInitialized?: boolean) {
    // AIDEV-NOTE: Reviewer needs read tools to prevent duplicate approvals
    const sys = readFileSync(new URL("../prompts/reviewer.md", import.meta.url), "utf8");

    // AIDEV-NOTE: Semi-stateful session - system prompt only sent on first call
    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and plan
        messages.push(
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n\nReview this proposal:\n${proposal}\n\nReturn one line.` }
        );
    } else {
        // Subsequent calls: just new proposal to review (session maintains context)
        messages.push({ role: "user", content: `Review this proposal:\n${proposal}\n\nReturn one line.` });
    }

    const res = await provider.query({
        cwd,
        mode: "default", // Changed from "plan" to allow read tools
        allowedTools: ["ReadFile", "Grep", "Bash"], // Need Bash for git diff
        sessionId,       // AIDEV-NOTE: Separate session for reviewer continuity
        messages
    });
    return res.trim().split("\n")[0];
}

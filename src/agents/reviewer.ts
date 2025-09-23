import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";

export type Verdict = "approve" | "needs-human" | "reject" | "revise";
export function parseVerdict(line: string): Verdict {
    if (line.startsWith("✅")) return "approve";
    if (line.startsWith("🟡")) return "needs-human";
    if (line.startsWith("🔴")) return "reject";
    return "revise";
}

export async function reviewProposal(provider: LLMProvider, cwd: string, planMd: string, changeDescription: string, sessionId?: string, isInitialized?: boolean) {
    // AIDEV-NOTE: Reviewer needs read tools and git access to review actual changes
    const sys = readFileSync(new URL("../prompts/reviewer.md", import.meta.url), "utf8");

    // AIDEV-NOTE: Semi-stateful session - system prompt only sent on first call
    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and plan
        messages.push(
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n\nThe Coder has made changes. They report: "${changeDescription}"\n\nUse git diff to review the actual changes, then return one line with your verdict.` }
        );
    } else {
        // Subsequent calls: just new changes to review (session maintains context)
        messages.push({ role: "user", content: `The Coder has made changes. They report: "${changeDescription}"\n\nUse git diff to review the actual changes, then return one line with your verdict.` });
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

import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";

export type Verdict = "approve" | "needs-human" | "reject" | "revise";
export function parseVerdict(line: string): Verdict {
    if (line.startsWith("✅")) return "approve";
    if (line.startsWith("🟡")) return "needs-human";
    if (line.startsWith("🔴")) return "reject";
    return "revise";
}

export async function reviewProposal(provider: LLMProvider, cwd: string, planMd: string, proposal: string) {
    const sys = readFileSync(new URL("../prompts/reviewer.md", import.meta.url), "utf8");
    const res = await provider.query({
        cwd,
        mode: "plan", // Reviewer runs read-only
        messages: [
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n\nReview this proposal:\n${proposal}\n\nReturn one line.` }
        ]
    });
    return res.trim().split("\n")[0];
}

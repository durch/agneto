import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";

export type Verdict = "approve" | "needs-human" | "reject" | "revise";
export function parseVerdict(line: string): Verdict {
    if (line.startsWith("✅")) return "approve";
    if (line.startsWith("🟡")) return "needs-human";
    if (line.startsWith("🔴")) return "reject";
    return "revise";
}

export async function reviewProposal(provider: LLMProvider, cwd: string, planJson: string, proposal: string) {
    const sys = readFileSync(new URL("../prompts/reviewer.md", import.meta.url), "utf8");
    const res = await provider.query({
        cwd,
        mode: "review",
        messages: [
            { role: "system", content: sys },
            { role: "user", content: `Plan JSON:\n${planJson}\n\nREVIEW THIS PROPOSAL:\n${proposal}` }
        ]
    });
    return res.trim().split("\n")[0];
}

import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";

export async function proposeChange(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    feedback?: string
) {
    const sys = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");
    const extra = feedback ? `\nReviewer feedback to address:\n${feedback}\n` : "";
    return provider.query({
        cwd,
        mode: "default",                     // normal (not plan) so tools can run, but…
        allowedTools: ["ReadFile","ListDir","Grep"], // …only read-only tools
        messages: [
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n${extra}\nPlease propose ONE change for the first actionable step, in the exact format.` }
        ]
    });
}

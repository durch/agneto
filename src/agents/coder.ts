import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";

export async function proposeChange(provider: LLMProvider, cwd: string, planJson: string) {
    const sys = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");
    return provider.query({
        cwd,
        mode: "propose",
        messages: [
            { role: "system", content: sys },
            { role: "user", content: `Plan JSON:\n${planJson}\n\nPlease PROPOSE DIFF for the first step.` }
        ]
    });
}

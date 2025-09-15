import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";

export async function runPlanner(provider: LLMProvider, cwd: string, task: string) {
    const sys = readFileSync(new URL("../prompts/planner.md", import.meta.url), "utf8");
    const out = await provider.query({
        cwd,
        mode: "plan",
        messages: [
            { role: "system", content: sys },
            { role: "user", content: `Task: ${task}\n\nReturn plan.md and then OUTPUT plan.json.` }
        ]
    });
    return out; // caller saves as .plans/<id>/plan.md & plan.json
}

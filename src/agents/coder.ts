import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";

export async function proposeChange(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    feedback?: string,
    sessionId?: string,
    isInitialized?: boolean
) {
    const sys = readFileSync(new URL("../prompts/coder.md", import.meta.url), "utf8");
    const extra = feedback ? `\nReviewer feedback to address:\n${feedback}\n` : "";

    // AIDEV-NOTE: Semi-stateful session - system prompt only sent on first call
    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and plan
        messages.push(
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n\nPlease propose ONE change to implement from this plan, in the exact format.` }
        );
    } else {
        // Subsequent calls: just new user message with any feedback
        const userContent = feedback
            ? `Reviewer feedback to address:\n${feedback}\n\nPlease propose a revised change in the exact format.`
            : "Please propose the next change from the plan, in the exact format.";
        messages.push({ role: "user", content: userContent });
    }

    return provider.query({
        cwd,
        mode: "default",                     // normal (not plan) so tools can run
        allowedTools: ["ReadFile","ListDir","Grep","Bash"], // read tools + Bash for testing
        sessionId,                           // AIDEV-NOTE: Separate session for coder continuity
        model: "sonnet",
        messages
    });
}

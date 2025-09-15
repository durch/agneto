import type { LLMProvider, Msg } from "./index.js";
import { query } from "@anthropic-ai/claude-code";

const anthropic: LLMProvider = {
    name: "claude-code-headless",
    async query({ cwd, messages, mode }) {
        // Map our “mode” to a permission if you want (plan/propose/review).
        const res: any = await query({
            cwd,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            // permission: mode === "plan" ? "plan" : undefined,
            // You can also restrict tools here later with allowedTools.
        });

        // Normalize to string; Claude Code returns structured output.
        return (res?.output ?? res?.messages?.at(-1)?.content ?? "").toString();
    },
};

export default anthropic;

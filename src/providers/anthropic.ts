import type { LLMProvider, Msg } from "./index.js";
import { query } from "@anthropic-ai/claude-code";

const anthropic: LLMProvider = {
    name: "claude-code-headless",
    async query({ cwd, messages, mode }) {
        // Map our modes to Claude Code permissions if you like; start simple:
        const res = await query({
            cwd,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            // permission: mode === "plan" ? "plan" : undefined,
        });
        // Resolved text content (simplified)
        // @ts-ignore: depends on SDK; keep it simple for v0
        return (res?.output ?? res?.messages?.at(-1)?.content ?? "").toString();
    },
};

export default anthropic;

export type Role = "system" | "user" | "assistant";
export type Msg = { role: Role; content: string };

export interface LLMProvider {
    name: string;
    query(opts: {
        cwd: string;
        messages: Msg[];
        mode?: "plan" | "default" | "acceptEdits";
        allowedTools?: string[];     // e.g., ["ReadFile","ListDir","Grep"]
        sessionId?: string;           // Optional session ID for conversation continuity
        model?: string;               // Optional model name, e.g., "claude-2", "claude-instant-100k"
    }): Promise<string>;
}

export async function selectProvider(): Promise<LLMProvider> {
    return (await import("./anthropic.js")).default;
}

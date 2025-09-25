export type Role = "system" | "user" | "assistant";
export type Msg = { role: Role; content: string };

// Streaming callback types
export interface StreamCallbacks {
    onProgress?: (text: string) => void;
    onToolUse?: (tool: string, input: any) => void;
    onToolResult?: (isError: boolean) => void;
    onComplete?: (cost: number, duration: number) => void;
}

export interface LLMProvider {
    name: string;
    query(opts: {
        cwd: string;
        messages: Msg[];
        mode?: "plan" | "default" | "acceptEdits";
        allowedTools?: string[];     // e.g., ["ReadFile","ListDir","Grep"]
        sessionId?: string;           // Optional session ID for conversation continuity
        model?: string;                // Optional model name, e.g., "claude-2", "claude-instant-100k"
        isInitialized?: boolean;      // Optional flag to indicate if the session is initialized
        callbacks?: StreamCallbacks;  // Streaming progress callbacks
    }): Promise<string>;
}

export async function selectProvider(): Promise<LLMProvider> {
    return (await import("./anthropic.js")).default;
}

import { readFileSync } from "node:fs";
import type { LLMProvider, Msg } from "../providers/index.js";
import { log } from "../ui/log.js";

// AIDEV-NOTE: Bean Counter agent handles all work chunking decisions - both initial and progressive.
// It breaks down high-level plans into implementable chunks and tracks progress through completion.

export interface BeanCounterChunk {
    type: "WORK_CHUNK" | "TASK_COMPLETE";
    description: string;
    requirements: string[];
    context: string;
}

// Initial chunking: Break down high-level plan into first implementable chunk
export async function getInitialChunk(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    sessionId?: string,
    isInitialized?: boolean
): Promise<BeanCounterChunk | null> {
    const template = readFileSync(new URL("../prompts/bean-counter.md", import.meta.url), "utf8");

    const messages: Msg[] = [];

    if (!isInitialized) {
        // First call: establish context with system prompt and plan
        messages.push(
            { role: "system", content: template },
            { role: "user", content: `High-Level Plan (Markdown):\n\n${planMd}\n\n[INITIAL CHUNKING]\n\nBreak down this plan into the first implementable chunk. Focus on creating a small, reviewable piece of work that establishes a foundation for subsequent chunks.` }
        );
    } else {
        // This shouldn't happen for initial chunking, but handle gracefully
        messages.push({ role: "user", content: "[INITIAL CHUNKING]\n\nProvide the first implementable chunk for the given plan." });
    }

    try {
        if (!isInitialized) {
            log.startStreaming("Bean Counter");
        }

        const rawResponse = await provider.query({
            cwd,
            mode: "default",  // Use default mode for consistent streaming
            allowedTools: ["ReadFile", "Grep", "Bash"],  // Read tools for context
            sessionId,
            isInitialized,
            messages,
            callbacks: {
                onProgress: log.streamProgress,
                onToolUse: (tool, input) => log.toolUse("Bean Counter", tool, input),
                onToolResult: (isError) => log.toolResult("Bean Counter", isError),
                onComplete: (cost, duration) => log.complete("Bean Counter", cost, duration)
            }
        });

        log.orchestrator(`Raw bean counter initial response: ${rawResponse}`);
        return parseChunkResponse(rawResponse);
    } catch (error) {
        console.error("Failed to get initial chunk from Bean Counter:", error);
        return null;
    }
}

// Progressive chunking: After approval, determine next chunk or completion
export async function getNextChunk(
    provider: LLMProvider,
    cwd: string,
    planMd: string,
    approvalMessage: string,
    sessionId: string,  // Required for progressive chunking to maintain ledger
    isInitialized: boolean
): Promise<BeanCounterChunk | null> {
    const messages: Msg[] = [];

    if (!isInitialized) {
        // This shouldn't happen for progressive chunking
        throw new Error("Bean Counter session must be initialized for progressive chunking");
    }

    // Progressive call: update ledger with approval and determine next chunk
    messages.push({
        role: "user",
        content: `[CHUNK COMPLETED]\n\nApproved work: ${approvalMessage}\n\n[NEXT CHUNKING]\n\nUpdate your progress ledger and determine the next implementable chunk, or signal completion if all work is done.`
    });

    try {
        const rawResponse = await provider.query({
            cwd,
            mode: "default",  // Use default mode for consistent streaming
            allowedTools: ["ReadFile", "Grep", "Bash"],  // Read tools for context
            sessionId,
            isInitialized: true,
            messages,
            callbacks: {
                onProgress: log.streamProgress,
                onToolUse: (tool, input) => log.toolUse("Bean Counter", tool, input),
                onToolResult: (isError) => log.toolResult("Bean Counter", isError),
                onComplete: (cost, duration) => log.complete("Bean Counter", cost, duration)
            }
        });

        log.orchestrator(`Raw bean counter progressive response: ${rawResponse}`);
        return parseChunkResponse(rawResponse);
    } catch (error) {
        console.error("Failed to get next chunk from Bean Counter:", error);
        return null;
    }
}

// Parse Bean Counter response into structured chunk
function parseChunkResponse(response: string): BeanCounterChunk | null {
    // Simple natural language parsing - look for completion signals
    if (response.toLowerCase().includes('task complete') ||
        response.toLowerCase().includes('all work done') ||
        response.toLowerCase().includes('implementation finished')) {
        return {
            type: "TASK_COMPLETE",
            description: "All work completed",
            requirements: [],
            context: response
        };
    }

    // Extract chunk description and requirements from natural language
    const lines = response.split('\n').filter(line => line.trim());
    let description = "";
    let requirements: string[] = [];

    // Find description (usually early in response)
    for (const line of lines) {
        if (line.includes(':') && !description) {
            description = line.split(':')[1]?.trim() || line.trim();
            break;
        }
    }

    // Find requirements (look for bullet points or numbered lists)
    for (const line of lines) {
        if (line.match(/^\s*[-*]\s+/) || line.match(/^\s*\d+\.\s+/)) {
            requirements.push(line.replace(/^\s*[-*\d.]\s*/, '').trim());
        }
    }

    // Fallback: use first substantial line as description
    if (!description && lines.length > 0) {
        description = lines[0];
    }

    return {
        type: "WORK_CHUNK",
        description: description || "Work chunk",
        requirements,
        context: response
    };
}
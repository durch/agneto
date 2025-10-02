import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import type { RefinedTask } from "../types.js";
import { log } from "../ui/log.js";
import { summarizeToolParams } from "../utils/tool-summary.js";
import type { TaskStateMachine } from "../task-state-machine.js";
import { generateUUID } from "../utils/id-generator.js";

export class RefinerAgent {
    private provider: LLMProvider;
    private systemPrompt: string;
    private sessionId: string | undefined;

    constructor(provider: LLMProvider) {
        this.provider = provider;
        this.systemPrompt = readFileSync(new URL("../prompts/refiner.md", import.meta.url), "utf8");
    }

    async refine(
        cwd: string,
        rawTask: string,
        taskId: string,
        taskStateMachine?: TaskStateMachine
    ): Promise<RefinedTask> {
        log.startStreaming("Task Refiner");

        // Initialize session for potential followup questions
        this.sessionId = generateUUID();

        const refinedOutput = await this.provider.query({
            cwd,
            mode: "default", // Use default mode for consistent streaming
            allowedTools: ["ReadFile", "Grep", "Bash"], // Read tools for context
            sessionId: this.sessionId,
            isInitialized: false, // First call in this session
            messages: [
                { role: "system", content: this.systemPrompt },
                { role: "user", content: `Task: ${rawTask}\n\nAnalyze and refine this task description.` }
            ],
            callbacks: {
                onProgress: (update: string) => {
                    log.streamProgress(update);
                    if (taskStateMachine) {
                        taskStateMachine.setLiveActivityMessage("Task Refiner", update);
                    }
                },
                onToolUse: (tool, input) => {
                    log.toolUse("Task Refiner", tool, input);
                    if (taskStateMachine) {
                        taskStateMachine.setToolStatus("Task Refiner", tool, summarizeToolParams(tool, input));
                    }
                },
                onToolResult: (isError) => {
                    log.toolResult("Task Refiner", isError);
                    if (taskStateMachine) {
                        taskStateMachine.clearToolStatus();
                    }
                },
                onComplete: (cost, duration) => log.complete("Task Refiner", cost, duration)
            }
        });

        // Parse the structured output from the refiner
        return this.parseRefinedTask(refinedOutput?.trim());
    }

    async askFollowup(previousAnswer: string): Promise<string> {
        // Validate session exists
        if (!this.sessionId) {
            throw new Error(
                "Cannot ask followup: session not initialized. Call refine() first."
            );
        }

        // Call provider with existing session - NO tools needed for clarifying questions
        const response = await this.provider.query({
            cwd: "", // No cwd needed for followup
            mode: "default",
            allowedTools: [], // Followup questions are clarifications, not codebase exploration
            sessionId: this.sessionId,
            isInitialized: true, // Session already initialized by refine()
            messages: [
                { role: "system", content: this.systemPrompt }, // Include system prompt for context
                { role: "user", content: previousAnswer }
            ],
            callbacks: {
                onProgress: log.streamProgress,
                onComplete: (cost, duration) => log.complete("Task Refiner", cost, duration)
            }
        });

        return response?.trim() || "";
    }

    private parseRefinedTask(output: string | undefined): RefinedTask {
        // Parse the refiner's structured output format
        // Expected format: Goal, Context, Constraints, Success Criteria sections
        const goal = this.extractSection(output, "Goal") || "";
        const context = this.extractSection(output, "Context") || "";
        const constraints = this.extractSection(output, "Constraints")?.split("\n").filter(c => c.trim()) || [];
        const successCriteria = this.extractSection(output, "Success Criteria")?.split("\n").filter(c => c.trim()) || [];

        return {
            goal,
            context,
            constraints,
            successCriteria,
            raw: output
        };
    }

    private extractSection(text: string | undefined, sectionName: string): string | undefined {
        const regex = new RegExp(`## ${sectionName}\\s*\\n([^#]+)`, "i");
        const match = text?.match(regex);
        return match?.[1]?.trim();
    }
}
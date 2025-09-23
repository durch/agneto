import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { log } from "./log.js";
import type { RefinedTask } from "../types.js";

export type RefinementFeedbackType =
    | "approve"
    | "clarify-goal"
    | "add-context"
    | "specify-constraints"
    | "define-success"
    | "start-over";

export interface RefinementFeedback {
    type: RefinementFeedbackType;
    details?: string;
}

export async function displayRefinedTask(refinedTask: RefinedTask, iteration: number) {
    console.log("\n" + chalk.blue("=".repeat(50)));
    console.log(chalk.blue.bold(`🔍 REFINED TASK v${iteration}`));
    console.log(chalk.blue("=".repeat(50)));
    
    console.log(chalk.bold("\n📎 Goal:"));
    console.log(refinedTask.goal);
    
    if (refinedTask.context) {
        console.log(chalk.bold("\n📝 Context:"));
        console.log(refinedTask.context);
    }
    
    if (refinedTask.constraints.length > 0) {
        console.log(chalk.bold("\n⚠️ Constraints:"));
        refinedTask.constraints.forEach(c => console.log(`  • ${c}`));
    }
    
    if (refinedTask.successCriteria.length > 0) {
        console.log(chalk.bold("\n✅ Success Criteria:"));
        refinedTask.successCriteria.forEach(c => console.log(`  • ${c}`));
    }
    
    console.log("\n" + chalk.blue("=".repeat(50)) + "\n");
}

export async function getRefinementFeedback(): Promise<RefinementFeedback> {
    const action = await select({
        message: "How would you like to proceed with this refined task?",
        choices: [
            { name: "✅ Approve - Proceed to planning", value: "approve" },
            { name: "🎯 Clarify Goal - The objective needs refinement", value: "clarify-goal" },
            { name: "📋 Add Context - Provide more background", value: "add-context" },
            { name: "⚠️ Specify Constraints - Add limitations/requirements", value: "specify-constraints" },
            { name: "✔️ Define Success - Clarify what success looks like", value: "define-success" },
            { name: "🔄 Start Over - New task description", value: "start-over" },
        ],
    });

    if (action === "approve") {
        return { type: "approve" };
    }

    let details = "";
    switch (action) {
        case "clarify-goal":
            details = await input({
                message: "What should the goal be? (e.g., 'Build a REST API for user management')",
            });
            break;
        case "add-context":
            details = await input({
                message: "What context is needed? (e.g., 'This is for an existing Node.js app with Express')",
            });
            break;
        case "specify-constraints":
            details = await input({
                message: "What constraints apply? (e.g., 'Must use PostgreSQL, no external dependencies')",
            });
            break;
        case "define-success":
            details = await input({
                message: "What defines success? (e.g., 'All CRUD operations work, tests pass, documented')",
            });
            break;
        case "start-over":
            details = await input({
                message: "New task description:",
            });
            break;
    }

    return { type: action as RefinementFeedbackType, details };
}

export async function interactiveRefinement(
    refinerAgent: any,
    cwd: string,
    rawTask: string,
    taskId: string,
    maxIterations: number = 3
): Promise<RefinedTask | null> {
    let currentTask = rawTask;
    let iteration = 0;

    while (iteration < maxIterations) {
        log.info(`Refining task (iteration ${iteration + 1}/${maxIterations})...`);
        
        const refinedTask = await refinerAgent.refine(cwd, currentTask, taskId);
        await displayRefinedTask(refinedTask, iteration + 1);

        const feedback = await getRefinementFeedback();

        if (feedback.type === "approve") {
            log.human("Task refinement approved! 🎯");
            return refinedTask;
        }

        if (feedback.type === "start-over" && feedback.details) {
            currentTask = feedback.details;
            iteration = 0;
            continue;
        }

        // Build enhanced task description based on feedback
        currentTask = formatFeedbackForRefiner(currentTask, refinedTask, feedback);
        iteration++;
    }

    log.warn(`Reached maximum refinement iterations (${maxIterations})`);
    const finalRefined = await refinerAgent.refine(cwd, currentTask, taskId);
    
    const proceed = await confirm({
        message: "Maximum iterations reached. Proceed with current refinement?",
        default: true,
    });

    return proceed ? finalRefined : null;
}

function formatFeedbackForRefiner(
    originalTask: string,
    refinedTask: RefinedTask,
    feedback: RefinementFeedback
): string {
    let enhanced = originalTask;

    switch (feedback.type) {
        case "clarify-goal":
            enhanced = `Goal: ${feedback.details}\n\nOriginal request: ${originalTask}`;
            break;
        case "add-context":
            enhanced = `${originalTask}\n\nAdditional context: ${feedback.details}`;
            break;
        case "specify-constraints":
            enhanced = `${originalTask}\n\nConstraints: ${feedback.details}`;
            break;
        case "define-success":
            enhanced = `${originalTask}\n\nSuccess criteria: ${feedback.details}`;
            break;
    }

    return enhanced;
}

export async function showRefinementComplete(refinedTask: RefinedTask) {
    console.log("\n" + chalk.green("✅ Task refinement complete!"));
    console.log(chalk.dim(`Proceeding with refined specification...`));
    console.log();
}
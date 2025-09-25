import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { log } from "./log.js";
import type { RefinedTask } from "../types.js";

export type RefinementFeedbackType =
    | "approve"
    | "reject";

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
            { name: "❌ Reject - Provide feedback for revision", value: "reject" },
        ],
    });

    if (action === "approve") {
        return { type: "approve" };
    }

    // For reject, prompt for free-form feedback
    const details = await input({
        message: "What needs to be changed? (Be specific about what's wrong and what you'd prefer):",
    });

    return { type: "reject" as RefinementFeedbackType, details };
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
            log.orchestrator("Task refinement approved! 🎯");
            return refinedTask;
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
    // For the binary flow, we only handle approve (no feedback needed)
    // or reject with free-form feedback
    if (feedback.type === "approve") {
        return originalTask;
    }

    // For reject, incorporate the human feedback into the task description
    if (feedback.type === "reject" && feedback.details) {
        return `${originalTask}\n\nHuman feedback: ${feedback.details}`;
    }

    return originalTask;
}

export async function showRefinementComplete(refinedTask: RefinedTask) {
    console.log("\n" + chalk.green("✅ Task refinement complete!"));
    console.log(chalk.dim(`Proceeding with refined specification...`));
    console.log();
}
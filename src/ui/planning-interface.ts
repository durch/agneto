import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { log } from "./log.js";

export type PlanFeedbackType =
    | "approve"
    | "simplify"
    | "add-detail"
    | "wrong-approach"
    | "edit-steps"
    | "add-constraints"
    | "start-over";

export interface PlanFeedback {
    type: PlanFeedbackType;
    details?: string;
}

export async function displayPlan(planMd: string, iteration: number) {
    console.log("\n" + chalk.cyan("=".repeat(50)));
    console.log(chalk.cyan.bold(`📋 PLAN v${iteration}`));
    console.log(chalk.cyan("=".repeat(50)));
    console.log(planMd);
    console.log(chalk.cyan("=".repeat(50)) + "\n");
}

export async function displayPlanDiff(oldPlan: string, newPlan: string) {
    console.log("\n" + chalk.yellow("Changes from previous version:"));
    // Simple diff display - in reality would use a proper diff library
    console.log(chalk.dim("(Showing summary of changes)"));
    console.log();
}

export async function getPlanFeedback(): Promise<PlanFeedback> {
    const action = await select({
        message: "How would you like to proceed with this plan?",
        choices: [
            { name: "✅ Approve - Let's start coding", value: "approve" },
            { name: "📝 Simplify - This is too complex", value: "simplify" },
            { name: "🔍 Add Detail - Need more specific steps", value: "add-detail" },
            { name: "🔄 Wrong Approach - Suggest alternative", value: "wrong-approach" },
            { name: "✏️ Edit Steps - Modify specific parts", value: "edit-steps" },
            { name: "⚠️ Add Constraints - Specify requirements/limitations", value: "add-constraints" },
            { name: "🔄 Start Over - New task description", value: "start-over" },
        ],
    });

    if (action === "approve") {
        return { type: "approve" };
    }

    let details = "";
    switch (action) {
        case "simplify":
            details = await input({
                message: "What should be simplified? (e.g., 'Start with just basic validation, no user model yet')",
            });
            break;
        case "add-detail":
            details = await input({
                message: "What needs more detail? (e.g., 'Step 3 needs error handling details')",
            });
            break;
        case "wrong-approach":
            details = await input({
                message: "What approach would you prefer? (e.g., 'Use REST instead of GraphQL')",
            });
            break;
        case "edit-steps":
            details = await input({
                message: "What specific changes? (e.g., 'Remove step 4, combine steps 2 and 3')",
            });
            break;
        case "add-constraints":
            details = await input({
                message: "What constraints? (e.g., 'Must be backwards compatible, no new dependencies')",
            });
            break;
        case "start-over":
            details = await input({
                message: "New task description:",
            });
            break;
    }

    return { type: action as PlanFeedbackType, details };
}

export async function confirmPlanApproval(iterations: number): Promise<boolean> {
    if (iterations === 0) {
        log.human("Plan approved on first try! 🎯");
    } else {
        log.human(`Plan approved after ${iterations + 1} iterations 📝`);
    }

    return await confirm({
        message: "Ready to start coding with this plan?",
        default: true,
    });
}

export async function showPlanningComplete(planPath: string) {
    console.log("\n" + chalk.green("✅ Planning phase complete!"));
    console.log(chalk.dim(`Plan saved to: ${planPath}`));
    console.log();
}

export function formatFeedbackForPlanner(feedback: PlanFeedback): string {
    const prefix = `Human feedback (${feedback.type}): `;

    switch (feedback.type) {
        case "simplify":
            return `${prefix}The plan is too complex. Simplify by: ${feedback.details}`;
        case "add-detail":
            return `${prefix}Need more specific details: ${feedback.details}`;
        case "wrong-approach":
            return `${prefix}Use a different approach: ${feedback.details}`;
        case "edit-steps":
            return `${prefix}Modify the plan: ${feedback.details}`;
        case "add-constraints":
            return `${prefix}Add these constraints/requirements: ${feedback.details}`;
        case "start-over":
            return `${prefix}Start over with new task: ${feedback.details}`;
        default:
            return "";
    }
}
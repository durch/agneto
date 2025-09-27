import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { log } from "./log.js";
import { prettyPrint } from "./pretty.js";

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

export async function displayPlan(planMd: string | undefined, iteration: number) {
    console.log("\n" + chalk.cyan("=".repeat(120)));
    console.log(chalk.cyan.bold(`📋 PLAN v${iteration}`));
    console.log(chalk.cyan("=".repeat(120)));

    // Validate plan content
    if (planMd === undefined || planMd === null || planMd === "undefined" || planMd.trim() === "") {
        console.log(chalk.red.bold("⚠️  PLAN GENERATION FAILED"));
        console.log(chalk.red("No content received from the planning agent."));
        console.log("");
        console.log(chalk.yellow("This usually indicates:"));
        console.log(chalk.yellow("• Claude CLI connection issues"));
        console.log(chalk.yellow("• Provider timeout or error"));
        console.log(chalk.yellow("• Plan content was too complex to generate"));
        console.log("");
        console.log(chalk.blue("Try running with DEBUG=true for more details:"));
        console.log(chalk.blue("DEBUG=true npm start -- <task-id> \"task description\""));
    } else {
        console.log(prettyPrint(planMd, { indent: 2 }));
    }

    console.log(chalk.cyan("=".repeat(120)) + "\n");
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

    // Map to "wrong-approach" internally to maintain compatibility
    // The formatFeedbackForPlanner function will handle this properly
    return { type: "wrong-approach" as PlanFeedbackType, details };
}

export async function confirmPlanApproval(iterations: number): Promise<boolean> {
    if (iterations === 0) {
        log.orchestrator("Plan approved on first try! 🎯");
    } else {
        log.orchestrator(`Plan approved after ${iterations + 1} iterations 📝`);
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
    // For the new binary flow, we only handle approve (no feedback needed)
    // or reject (mapped to "wrong-approach" with free-form feedback)
    if (feedback.type === "approve") {
        return "";
    }

    // All rejections now come through as "wrong-approach" with free-form feedback
    if (feedback.type === "wrong-approach" && feedback.details) {
        return `Human feedback: ${feedback.details}`;
    }

    // Legacy support for any remaining cases (shouldn't happen with new flow)
    const prefix = `Human feedback (${feedback.type}): `;
    switch (feedback.type) {
        case "simplify":
            return `${prefix}The plan is too complex. Simplify by: ${feedback.details}`;
        case "add-detail":
            return `${prefix}Need more specific details: ${feedback.details}`;
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
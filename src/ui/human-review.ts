import { select, input } from "@inquirer/prompts";
import chalk from "chalk";
import { HumanDecision, HumanInteractionResult } from "../types.js";

export async function promptHumanReview(
    proposal: string,
    stepDescription: string,
    reviewerFeedback?: string
): Promise<HumanInteractionResult> {
    // Display the context
    console.log("\n" + chalk.yellow("=".repeat(60)));
    console.log(chalk.yellow.bold("🙋 HUMAN REVIEW REQUIRED"));
    console.log(chalk.yellow("=".repeat(60)));
    
    console.log(chalk.cyan("\n📋 Current Step:"));
    console.log(stepDescription);
    
    if (reviewerFeedback) {
        console.log(chalk.magenta("\n👀 Reviewer's Concern:"));
        console.log(reviewerFeedback);
    }
    
    console.log(chalk.blue("\n🤖 Proposed Change:"));
    console.log(chalk.dim("-".repeat(60)));
    console.log(proposal);
    console.log(chalk.dim("-".repeat(60)));
    
    // Get human decision
    const decision = await select({
        message: "How would you like to proceed?",
        choices: [
            {
                name: "✅ Approve - Apply this change",
                value: "approve" as HumanDecision,
            },
            {
                name: "🔄 Retry - Try again with feedback",
                value: "retry" as HumanDecision,
            },
            {
                name: "❌ Reject - Skip this step",
                value: "reject" as HumanDecision,
            },
        ],
    });
    
    // If retry, get feedback
    if (decision === "retry") {
        const feedback = await input({
            message: "Provide feedback for the Coder to improve the proposal:",
        });
        
        return {
            decision,
            feedback: feedback.trim() || undefined,
        };
    }
    
    return { decision };
}
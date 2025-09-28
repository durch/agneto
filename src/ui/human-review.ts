import { select, input } from "@inquirer/prompts";
import chalk from "chalk";
import { HumanDecision, HumanInteractionResult } from "../types.js";

export async function promptHumanReview(
    proposal: string,
    stepDescription: string,
    reviewerFeedback?: string
): Promise<HumanInteractionResult> {
    // Display the context
    console.log("\n" + chalk.yellow("=".repeat(120)));
    console.log(chalk.yellow.bold("🙋 HUMAN REVIEW REQUIRED"));
    console.log(chalk.yellow("=".repeat(120)));
    
    console.log(chalk.cyan("\n📋 Current Step:"));
    console.log(stepDescription);
    
    if (reviewerFeedback) {
        console.log(chalk.magenta("\n👀 Reviewer's Concern:"));
        console.log(reviewerFeedback);
    }
    
    console.log(chalk.blue("\n🤖 Proposed Change:"));
    console.log(chalk.dim("-".repeat(120)));
    console.log(proposal);
    console.log(chalk.dim("-".repeat(120)));

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

export async function promptForSuperReviewerDecision(
    summary: string,
    issues?: string[]
): Promise<HumanInteractionResult> {
    // Display the context
    console.log("\n" + chalk.yellow("=".repeat(120)));
    console.log(chalk.yellow.bold("🎯 FINAL QUALITY GATE"));
    console.log(chalk.yellow("=".repeat(120)));
    
    console.log(chalk.cyan("\n📋 SuperReviewer Assessment:"));
    console.log(summary);
    
    if (issues && issues.length > 0) {
        console.log(chalk.magenta("\n⚠️ Issues Identified:"));
        issues.forEach(issue => {
            console.log(chalk.magenta(`  • ${issue}`));
        });
    }
    
    console.log(chalk.dim("\n" + "-".repeat(120)));
    console.log(chalk.gray("All execution steps have completed. Choose how to proceed:"));
    console.log(chalk.dim("-".repeat(120)));

    // Get human decision with terminal-state-aware options
    const decision = await select({
        message: "Select final disposition for this completed work:",
        choices: [
            {
                name: "🔄 Start New Cycle - Create a new task to address the issues",
                value: "retry" as HumanDecision,
            },
            {
                name: "✅ Accept Incomplete - Merge the work despite remaining issues",
                value: "approve" as HumanDecision,
            },
            {
                name: "🚫 Abandon - Leave the work in the worktree without merging",
                value: "reject" as HumanDecision,
            },
        ],
    });
    
    // If starting new cycle, get description of what needs fixing
    if (decision === "retry") {
        const feedback = await input({
            message: "Describe what should be addressed in the new development cycle:",
        });
        
        return {
            decision,
            feedback: feedback.trim() || undefined,
        };
    }
    
    return { decision };
}
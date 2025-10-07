import { Command } from "commander";
import { select, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { runTask } from "./orchestrator.js";
import { generateTaskId, generateTaskName } from "./utils/id-generator.js";
import { selectProvider } from "./providers/index.js";
import { RecoveryService } from "./audit/index.js";

export type RecoveryOption = "resume" | "fresh" | "details";

export interface RecoveryDecision {
    action: RecoveryOption;
    checkpointNumber?: number;
}

/**
 * Prompt user for checkpoint recovery decision
 * Displays checkpoint summary and offers recovery options
 */
async function promptCheckpointRecovery(recoveryService: RecoveryService): Promise<RecoveryDecision> {
    const summary = recoveryService.getCheckpointSummary();
    const latestCheckpoint = recoveryService.getLatestRecoverableCheckpoint();

    // Display checkpoint summary
    console.log("\n" + chalk.cyan("=".repeat(80)));
    console.log(chalk.cyan.bold("🔄 CHECKPOINT RECOVERY"));
    console.log(chalk.cyan("=".repeat(80)));

    if (summary) {
        console.log(chalk.white(`Task ID: ${summary.taskId}`));
        console.log(chalk.white(`Total checkpoints: ${summary.totalCheckpoints}`));
        console.log(chalk.white(`Latest checkpoint: #${summary.latestCheckpoint}`));
        console.log(chalk.white(`Recoverable checkpoints: ${summary.hasRecoverableCheckpoints ? 'Yes' : 'No'}`));

        if (latestCheckpoint) {
            console.log(chalk.green(`\nLatest recoverable checkpoint:`));
            console.log(chalk.white(`  #${latestCheckpoint.checkpointNumber} - ${latestCheckpoint.description}`));
            console.log(chalk.dim(`  Trigger: ${latestCheckpoint.trigger}`));
            console.log(chalk.dim(`  Timestamp: ${new Date(latestCheckpoint.timestamp).toLocaleString()}`));
        }
    }

    console.log(chalk.cyan("=".repeat(80)) + "\n");

    // Present recovery options
    const action = await select({
        message: "What would you like to do with the existing checkpoints?",
        choices: [
            {
                name: "🚀 Resume from latest checkpoint",
                value: "resume",
                description: "Continue from the most recent recoverable checkpoint"
            },
            {
                name: "🆕 Start fresh",
                value: "fresh",
                description: "Ignore checkpoints and start a new task execution"
            },
            {
                name: "🔍 Show checkpoint details",
                value: "details",
                description: "View detailed checkpoint information before deciding"
            }
        ],
    });

    if (action === "details") {
        // Display detailed checkpoint information
        const availableCheckpoints = recoveryService.getAvailableCheckpoints();

        console.log(chalk.yellow("\n📋 Available Checkpoints:"));
        console.log(chalk.yellow("=".repeat(50)));

        if (availableCheckpoints.length === 0) {
            console.log(chalk.dim("No checkpoints available"));
        } else {
            for (const cp of availableCheckpoints) {
                const status = cp.canRecover ? chalk.green("✅ Recoverable") : chalk.red("❌ Not recoverable");
                const critical = cp.isCritical ? chalk.red(" [CRITICAL]") : "";

                console.log(`${chalk.bold(`#${cp.checkpointNumber}`)} - ${cp.description}${critical}`);
                console.log(`  ${status}`);
                console.log(`  Trigger: ${cp.trigger}`);
                console.log(`  Time: ${new Date(cp.timestamp).toLocaleString()}`);
                console.log("");
            }
        }

        // Ask again after showing details
        const finalAction = await select({
            message: "Now, what would you like to do?",
            choices: [
                {
                    name: "🚀 Resume from latest checkpoint",
                    value: "resume"
                },
                {
                    name: "🆕 Start fresh",
                    value: "fresh"
                }
            ],
        });

        return {
            action: finalAction as RecoveryOption,
            checkpointNumber: finalAction === "resume" && latestCheckpoint ? latestCheckpoint.checkpointNumber : undefined
        };
    }

    return {
        action: action as RecoveryOption,
        checkpointNumber: action === "resume" && latestCheckpoint ? latestCheckpoint.checkpointNumber : undefined
    };
}

const program = new Command();
program
    .name("agneto")
    .description("Interactive AI development assistant with Planner→Coder→Reviewer loop")
    .argument("<task-description-or-id>", "task description or ID")
    .argument("[task-description]", "task description if ID was provided")
    .option("--auto-merge", "automatically merge to master when complete")
    .option("--non-interactive", "skip interactive planning (for CI/automation)")
    .option("--base-branch <branch>", "use specified branch as base for worktree (default: auto-detect main/master)")
    .addHelpText('after', `
Examples:
  # Simple usage - auto-generated ID
  $ npm start -- "fix authentication bug"

  # With custom ID
  $ npm start -- auth-fix-1 "fix authentication bug"

  # Non-interactive mode
  $ npm start -- "update dependencies" --non-interactive

  # Auto-merge when complete
  $ npm start -- "add logging" --auto-merge

  # Use specific branch as base
  $ npm start -- "new feature" --base-branch feature-branch`)
    .action(async (taskOrId, task, options) => {
        try {
            // Determine if user provided ID + description or just description
            let taskId: string;
            let taskDescription: string;
            
            if (task) {
                // Both arguments provided: first is ID, second is description
                taskId = taskOrId;
                taskDescription = task;
            } else {
                // Only one argument: it's the description, generate ID
                const provider = await selectProvider();
                taskId = await generateTaskName(provider, taskOrId);
                taskDescription = taskOrId;
            }

            // Check for existing checkpoints before starting task
            let recoveryDecision: RecoveryDecision | undefined;
            try {
                const recoveryService = new RecoveryService(taskId);
                if (recoveryService.hasCheckpoints()) {
                    console.log(`🔍 Checkpoints detected for task: ${taskId}`);

                    // Only prompt for recovery in interactive mode
                    if (!options.nonInteractive) {
                        recoveryDecision = await promptCheckpointRecovery(recoveryService);
                    } else {
                        // In non-interactive mode, default to starting fresh
                        console.log(`ℹ️ Non-interactive mode: Starting fresh (ignoring checkpoints)`);
                        recoveryDecision = { action: "fresh" };
                    }
                }
            } catch (error) {
                // Graceful fallback - log warning but continue with normal execution
                console.warn(`⚠️ Failed to check for checkpoints: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

            const { cwd } = await runTask(taskId, taskDescription, {
                autoMerge: options.autoMerge,
                nonInteractive: options.nonInteractive,
                recoveryDecision,
                baseBranch: options.baseBranch
            });

            if (!options.autoMerge) {
                console.log(`\nWorktree: ${cwd}`);
            }
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    });

program.parseAsync();
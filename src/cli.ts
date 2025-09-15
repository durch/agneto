import { Command } from "commander";
import { runTask } from "./orchestrator.js";

const program = new Command();
program
    .name("agneto")
    .description("Interactive AI development assistant with Planner→Coder→Reviewer loop")
    .argument("<task-id>", "unique id, e.g., t-001")
    .argument("<task>", "human task description in quotes")
    .option("--auto-merge", "automatically merge to master when complete")
    .option("--non-interactive", "skip interactive planning (for CI/automation)")
    .action(async (taskId, task, options) => {
        try {
            const { cwd, completedSteps, totalSteps } = await runTask(taskId, task, {
                autoMerge: options.autoMerge,
                nonInteractive: options.nonInteractive
            });

            if (!options.autoMerge) {
                console.log(`\nWorktree: ${cwd}`);
                console.log(`Progress: ${completedSteps}/${totalSteps} steps completed`);
            }
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    });

program.parseAsync();

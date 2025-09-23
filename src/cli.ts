import { Command } from "commander";
import { runTask } from "./orchestrator.js";
import { generateTaskId } from "./utils/id-generator.js";

const program = new Command();
program
    .name("agneto")
    .description("Interactive AI development assistant with Planner→Coder→Reviewer loop")
    .argument("<task-description-or-id>", "task description or ID")
    .argument("[task-description]", "task description if ID was provided")
    .option("--auto-merge", "automatically merge to master when complete")
    .option("--non-interactive", "skip interactive planning (for CI/automation)")
    .addHelpText('after', `
Examples:
  # Simple usage - auto-generated ID
  $ npm start -- "fix authentication bug"
  
  # With custom ID
  $ npm start -- auth-fix-1 "fix authentication bug"
  
  # Non-interactive mode
  $ npm start -- "update dependencies" --non-interactive
  
  # Auto-merge when complete
  $ npm start -- "add logging" --auto-merge`)
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
                taskId = generateTaskId();
                taskDescription = taskOrId;
            }
            
            const { cwd } = await runTask(taskId, taskDescription, {
                autoMerge: options.autoMerge,
                nonInteractive: options.nonInteractive
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
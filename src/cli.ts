import { Command } from "commander";
import { runTask } from "./orchestrator.js";

const program = new Command();
program
    .name("agentic-dev")
    .description("Planner→Coder→Reviewer loop (sandboxed)")
    .argument("<task-id>", "unique id, e.g., t-001")
    .argument("<task>", "human task description in quotes")
    .action(async (taskId, task) => {
        try {
            const { cwd } = await runTask(taskId, task);
            console.log(`\nWorktree: ${cwd}\nNext: open it in your editor, or re-run with a new task.`);
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    });

program.parseAsync();

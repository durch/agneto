import { selectProvider } from "./providers/index.js";
import { runPlanner } from "./agents/planner.js";
import { proposeChange } from "./agents/coder.js";
import { reviewProposal, parseVerdict } from "./agents/reviewer.js";
import { ensureWorktree } from "./git/worktrees.js";
import { applyProposal } from "./git/sandbox.js";
import { log } from "./ui/log.js";

export async function runTask(taskId: string, humanTask: string) {
    const provider = await selectProvider();
    const { dir: cwd } = ensureWorktree(taskId);

    log.planner(`Planning "${humanTask}"…`);
    const planOut = await runPlanner(provider, cwd, humanTask);
    // In v0, assume the provider returned plan.json text at the end.
    const planJson = planOut.slice(planOut.indexOf("{"));

    log.coder("Proposing first change…");
    const proposal = await proposeChange(provider, cwd, planJson);
    log.coder(`\n${proposal}`);

    log.review("Reviewing proposal…");
    const verdictLine = await reviewProposal(provider, cwd, planJson, proposal);
    const verdict = parseVerdict(verdictLine);
    log.review(verdictLine);

    if (verdict === "approve") {
        log.human("Applying approved proposal to sandbox…");
        applyProposal(cwd, proposal);
        log.human("Done. You can inspect the worktree and run tests.");
    } else {
        log.human(`Not applying. Verdict = ${verdict}. Review the proposal above.`);
    }

    return { cwd, verdict };
}

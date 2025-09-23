import { selectProvider } from "./providers/index.js";
import { runPlanner } from "./agents/planner.js";
import { proposeChange } from "./agents/coder.js";
import { reviewProposal, parseVerdict } from "./agents/reviewer.js";
import { ensureWorktree } from "./git/worktrees.js";
import { applyProposal, mergeToMaster, cleanupWorktree } from "./git/sandbox.js";
import { log } from "./ui/log.js";
import { readFileSync } from "node:fs";
import { promptHumanReview } from "./ui/human-review.js";

export async function runTask(taskId: string, humanTask: string, options?: { autoMerge?: boolean; nonInteractive?: boolean }) {
    const provider = await selectProvider();
    const { dir: cwd } = ensureWorktree(taskId);

    // Interactive by default, use --non-interactive to disable
    const interactive = !options?.nonInteractive;

    if (!interactive) {
        log.planner(`Planning "${humanTask}"…`);
    }
    const { planMd, planPath } = await runPlanner(provider, cwd, humanTask, taskId, interactive);
    if (!interactive) {
        log.planner(`Saved plan → ${planPath}`);
    }

    let completedSteps = 0;
    let totalSteps = countStepsInPlan(planMd);
    let continueWork = true;

    while (continueWork && completedSteps < totalSteps) {
        let attempts = 0;
        let feedback: string | undefined;
        let stepCompleted = false;

        while (attempts < 3 && !stepCompleted) {
            attempts++;
            log.coder(`Proposing change for step ${completedSteps + 1}/${totalSteps} (attempt ${attempts})…`);
            const proposal = (await proposeChange(provider, cwd, planMd, feedback) || "").trim();
            log.coder(`\n${proposal}`);

            if (!proposal || !/^FILE:\s/m.test(proposal)) {
                const msg = "✏️ revise — coder produced no well-formed proposal. Ask for one-file proposal for current step.";
                log.review(msg);
                feedback = msg;
                continue;
            }

            log.review("Reviewing proposal…");
            const verdictLine = await reviewProposal(provider, cwd, planMd, proposal);
            const verdict = parseVerdict(verdictLine);
            log.review(verdictLine);

            if (verdict === "approve") {
                log.human("Applying approved proposal to sandbox…");
                const changesMade = applyProposal(cwd, proposal);
                completedSteps++;
                stepCompleted = true;
                if (changesMade) {
                    log.human(`✅ Step ${completedSteps}/${totalSteps} completed`);
                } else {
                    log.human(`✅ Step ${completedSteps}/${totalSteps} already complete - no changes needed`);
                }

                // Reset feedback for next step
                feedback = undefined;
            } else if (verdict === "revise") {
                feedback = verdictLine;
            } else if (verdict === "reject") {
                // Reject requires fundamental rethinking
                feedback = `🔴 REJECTED - Fundamental rethink needed: ${verdictLine}\n\nTake time to megathink about the approach. Read the existing code more carefully. The current approach is wrong, not just incomplete.`;
                log.human("Proposal rejected - requesting complete rethink...");
            } else if (verdict === "needs-human") {
                // Extract current step description from the plan
                const stepNumber = completedSteps + 1;
                const stepDescription = extractStepDescription(planMd, stepNumber);
                
                // Prompt human for review
                const humanResult = await promptHumanReview(
                    proposal,
                    stepDescription,
                    verdictLine
                );
                
                if (humanResult.decision === "approve") {
                    log.human("Human approved proposal. Applying to sandbox…");
                    const changesMade = applyProposal(cwd, proposal);
                    completedSteps++;
                    stepCompleted = true;
                    if (changesMade) {
                        log.human(`✅ Step ${completedSteps}/${totalSteps} completed`);
                    } else {
                        log.human(`✅ Step ${completedSteps}/${totalSteps} already complete - no changes needed`);
                    }
                    feedback = undefined;
                } else if (humanResult.decision === "retry") {
                    log.human("Human requested retry with feedback.");
                    feedback = humanResult.feedback || "Human requested retry - please revise the proposal";
                } else if (humanResult.decision === "reject") {
                    log.human("Human rejected proposal. Skipping this step.");
                    completedSteps++;
                    stepCompleted = true;
                    feedback = undefined;
                }
            } else {
                log.human(`Stopping. Verdict = ${verdict}.`);
                continueWork = false;
                break;
            }
        }

        if (!stepCompleted && attempts >= 3) {
            log.human(`Failed to complete step ${completedSteps + 1} after 3 attempts.`);
            continueWork = false;
        }

        // Always continue to next step (removed the continueUntilDone check)
    }

    // Task completion summary
    log.human(`\n📊 Task Summary: ${completedSteps}/${totalSteps} steps completed`);

    if (completedSteps === totalSteps) {
        log.human("🎉 All steps completed successfully!");

        if (options?.autoMerge) {
            log.human("📦 Auto-merging to master...");
            mergeToMaster(taskId, cwd);
            cleanupWorktree(taskId, cwd);
        } else {
            log.human(`\nNext steps:
1. Review changes in worktree: ${cwd}
2. Run tests to verify
3. Merge to master: git merge sandbox/${taskId}
4. Clean up: npm run cleanup-task ${taskId}`);
        }
    }

    return { cwd, completedSteps, totalSteps };
}

function countStepsInPlan(planMd: string): number {
    // Count numbered steps in the plan (lines starting with digits followed by period)
    const stepMatches = planMd.match(/^\d+\.\s+/gm);
    return stepMatches ? stepMatches.length : 1;
}

function extractStepDescription(planMd: string, stepNumber: number): string {
    // Extract the description for a specific step number from the plan
    const stepRegex = new RegExp(`^${stepNumber}\\.\\s+\\*\\*(.+?)\\*\\*([\\s\\S]*?)(?=^\\d+\\.|^##|$)`, 'gm');
    const match = stepRegex.exec(planMd);
    
    if (match) {
        const title = match[1];
        const details = match[2].trim().split('\n').slice(0, 3).join('\n');
        return `Step ${stepNumber}: ${title}\n${details}`;
    }
    
    return `Step ${stepNumber} of the plan`;
}
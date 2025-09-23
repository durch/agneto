import { selectProvider } from "./providers/index.js";
import { runPlanner } from "./agents/planner.js";
import { RefinerAgent } from "./agents/refiner.js";
import { interactiveRefinement } from "./ui/refinement-interface.js";
import { proposeChange } from "./agents/coder.js";
import { reviewProposal, parseVerdict } from "./agents/reviewer.js";
import { runSuperReviewer } from "./agents/super-reviewer.js";
import { ensureWorktree } from "./git/worktrees.js";
import { applyProposal, mergeToMaster, cleanupWorktree } from "./git/sandbox.js";
import { log } from "./ui/log.js";
import { readFileSync } from "node:fs";
import { promptHumanReview, promptForSuperReviewerDecision } from "./ui/human-review.js";
import { generateUUID } from "./utils/id-generator.js";

export async function runTask(taskId: string, humanTask: string, options?: { autoMerge?: boolean; nonInteractive?: boolean }) {
    const provider = await selectProvider();
    const { dir: cwd } = ensureWorktree(taskId);

    // Create unique UUID session IDs for each agent (Claude CLI requires valid UUIDs)
    const coderSessionId = generateUUID();
    const reviewerSessionId = generateUUID();

    // Interactive by default, use --non-interactive to disable
    const interactive = !options?.nonInteractive;

    // Add task refinement step before planning
    let taskToUse = humanTask;
    if (interactive) {
        log.info("🔍 Refining task description...");
        const refinerAgent = new RefinerAgent(provider);
        const refinedTask = await interactiveRefinement(refinerAgent, cwd, humanTask, taskId);
        
        if (refinedTask) {
            // Convert refined task to a structured description for the planner
            taskToUse = formatRefinedTaskForPlanner(refinedTask);
            log.human("Using refined task specification for planning.");
        } else {
            log.warn("Task refinement cancelled. Using original description.");
        }
    }

    if (!interactive) {
        log.planner(`Planning "${taskToUse}"…`);
    }
    const { planMd, planPath } = await runPlanner(provider, cwd, taskToUse, taskId, interactive);
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
            const proposal = (await proposeChange(provider, cwd, planMd, feedback, coderSessionId) || "").trim();
            log.coder(`\n${proposal}`);

            if (!proposal || !/^FILE:\s/m.test(proposal)) {
                const msg = "✏️ revise — coder produced no well-formed proposal. Ask for one-file proposal for current step.";
                log.review(msg);
                feedback = msg;
                continue;
            }

            log.review("Reviewing proposal…");
            const verdictLine = await reviewProposal(provider, cwd, planMd, proposal, reviewerSessionId);
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
        
        // Run SuperReviewer before merge decision
        log.review("🔍 Running final quality review...");
        const superReviewResult = await runSuperReviewer(
            provider, 
            cwd, 
            planMd,
            completedSteps,
            totalSteps
        );
        
        log.review(`SuperReviewer verdict: ${superReviewResult.verdict}`);
        log.review(`Summary: ${superReviewResult.summary}`);
        
        if (superReviewResult.issues) {
            superReviewResult.issues.forEach(issue => {
                log.review(`Issue: ${issue}`);
            });
        }
        
        // Handle SuperReviewer verdict
        if (superReviewResult.verdict === "needs-human") {
            log.human("⚠️ SuperReviewer identified issues requiring human review.");
            
            // Use the dedicated SuperReviewer decision prompt
            const humanDecision = await promptForSuperReviewerDecision(
                superReviewResult.summary,
                superReviewResult.issues
            );
            
            if (humanDecision.decision === "approve") {
                log.human("Human accepted work despite identified issues. Proceeding with merge options.");
            } else if (humanDecision.decision === "retry") {
                log.human("Human requested a new development cycle to address issues:");

                // Combine SuperReviewer's issues with human feedback for context
                const issuesContext = superReviewResult.issues
                    ? `\n\nSuperReviewer identified issues:\n${superReviewResult.issues.map(i => `- ${i}`).join('\n')}`
                    : "";

                const fullTaskDescription = humanDecision.feedback
                    ? `${humanDecision.feedback}${issuesContext}`
                    : `Address the following SuperReviewer feedback: ${superReviewResult.summary}${issuesContext}`;

                log.human(fullTaskDescription);

                // Recursively call runTask with the combined feedback
                return runTask(taskId, fullTaskDescription, options);
            } else {
                log.human("Human chose to abandon. Task remains in worktree for manual review.");
                return { cwd, completedSteps, totalSteps };
            }
        } else {
            log.human("✅ SuperReviewer approved - implementation ready for merge!");
        }

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

function formatRefinedTaskForPlanner(refinedTask: import("./types.js").RefinedTask): string {
    let formattedTask = refinedTask.goal;
    
    if (refinedTask.context) {
        formattedTask += `\n\nContext: ${refinedTask.context}`;
    }
    
    if (refinedTask.constraints.length > 0) {
        formattedTask += `\n\nConstraints:\n${refinedTask.constraints.map(c => `- ${c}`).join('\n')}`;
    }
    
    if (refinedTask.successCriteria.length > 0) {
        formattedTask += `\n\nSuccess Criteria:\n${refinedTask.successCriteria.map(c => `- ${c}`).join('\n')}`;
    }
    
    return formattedTask;
}
import { selectProvider } from "./providers/index.js";
import { runPlanner } from "./agents/planner.js";
import { RefinerAgent } from "./agents/refiner.js";
import { interactiveRefinement } from "./ui/refinement-interface.js";
import { proposeChange } from "./agents/coder.js";
import { reviewProposal, parseVerdict } from "./agents/reviewer.js";
import { runSuperReviewer } from "./agents/super-reviewer.js";
import { ensureWorktree } from "./git/worktrees.js";
import { mergeToMaster, cleanupWorktree } from "./git/sandbox.js";
import { log } from "./ui/log.js";
import { readFileSync } from "node:fs";
import { promptHumanReview, promptForSuperReviewerDecision } from "./ui/human-review.js";
import { generateUUID } from "./utils/id-generator.js";

export async function runTask(taskId: string, humanTask: string, options?: { autoMerge?: boolean; nonInteractive?: boolean }) {
    const provider = await selectProvider();
    const { dir: cwd } = ensureWorktree(taskId);

    // AIDEV-NOTE: Separate sessions for Coder and Reviewer for proper semi-stateful behavior
    // Each agent maintains their own conversation context and system prompt is sent only once
    const coderSessionId = generateUUID();
    const reviewerSessionId = generateUUID();
    let coderInitialized = false;
    let reviewerInitialized = false;

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
            log.orchestrator("Using refined task specification for planning.");
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

    let continueWork = true;
    let totalChanges = 0;
    const maxChanges = 20; // Safety limit to prevent infinite loops

    while (continueWork && totalChanges < maxChanges) {
        let attempts = 0;
        let feedback: string | undefined;
        let stepCompleted = false;

        while (attempts < 3 && !stepCompleted) {
            attempts++;
            log.coder(`Implementing change (attempt ${attempts})…`);
            const response = (await proposeChange(provider, cwd, planMd, feedback, coderSessionId, coderInitialized) || "").trim();
            coderInitialized = true;

            // Check for completion signal
            if (response === "COMPLETE" || response.includes("COMPLETE")) {
                log.orchestrator("Coder indicates all planned work is complete.");
                continueWork = false;
                stepCompleted = true;
                break;
            }

            // Check if coder made changes (will include CHANGE_APPLIED message)
            const changeApplied = response.includes("CHANGE_APPLIED:");
            if (!changeApplied) {
                // Coder didn't make changes, might need clarification
                log.coder(`\n${response}`);
                const msg = "✏️ revise — no changes were made. If all plan work is done, respond with 'COMPLETE', otherwise implement the next change.";
                log.review(msg);
                feedback = msg;
                continue;
            }

            // Extract the change description from the response
            const changeMatch = response.match(/CHANGE_APPLIED:\s*(.+)/i);
            const changeDescription = changeMatch ? changeMatch[1] : "Changes made";
            log.coder(`Change applied: ${changeDescription}`);

            log.review("Reviewing changes…");
            const verdictLine = await reviewProposal(provider, cwd, planMd, changeDescription, reviewerSessionId, reviewerInitialized);
            reviewerInitialized = true;
            const verdict = parseVerdict(verdictLine);
            log.review(verdictLine);

            if (verdict === "approve") {
                log.orchestrator(`✅ Changes approved and already applied by Coder`);
                stepCompleted = true;
                totalChanges++;
                // Reset feedback for next step
                feedback = undefined;
            } else if (verdict === "revise") {
                // Need to revert the changes and try again
                log.orchestrator("Reverting changes for revision...");
                const { execSync } = await import("child_process");
                execSync(`git -C "${cwd}" revert --no-edit HEAD`, { stdio: "inherit" });
                feedback = verdictLine;
            } else if (verdict === "reject") {
                // Need to revert and fundamentally rethink
                log.orchestrator("Reverting changes due to rejection...");
                const { execSync } = await import("child_process");
                execSync(`git -C "${cwd}" revert --no-edit HEAD`, { stdio: "inherit" });
                feedback = `🔴 REJECTED - Fundamental rethink needed: ${verdictLine}\n\nTake time to megathink about the approach. Read the existing code more carefully. The current approach is wrong, not just incomplete.`;
                log.orchestrator("Changes rejected - requesting complete rethink...");
            } else if (verdict === "needs-human") {
                // Prompt human for review
                const humanResult = await promptHumanReview(
                    changeDescription,
                    "Changes made by Coder",
                    verdictLine
                );

                if (humanResult.decision === "approve") {
                    log.orchestrator("Human approved changes (already applied by Coder).");
                    stepCompleted = true;
                    totalChanges++;
                    feedback = undefined;
                } else if (humanResult.decision === "retry") {
                    log.orchestrator("Human requested retry with feedback. Will revert changes.");
                    // Run git revert to undo the changes
                    const { execSync } = await import("child_process");
                    execSync(`git -C "${cwd}" revert --no-edit HEAD`, { stdio: "inherit" });
                    feedback = humanResult.feedback || "Human requested retry - please revise the implementation";
                } else if (humanResult.decision === "reject") {
                    log.orchestrator("Human rejected changes. Reverting.");
                    // Run git revert to undo the changes
                    const { execSync } = await import("child_process");
                    execSync(`git -C "${cwd}" revert --no-edit HEAD`, { stdio: "inherit" });
                    stepCompleted = true;
                    feedback = undefined;
                }
            } else {
                log.orchestrator(`Stopping. Verdict = ${verdict}.`);
                continueWork = false;
                break;
            }
        }

        if (!stepCompleted && attempts >= 3) {
            log.orchestrator(`Failed to apply changes after 3 attempts.`);
            continueWork = false;
        }

        // Always continue to next step (removed the continueUntilDone check)
    }

    // Task completion summary
    log.orchestrator(`\n📊 Task execution completed`);

    if (totalChanges >= maxChanges) {
        log.orchestrator(`⚠️ Reached maximum change limit (${maxChanges}). Stopping execution.`);
    }

    if (!continueWork || totalChanges >= maxChanges) {
        log.orchestrator("🎉 All planned changes completed successfully!");

        // Run SuperReviewer before merge decision
        log.review("🔍 Running final quality review...");
        const superReviewResult = await runSuperReviewer(
            provider,
            cwd,
            planMd
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
            log.orchestrator("⚠️ SuperReviewer identified issues requiring human review.");
            
            // Use the dedicated SuperReviewer decision prompt
            const humanDecision = await promptForSuperReviewerDecision(
                superReviewResult.summary,
                superReviewResult.issues
            );
            
            if (humanDecision.decision === "approve") {
                log.orchestrator("Human accepted work despite identified issues. Proceeding with merge options.");
            } else if (humanDecision.decision === "retry") {
                log.orchestrator("Human requested a new development cycle to address issues:");

                // Combine SuperReviewer's issues with human feedback for context
                const issuesContext = superReviewResult.issues
                    ? `\n\nSuperReviewer identified issues:\n${superReviewResult.issues.map(i => `- ${i}`).join('\n')}`
                    : "";

                const fullTaskDescription = humanDecision.feedback
                    ? `${humanDecision.feedback}${issuesContext}`
                    : `Address the following SuperReviewer feedback: ${superReviewResult.summary}${issuesContext}`;

                log.orchestrator(fullTaskDescription);

                // Recursively call runTask with the combined feedback
                return runTask(taskId, fullTaskDescription, options);
            } else {
                log.orchestrator("Human chose to abandon. Task remains in worktree for manual review.");
                return { cwd };
            }
        } else {
            log.orchestrator("✅ SuperReviewer approved - implementation ready for merge!");
        }

        if (options?.autoMerge) {
            log.orchestrator("📦 Auto-merging to master...");
            mergeToMaster(taskId, cwd);
            cleanupWorktree(taskId, cwd);
        } else {
            log.orchestrator(`\nNext steps:
1. Review changes in worktree: ${cwd}
2. Run tests to verify
3. Merge to master: git merge sandbox/${taskId}
4. Clean up: npm run cleanup-task ${taskId}`);
        }
    }

    return { cwd };
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
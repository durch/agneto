// AIDEV-NOTE: Orchestrator now uses Bean Counter for work breakdown:
// Flow: High-level plan (Planner) → Bean Counter chunks work → Coder implements → Reviewer approves → Bean Counter determines next chunk
// Bean Counter acts as "Scrum Master" maintaining session-based progress ledger and coordinating sprint cycles
// Coder becomes pure implementation executor, no longer handles chunking decisions

import { execSync } from "node:child_process";
import { selectProvider } from "./providers/index.js";
import { runPlanner } from "./agents/planner.js";
import { RefinerAgent } from "./agents/refiner.js";
import { interactiveRefinement } from "./ui/refinement-interface.js";
import { proposePlan, implementPlan } from "./agents/coder.js";
import { reviewPlan, reviewCode } from "./agents/reviewer.js";
import { getInitialChunk, getNextChunk } from "./agents/bean-counter.js";
import { runCurmudgeon } from "./agents/curmudgeon.js";
import { runSuperReviewer } from "./agents/super-reviewer.js";
import { generateCommitMessage } from "./agents/scribe.js";
import { ensureWorktree } from "./git/worktrees.js";
import { mergeToMaster, cleanupWorktree } from "./git/sandbox.js";
import { log as originalLog } from "./ui/log.js";
import { enableAuditLogging } from "./audit/integration-example.js";
import { promptForSuperReviewerDecision } from "./ui/human-review.js";
import { generateUUID } from "./utils/id-generator.js";
import { CoderReviewerStateMachine, State, Event } from "./state-machine.js";
import { TaskStateMachine, TaskState, TaskEvent } from "./task-state-machine.js";
import {
  handlePlanHumanReview,
  handleCodeHumanReview,
  revertLastCommit,
  commitChanges
} from "./orchestrator-helpers.js";
import type { CoderPlanProposal } from "./types.js";

export async function runTask(taskId: string, humanTask: string, options?: { autoMerge?: boolean; nonInteractive?: boolean }) {
    const provider = await selectProvider();
    const { dir: cwd } = ensureWorktree(taskId);

    // Initialize audit logging - wrap the log instance for comprehensive audit capture
    const { log, auditLogger } = enableAuditLogging(taskId, humanTask);

    // Initialize parent state machine
    const taskStateMachine = new TaskStateMachine(taskId, humanTask, cwd, options || {});

    // Separate sessions for Bean Counter, Coder and Reviewer
    const beanCounterSessionId = generateUUID();
    let coderSessionId = generateUUID();
    let reviewerSessionId = generateUUID();
    taskStateMachine.setSessionIds(coderSessionId, reviewerSessionId);
    let beanCounterInitialized = false;
    let coderInitialized = false;
    let reviewerInitialized = false;

    // Start the task
    taskStateMachine.transition(TaskEvent.START_TASK);

    // Main task state machine loop with audit lifecycle management
    const maxIterations = 200; // Safety limit for parent + child iterations
    let iterations = 0;
    let taskCompleted = false;

    try {
        while (taskStateMachine.canContinue() && iterations < maxIterations) {
        iterations++;

        try {
            const currentState = taskStateMachine.getCurrentState();

            switch (currentState) {
                case TaskState.TASK_REFINING: {
                    // Task refinement (interactive only)
                    log.info("🔍 Refining task description...");
                    const refinerAgent = new RefinerAgent(provider);
                    const refinedTask = await interactiveRefinement(refinerAgent, cwd, humanTask, taskId);

                    if (refinedTask) {
                        const taskToUse = formatRefinedTaskForPlanner(refinedTask);
                        taskStateMachine.setRefinedTask(refinedTask, taskToUse);
                        log.orchestrator("Using refined task specification for planning.");
                        taskStateMachine.transition(TaskEvent.REFINEMENT_COMPLETE);
                    } else {
                        log.warn("Task refinement cancelled. Using original description.");
                        taskStateMachine.transition(TaskEvent.REFINEMENT_CANCELLED);
                    }
                    break;
                }

                case TaskState.TASK_PLANNING: {
                    // Planning phase
                    let taskToUse = taskStateMachine.getContext().taskToUse || humanTask;
                    let curmudgeonFeedback: string | undefined = undefined;

                    // Check if we're coming from Curmudgeon with simplification request
                    if (taskStateMachine.getCurmudgeonFeedback()) {
                        curmudgeonFeedback = taskStateMachine.getCurmudgeonFeedback();
                        log.orchestrator(`Re-planning with Curmudgeon feedback: ${curmudgeonFeedback}`);
                        taskStateMachine.clearCurmudgeonFeedback();
                    } else if (taskStateMachine.isRetry()) {
                        // This is a retry from super review - update the task
                        taskToUse = taskStateMachine.getContext().retryFeedback ||
                                    `Address SuperReviewer feedback: ${taskStateMachine.getSuperReviewResult()?.summary}`;
                        log.orchestrator(`Re-planning with feedback: ${taskToUse}`);

                        // Update context with new task and clear retry feedback
                        taskStateMachine.setRefinedTask(
                            { goal: taskToUse, context: "", constraints: [], successCriteria: [], raw: "" },
                            taskToUse
                        );
                        taskStateMachine.clearRetryFeedback();

                        // Reset the execution state machine for a fresh cycle
                        taskStateMachine.setExecutionStateMachine(new CoderReviewerStateMachine(7, 7, taskStateMachine.getBaselineCommit()));
                    }

                    const interactive = !options?.nonInteractive;
                    if (!interactive) {
                        log.planner(`Planning "${taskToUse}"…`);
                    }

                    try {
                        const { planMd, planPath } = await runPlanner(provider, cwd, taskToUse, taskId, interactive, curmudgeonFeedback);
                        if (!interactive) {
                            log.planner(`Saved plan → ${planPath}`);
                        }
                        taskStateMachine.setPlan(planMd, planPath);
                        taskStateMachine.transition(TaskEvent.PLAN_CREATED);
                    } catch (error) {
                        log.warn(`Planning failed: ${error}`);
                        taskStateMachine.transition(TaskEvent.PLAN_FAILED, error);
                    }
                    break;
                }

                case TaskState.TASK_CURMUDGEONING: {
                    // Curmudgeon review phase - check for over-engineering
                    const planMd = taskStateMachine.getPlanMd();
                    const simplificationCount = taskStateMachine.getSimplificationCount();
                    const maxSimplifications = 2;

                    // Check if we've exceeded the simplification limit
                    if (simplificationCount >= maxSimplifications) {
                        log.orchestrator(`Reached maximum simplification attempts (${maxSimplifications}). Proceeding with current plan.`);
                        taskStateMachine.transition(TaskEvent.CURMUDGEON_APPROVED);
                        break;
                    }

                    try {
                        log.orchestrator("🧐 Curmudgeon reviewing plan for over-engineering...");

                        // Get the task description to pass to Curmudgeon
                        // This could be the refined task or the original task
                        const taskDescription = taskStateMachine.getContext().taskToUse || humanTask;

                        const result = await runCurmudgeon(provider, cwd, planMd || "", taskDescription);

                        if (!result) {
                            // Parsing failed, proceed without curmudgeon review
                            log.warn("Could not parse Curmudgeon response - proceeding with plan as-is");
                            taskStateMachine.transition(TaskEvent.CURMUDGEON_APPROVED);
                        } else if (result.verdict === "approve") {
                            log.orchestrator("✅ Curmudgeon approved the plan");
                            taskStateMachine.transition(TaskEvent.CURMUDGEON_APPROVED);
                        } else if (result.verdict === "simplify") {
                            // Check if we're still under the limit
                            if (simplificationCount < maxSimplifications - 1) {
                                log.orchestrator(`🔄 Curmudgeon requests simplification: ${result.reasoning}`);
                                // Store the feedback for the planner
                                taskStateMachine.setCurmudgeonFeedback(result.reasoning || "Plan needs simplification");
                                taskStateMachine.transition(TaskEvent.CURMUDGEON_SIMPLIFY);
                            } else {
                                // This is the last allowed simplification
                                log.orchestrator(`⚠️ Curmudgeon requests simplification but this is the final attempt (${simplificationCount + 1}/${maxSimplifications})`);
                                taskStateMachine.setCurmudgeonFeedback(result.reasoning || "Plan needs simplification");
                                taskStateMachine.transition(TaskEvent.CURMUDGEON_SIMPLIFY);
                            }
                        } else if (result.verdict === "reject") {
                            log.orchestrator(`❌ Curmudgeon rejected the plan: ${result.reasoning}`);
                            taskStateMachine.transition(TaskEvent.ERROR_OCCURRED, new Error(`Curmudgeon rejected: ${result.reasoning}`));
                        }
                    } catch (error) {
                        log.warn(`Curmudgeon review failed: ${error}`);
                        // On error, proceed without curmudgeon review
                        taskStateMachine.transition(TaskEvent.CURMUDGEON_APPROVED);
                    }
                    break;
                }

                case TaskState.TASK_EXECUTING: {
                    // Execution phase - delegate to CoderReviewerStateMachine
                    let executionStateMachine = taskStateMachine.getExecutionStateMachine();

                    if (!executionStateMachine) {
                        // Capture baseline commit to prevent reverting pre-task changes
                        if (!taskStateMachine.getBaselineCommit()) {
                            try {
                                const baselineCommit = execSync(`git -C "${cwd}" rev-parse HEAD`, { encoding: "utf8" }).trim();
                                taskStateMachine.setBaselineCommit(baselineCommit);
                                log.orchestrator(`📍 Task baseline set: ${baselineCommit.substring(0, 8)}`);
                            } catch (error) {
                                log.warn(`Failed to capture baseline commit: ${error}`);
                            }
                        }

                        // Initialize the execution state machine
                        executionStateMachine = new CoderReviewerStateMachine(7, 7, taskStateMachine.getBaselineCommit());
                        taskStateMachine.setExecutionStateMachine(executionStateMachine);
                        executionStateMachine.transition(Event.START_CHUNKING);
                    }

                    // Run the execution state machine
                    const planMd = taskStateMachine.getPlanMd();
                    if (!planMd) {
                        throw new Error("No plan available for execution");
                    }

                    const executionResult = await runExecutionStateMachine(
                        executionStateMachine,
                        provider,
                        cwd,
                        planMd,
                        beanCounterSessionId,
                        coderSessionId,
                        reviewerSessionId,
                        beanCounterInitialized,
                        coderInitialized,
                        reviewerInitialized,
                        log
                    );

                    beanCounterInitialized = executionResult.beanCounterInitialized;
                    coderInitialized = executionResult.coderInitialized;
                    reviewerInitialized = executionResult.reviewerInitialized;

                    // Check execution result
                    const finalExecutionState = executionStateMachine.getCurrentState();
                    if (finalExecutionState === State.TASK_COMPLETE) {
                        taskStateMachine.transition(TaskEvent.EXECUTION_COMPLETE);
                    } else if (finalExecutionState === State.TASK_FAILED || finalExecutionState === State.TASK_ABORTED) {
                        const error = executionStateMachine.getLastError() || new Error("Execution failed");
                        taskStateMachine.transition(TaskEvent.EXECUTION_FAILED, error);
                    } else {
                        // Should not happen, but handle gracefully
                        taskStateMachine.transition(TaskEvent.EXECUTION_FAILED, new Error("Unexpected execution state"));
                    }
                    break;
                }

                case TaskState.TASK_SUPER_REVIEWING: {
                    // Super review phase
                    const planMd = taskStateMachine.getPlanMd();
                    if (!planMd) {
                        throw new Error("No plan available for super review");
                    }

                    log.orchestrator("🔍 Running SuperReviewer for final quality check...");
                    const superReviewResult = await runSuperReviewer(provider, cwd, planMd);
                    taskStateMachine.setSuperReviewResult(superReviewResult);

                    log.review(`SuperReviewer verdict: ${superReviewResult.verdict}`);
                    log.review(`Summary: ${superReviewResult.summary}`);

                    if (superReviewResult.issues) {
                        superReviewResult.issues.forEach(issue => {
                            log.review(`Issue: ${issue}`);
                        });
                    }

                    if (superReviewResult.verdict === "needs-human") {
                        log.orchestrator("⚠️ SuperReviewer identified issues requiring human review.");
                        taskStateMachine.transition(TaskEvent.SUPER_REVIEW_NEEDS_HUMAN);

                        const humanDecision = await promptForSuperReviewerDecision(
                            superReviewResult.summary,
                            superReviewResult.issues
                        );

                        if (humanDecision.decision === "approve") {
                            log.orchestrator("Human accepted work despite identified issues.");
                            taskStateMachine.transition(TaskEvent.HUMAN_APPROVED);
                        } else if (humanDecision.decision === "retry") {
                            log.orchestrator("Human requested a new development cycle to address issues.");
                            taskStateMachine.setRetryFeedback(humanDecision.feedback ||
                                `Address SuperReviewer feedback: ${superReviewResult.summary}`);
                            taskStateMachine.transition(TaskEvent.HUMAN_RETRY);
                        } else {
                            log.orchestrator("Human chose to abandon. Task remains in worktree for manual review.");
                            taskStateMachine.transition(TaskEvent.HUMAN_ABANDON);
                        }
                    } else {
                        log.orchestrator("✅ SuperReviewer approved - implementation ready for merge!");
                        taskStateMachine.transition(TaskEvent.SUPER_REVIEW_PASSED);
                    }
                    break;
                }

                case TaskState.TASK_FINALIZING: {
                    // Finalization phase - merge or manual review
                    if (options?.autoMerge) {
                        log.orchestrator("📦 Auto-merging to master...");
                        mergeToMaster(taskId, cwd);
                        cleanupWorktree(taskId, cwd);
                        taskStateMachine.transition(TaskEvent.AUTO_MERGE);
                    } else {
                        // Provide direct git commands for npx users
                        log.orchestrator(`\nNext steps:
1. Review changes in worktree: ${cwd}
2. Run tests to verify
3. Merge to master:
   git checkout master
   git merge sandbox/${taskId} --squash
   git commit -m "Task ${taskId} completed"
4. Clean up:
   git worktree remove .worktrees/${taskId}
   git branch -D sandbox/${taskId}`);
                        taskStateMachine.transition(TaskEvent.MANUAL_MERGE);
                    }
                    break;
                }

                case TaskState.TASK_COMPLETE:
                    log.orchestrator("🎉 Task completed successfully!");
                    taskCompleted = true;
                    break;

                case TaskState.TASK_ABANDONED:
                    const error = taskStateMachine.getLastError();
                    log.orchestrator(`❌ Task abandoned: ${error?.message || "Unknown reason"}`);
                    break;

                default:
                    log.warn(`Unexpected task state: ${currentState}`);
                    taskStateMachine.transition(TaskEvent.ERROR_OCCURRED, new Error(`Unexpected state: ${currentState}`));
            }
        } catch (error) {
            log.warn(`Error in task state ${taskStateMachine.getCurrentState()}: ${error}`);
            taskStateMachine.transition(TaskEvent.ERROR_OCCURRED, error);
        }
    }

        if (iterations >= maxIterations) {
            log.orchestrator(`⚠️ Reached maximum iteration limit (${maxIterations}). Stopping execution.`);
        }

        // Mark audit task as completed if successful
        if (taskCompleted) {
            auditLogger.completeTask();
        }

    } catch (error) {
        // Mark audit task as failed on any unhandled error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        auditLogger.failTask(errorMessage);
        log.warn(`Task execution failed: ${errorMessage}`);
        throw error; // Re-throw to maintain existing error handling behavior
    }

    return { cwd };
}

// Helper function to run the execution state machine
async function runExecutionStateMachine(
    stateMachine: CoderReviewerStateMachine,
    provider: any,
    cwd: string,
    planMd: string,
    beanCounterSessionId: string,
    coderSessionId: string,
    reviewerSessionId: string,
    beanCounterInitialized: boolean,
    coderInitialized: boolean,
    reviewerInitialized: boolean,
    log: any
): Promise<{ beanCounterInitialized: boolean, coderInitialized: boolean, reviewerInitialized: boolean }> {

    // Run the execution state machine loop
    while (stateMachine.canContinue()) {
        try {
            const currentState = stateMachine.getCurrentState();

            switch (currentState) {
                case State.BEAN_COUNTING: {
                    log.orchestrator("🧮 Bean Counter: Determining work chunk...");

                    let chunk;
                    if (!beanCounterInitialized) {
                        // Initial chunking: Break down high-level plan into first chunk
                        chunk = await getInitialChunk(
                            provider,
                            cwd,
                            planMd,
                            beanCounterSessionId,
                            beanCounterInitialized
                        );
                        beanCounterInitialized = true;
                    } else {
                        // Progressive chunking: Get next chunk based on last approval
                        // Get the actual approval message from the last code review cycle
                        const context = stateMachine.getContext();
                        const lastApprovalMessage = context.codeFeedback || "Previous work was approved";

                        chunk = await getNextChunk(
                            provider,
                            cwd,
                            planMd,
                            lastApprovalMessage,
                            beanCounterSessionId,
                            beanCounterInitialized
                        );
                    }

                    if (!chunk) {
                        log.orchestrator("Failed to get chunk from Bean Counter");
                        stateMachine.transition(Event.ERROR_OCCURRED, new Error("Bean Counter failed"));
                        break;
                    }

                    if (chunk.type === "TASK_COMPLETE") {
                        log.orchestrator("🎉 Bean Counter: Task completed!");
                        stateMachine.transition(Event.TASK_COMPLETED);
                    } else {
                        log.orchestrator(`📋 Bean Counter: Next chunk - ${chunk.description}`);
                        // Generate fresh session IDs for new chunk - no pollution from previous chunks
                        coderSessionId = generateUUID();
                        reviewerSessionId = generateUUID();
                        coderInitialized = false;
                        reviewerInitialized = false;
                        stateMachine.transition(Event.CHUNK_READY, {
                            description: chunk.description,
                            requirements: chunk.requirements,
                            context: chunk.context
                        });
                    }
                    break;
                }

                case State.PLANNING: {
                    // Increment attempts at the start of each try
                    stateMachine.incrementPlanAttempts();

                    const attempts = stateMachine.getPlanAttempts();
                    const maxAttempts = stateMachine.getContext().maxPlanAttempts;

                    // Check if we've exceeded max attempts
                    if (attempts > maxAttempts) {
                        log.orchestrator(`Max planning attempts (${maxAttempts}) exceeded`);
                        stateMachine.transition(Event.MAX_ATTEMPTS_REACHED);
                        break;
                    }

                    // Get feedback from context if this is a revision
                    const feedback = stateMachine.getPlanFeedback() || undefined;

                    if (feedback) {
                        log.orchestrator(`📝 Revising plan (attempt ${attempts}/${maxAttempts})...`);
                    } else {
                        log.orchestrator(`📝 Planning next implementation step (attempt ${attempts}/${maxAttempts})...`);
                    }

                    // Coder proposes implementation for the Bean Counter's chunk
                    const currentChunk = stateMachine.getCurrentChunk();
                    if (!currentChunk) {
                        throw new Error("No chunk available from Bean Counter");
                    }

                    const chunkDescription = `${currentChunk.description}\n\nRequirements:\n${currentChunk.requirements.map(r => `- ${r}`).join('\n')}\n\nContext: ${currentChunk.context}`;

                    let proposal = await proposePlan(
                        provider,
                        cwd,
                        chunkDescription,
                        feedback,
                        coderSessionId,
                        coderInitialized
                    );
                    coderInitialized = true;

                    // Always proceed to plan review, no short-circuits
                    if (!proposal) {
                        // This shouldn't happen now, but handle gracefully
                        log.info("No plan generated - creating minimal proposal");
                        proposal = {
                            type: "PLAN_PROPOSAL" as const,
                            description: "No changes needed for this chunk",
                            steps: [],
                            affectedFiles: []
                        };
                    }

                    // Always transition to PLAN_PROPOSED - let the review cycle continue
                    log.coder(`📢 Planning to: ${proposal.description}`);
                    stateMachine.transition(Event.PLAN_PROPOSED, proposal);
                    break;
                }

                case State.PLAN_REVIEW: {
                    log.review("Reviewing proposed approach...");

                    const proposal = stateMachine.getCurrentPlan();
                    if (!proposal) {
                        log.warn("No plan to review!");
                        stateMachine.transition(Event.ERROR_OCCURRED, new Error("No plan available"));
                        break;
                    }

                    // Get current chunk for reviewer context
                    const reviewChunk = stateMachine.getCurrentChunk();
                    if (!reviewChunk) {
                        throw new Error("No chunk available for reviewer");
                    }

                    // Reviewer reviews plan against chunk requirements
                    const verdict = await reviewPlan(
                        provider,
                        cwd,
                        reviewChunk,
                        proposal,
                        reviewerSessionId,
                        reviewerInitialized
                    );
                    reviewerInitialized = true;

                    log.review(`Plan verdict: ${verdict.verdict}${verdict.feedback ? ` - ${verdict.feedback}` : ''}`);

                    // Handle verdict
                    switch (verdict.verdict) {
                        case 'approve-plan':
                            stateMachine.transition(Event.PLAN_APPROVED);
                            break;

                        case 'already-complete':
                            // Work is already done, mark chunk as complete and continue to next
                            log.orchestrator(`✅ Chunk already complete: ${verdict.feedback}`);
                            stateMachine.transition(Event.CODE_APPROVED, verdict.feedback);
                            break;

                        case 'revise-plan':
                            stateMachine.transition(Event.PLAN_REVISION_REQUESTED, verdict.feedback);
                            break;

                        case 'reject-plan':
                            stateMachine.transition(Event.PLAN_REJECTED, verdict.feedback);
                            break;

                        case 'needs-human':
                            const planDecision = await handlePlanHumanReview(proposal, verdict.feedback || "");

                            if (planDecision.decision === 'approve') {
                                stateMachine.transition(Event.PLAN_APPROVED);
                            } else if (planDecision.decision === 'revise') {
                                stateMachine.transition(Event.PLAN_REVISION_REQUESTED, planDecision.feedback);
                            } else {
                                stateMachine.transition(Event.PLAN_REJECTED, planDecision.feedback);
                            }
                            break;
                    }
                    break;
                }

                case State.IMPLEMENTING: {
                    // Increment attempts at the start of each try
                    stateMachine.incrementCodeAttempts();

                    const attempts = stateMachine.getCodeAttempts();
                    const maxAttempts = stateMachine.getContext().maxCodeAttempts;

                    // Check if we've exceeded max attempts
                    if (attempts > maxAttempts) {
                        log.orchestrator(`Max implementation attempts (${maxAttempts}) exceeded`);
                        stateMachine.transition(Event.MAX_ATTEMPTS_REACHED);
                        break;
                    }

                    const feedback = stateMachine.getCodeFeedback() || undefined;

                    if (feedback) {
                        log.orchestrator(`🔨 Revising implementation (attempt ${attempts}/${maxAttempts})...`);
                    } else {
                        log.orchestrator(`🔨 Implementing approved plan (attempt ${attempts}/${maxAttempts})...`);
                    }

                    const approvedPlan = stateMachine.getCurrentPlan();
                    if (!approvedPlan) {
                        log.warn("No approved plan to implement!");
                        stateMachine.transition(Event.ERROR_OCCURRED, new Error("No plan available"));
                        break;
                    }

                    // Coder implements the approved plan
                    const response = await implementPlan(
                        provider,
                        cwd,
                        approvedPlan,
                        feedback,
                        coderSessionId,
                        true  // Already initialized from planning phase
                    );

                    // Check if Coder applied changes
                    if (response.includes("CODE_APPLIED:")) {
                        const changeMatch = response.match(/CODE_APPLIED:\s*(.+)/i);
                        const changeDescription = changeMatch ? changeMatch[1] : "Changes made";
                        log.coder(`Applied: ${changeDescription}`);
                    } else {
                        log.info("No changes were needed - work already complete");
                    }
                    // Always transition to CODE_APPLIED - let reviewer validate the approach
                    stateMachine.transition(Event.CODE_APPLIED);
                    break;
                }

                case State.CODE_REVIEW: {
                    log.review("Reviewing code changes...");

                    const changeDescription = stateMachine.getCurrentPlan()?.description || "Changes made";

                    // Get current chunk for reviewer context
                    const reviewChunk = stateMachine.getCurrentChunk() || null;

                    // Reviewer reviews code
                    const verdict = await reviewCode(
                        provider,
                        cwd,
                        reviewChunk,
                        changeDescription,
                        reviewerSessionId,
                        true  // Already initialized from planning phase
                    );

                    log.review(`Code verdict: ${verdict.verdict}${verdict.feedback ? ` - ${verdict.feedback}` : ''}`);

                    // Handle verdict
                    switch (verdict.verdict) {
                        case 'approve-code':
                        case 'step-complete':
                            log.orchestrator("✅ Code changes approved");
                            // Generate proper commit message using scribe
                            const commitMsg1 = await generateCommitMessage(provider, cwd);
                            await commitChanges(cwd, commitMsg1);
                            // Store approval feedback for Bean Counter to track progress
                            stateMachine.setCodeFeedback(verdict.feedback || `Approved: ${changeDescription}`);
                            stateMachine.transition(Event.CODE_APPROVED);
                            break;

                        case 'task-complete':
                            // ALWAYS go back to Bean Counter - only Bean Counter decides task completion
                            log.orchestrator("✅ Chunk complete - returning to Bean Counter");
                            // Generate proper commit message using scribe
                            const commitMsg2 = await generateCommitMessage(provider, cwd);
                            await commitChanges(cwd, commitMsg2);
                            // Store completion feedback for Bean Counter to track progress
                            stateMachine.setCodeFeedback(verdict.feedback || `Completed: ${changeDescription}`);
                            stateMachine.transition(Event.CODE_APPROVED);
                            break;

                        case 'revise-code':
                            await revertLastCommit(cwd, stateMachine.getContext().baselineCommit);
                            stateMachine.transition(Event.CODE_REVISION_REQUESTED, verdict.feedback);
                            break;

                        case 'reject-code':
                            await revertLastCommit(cwd, stateMachine.getContext().baselineCommit);
                            stateMachine.transition(Event.CODE_REJECTED, verdict.feedback);
                            break;

                        case 'needs-human':
                            const codeDecision = await handleCodeHumanReview(
                                changeDescription,
                                verdict.feedback || ""
                            );

                            if (codeDecision.decision === 'approve') {
                                // Generate proper commit message using scribe
                                const commitMsg3 = await generateCommitMessage(provider, cwd);
                                await commitChanges(cwd, commitMsg3);
                                // Store approval feedback for Bean Counter to track progress
                                stateMachine.setCodeFeedback(codeDecision.feedback || `Human approved: ${changeDescription}`);
                                stateMachine.transition(Event.CODE_APPROVED);
                            } else if (codeDecision.decision === 'revise') {
                                await revertLastCommit(cwd, stateMachine.getContext().baselineCommit);
                                stateMachine.transition(Event.CODE_REVISION_REQUESTED, codeDecision.feedback);
                            } else {
                                await revertLastCommit(cwd, stateMachine.getContext().baselineCommit);
                                stateMachine.transition(Event.CODE_REJECTED, codeDecision.feedback);
                            }
                            break;
                    }
                    break;
                }

                case State.TASK_COMPLETE:
                case State.TASK_FAILED:
                case State.TASK_ABORTED:
                    // Terminal states - exit loop
                    break;

                default:
                    log.warn(`Unexpected state: ${currentState}`);
                    stateMachine.transition(Event.ERROR_OCCURRED, new Error(`Unexpected state: ${currentState}`));
            }
        } catch (error) {
            log.warn(`Error in state ${stateMachine.getCurrentState()}: ${error}`);
            stateMachine.transition(Event.ERROR_OCCURRED, error);
        }
    }

    // Return the initialization state
    return { beanCounterInitialized, coderInitialized, reviewerInitialized };
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
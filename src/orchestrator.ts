// AIDEV-NOTE: Orchestrator now uses Bean Counter for work breakdown:
// Flow: High-level plan (Planner) → Bean Counter chunks work → Coder implements → Reviewer approves → Bean Counter determines next chunk
// Bean Counter acts as "Scrum Master" maintaining session-based progress ledger and coordinating sprint cycles
// Coder becomes pure implementation executor, no longer handles chunking decisions

import React from 'react';
import { render } from 'ink';
import { execSync } from "node:child_process";
import { selectProvider } from "./providers/index.js";
import { runPlanner } from "./agents/planner.js";
import { RefinerAgent } from "./agents/refiner.js";
import { interactiveRefinement, type RefinementFeedback } from "./ui/refinement-interface.js";
import { App } from './ui/ink/App.js';
import { getPlanFeedback, type PlanFeedback } from './ui/planning-interface.js';
import { proposePlan, implementPlan } from "./agents/coder.js";
import { reviewPlan, reviewCode } from "./agents/reviewer.js";
import { getInitialChunk, getNextChunk } from "./agents/bean-counter.js";
import { runCurmudgeon } from "./agents/curmudgeon.js";
import { runSuperReviewer } from "./agents/super-reviewer.js";
import { generateCommitMessage } from "./agents/scribe.js";
import { summarizeCoderOutput, summarizeReviewerOutput } from "./agents/summarizer.js";
import { ensureWorktree } from "./git/worktrees.js";
import { mergeToMaster, cleanupWorktree } from "./git/sandbox.js";
import { log as originalLog } from "./ui/log.js";
import { enableAuditLogging } from "./audit/integration-example.js";
import { CheckpointService } from "./audit/checkpoint-service.js";
import { RestorationService } from "./audit/restoration-service.js";
import { promptForSuperReviewerDecision } from "./ui/human-review.js";
import { generateUUID } from "./utils/id-generator.js";
import { bell } from "./utils/terminal-bell.js";
import { CoderReviewerStateMachine, State, Event } from "./state-machine.js";
import { TaskStateMachine, TaskState, TaskEvent } from "./task-state-machine.js";
import type { SuperReviewerDecision } from './types.js';
import {
  handlePlanHumanReview,
  handleCodeHumanReview,
  revertLastCommit,
  commitChanges,
  documentTaskCompletion
} from "./orchestrator-helpers.js";
import type { CoderPlanProposal } from "./types.js";
import type { RecoveryDecision } from "./cli.js";

export async function runTask(taskId: string, humanTask: string, options?: { autoMerge?: boolean; nonInteractive?: boolean; uiMode?: string; recoveryDecision?: RecoveryDecision }) {
    const provider = await selectProvider();
    const { dir: cwd } = ensureWorktree(taskId);

    // Initialize audit logging - wrap the log instance for comprehensive audit capture
    const { log, auditLogger } = enableAuditLogging(taskId, humanTask);

    // Initialize checkpoint service for audit-driven recovery
    const checkpointService = new CheckpointService(taskId, cwd);

    // Initialize session variables (may be overridden by restoration)
    let beanCounterSessionId = generateUUID();
    let coderSessionId = generateUUID();
    let reviewerSessionId = generateUUID();
    let beanCounterInitialized = false;
    let coderInitialized = false;
    let reviewerInitialized = false;

    // Setup UI callback mechanism for Ink mode (available for both fresh and restored tasks)
    let uiCallback: ((feedbackPromise: Promise<PlanFeedback>, rerenderCallback?: () => void) => void) | undefined = undefined;
    let inkInstance: { waitUntilExit: () => Promise<void>; unmount: () => void; rerender: (node: React.ReactElement) => void } | null = null;

    if (options?.uiMode === 'ink') {
        log.orchestrator("🖥️ Ink UI mode enabled - UI callback mechanism will be available for plan feedback");
        // The actual callback will be set up when the Ink UI is rendered
        // to properly wire up the promise resolver mechanism
    }

    // Check for checkpoint restoration request
    if (options?.recoveryDecision?.action === "resume") {
        log.orchestrator("🔄 Checkpoint restoration requested...");

        const restorationService = new RestorationService(taskId, cwd);
        const checkpointNumber = options.recoveryDecision.checkpointNumber;

        if (!checkpointNumber) {
            log.warn("❌ No checkpoint number provided for restoration. Starting fresh.");
        } else {
            try {
                // Validate restoration possibility
                const canRestore = restorationService.canRestore();
                if (!canRestore.possible) {
                    log.warn(`❌ Restoration not possible: ${canRestore.reason}. Starting fresh.`);
                } else {
                    // Attempt restoration
                    const restorationResult = await restorationService.restoreFromCheckpoint(checkpointNumber);

                    if (restorationResult.success && restorationResult.restoredState) {
                        log.orchestrator("✅ Checkpoint restoration completed successfully!");

                        // Initialize parent state machine with restored context
                        const taskStateMachine = new TaskStateMachine(taskId, humanTask, cwd, options || {}, auditLogger);

                        // Set TaskStateMachine reference in AuditLogger for phase tracking
                        auditLogger.setTaskStateMachine(taskStateMachine);

                        // Restore task state machine
                        const taskStateRestore = restorationService.restoreTaskStateMachine(
                            taskStateMachine,
                            restorationResult.restoredState.taskState
                        );

                        if (!taskStateRestore.success) {
                            log.warn(`⚠️ Task state restoration failed: ${taskStateRestore.error}. Starting fresh.`);
                        } else {
                            // Restore execution state machine if present
                            let restoredExecutionStateMachine: CoderReviewerStateMachine | undefined;
                            if (restorationResult.restoredState.executionState) {
                                restoredExecutionStateMachine = new CoderReviewerStateMachine(7, 7, restorationResult.restoredState.fileSystemState.baseCommitHash, auditLogger);
                                const execStateRestore = restorationService.restoreExecutionStateMachine(
                                    restoredExecutionStateMachine,
                                    restorationResult.restoredState.executionState
                                );

                                if (!execStateRestore.success) {
                                    log.warn(`⚠️ Execution state restoration failed: ${execStateRestore.error}. Will reinitialize during execution.`);
                                    restoredExecutionStateMachine = undefined;
                                } else {
                                    taskStateMachine.setExecutionStateMachine(restoredExecutionStateMachine);
                                }
                            }

                            // Restore session data
                            const sessionRestore = restorationService.restoreAgentSessions(restorationResult.restoredState.sessionState);
                            let restoredBeanCounterSessionId = beanCounterSessionId;
                            let restoredCoderSessionId = coderSessionId;
                            let restoredReviewerSessionId = reviewerSessionId;
                            let restoredBeanCounterInitialized = false;
                            let restoredCoderInitialized = false;
                            let restoredReviewerInitialized = false;

                            if (sessionRestore.success && sessionRestore.restoredSessions) {
                                // Use restored session IDs if available
                                if (sessionRestore.restoredSessions.beanCounter) {
                                    restoredBeanCounterSessionId = sessionRestore.restoredSessions.beanCounter;
                                    restoredBeanCounterInitialized = restorationResult.restoredState.sessionState.initialized.beanCounterInitialized;
                                }
                                if (sessionRestore.restoredSessions.coder) {
                                    restoredCoderSessionId = sessionRestore.restoredSessions.coder;
                                    restoredCoderInitialized = restorationResult.restoredState.sessionState.initialized.coderInitialized;
                                }
                                if (sessionRestore.restoredSessions.reviewer) {
                                    restoredReviewerSessionId = sessionRestore.restoredSessions.reviewer;
                                    restoredReviewerInitialized = restorationResult.restoredState.sessionState.initialized.reviewerInitialized;
                                }

                                // Update task state machine with restored session IDs
                                taskStateMachine.setSessionIds(restoredCoderSessionId, restoredReviewerSessionId);

                                // Restore Bean Counter session
                                const beanCounterRestore = restorationService.restoreBeanCounterSession(
                                    restoredBeanCounterSessionId,
                                    restorationResult.restoredState.beanCounterState
                                );

                                if (!beanCounterRestore.success) {
                                    log.warn(`⚠️ Bean Counter session restoration failed: ${beanCounterRestore.error}. Will reinitialize.`);
                                    restoredBeanCounterInitialized = false;
                                }
                            }

                            // Set baseline commit from restored file system state
                            if (restorationResult.restoredState.fileSystemState.baseCommitHash) {
                                taskStateMachine.setBaselineCommit(restorationResult.restoredState.fileSystemState.baseCommitHash);
                                log.orchestrator(`📍 Baseline commit restored: ${restorationResult.restoredState.fileSystemState.baseCommitHash.substring(0, 8)}`);
                            }

                            // Override the initialization variables with restored state
                            beanCounterSessionId = restoredBeanCounterSessionId;
                            coderSessionId = restoredCoderSessionId;
                            reviewerSessionId = restoredReviewerSessionId;
                            beanCounterInitialized = restoredBeanCounterInitialized;
                            coderInitialized = restoredCoderInitialized;
                            reviewerInitialized = restoredReviewerInitialized;

                            log.orchestrator("🎯 Task resuming from checkpoint...");

                            // Continue with the restored task state machine
                            return await runRestoredTask(
                                taskStateMachine,
                                provider,
                                cwd,
                                log,
                                auditLogger,
                                checkpointService,
                                beanCounterSessionId,
                                coderSessionId,
                                reviewerSessionId,
                                beanCounterInitialized,
                                coderInitialized,
                                reviewerInitialized,
                                uiCallback,
                                inkInstance,
                                options
                            );
                        }
                    } else {
                        log.warn(`❌ Checkpoint restoration failed: ${restorationResult.error}. Starting fresh.`);
                    }
                }
            } catch (error) {
                log.warn(`❌ Restoration error: ${error instanceof Error ? error.message : 'Unknown error'}. Starting fresh.`);
            }
        }
    }

    // Initialize parent state machine
    const taskStateMachine = new TaskStateMachine(taskId, humanTask, cwd, options || {}, auditLogger);

    // Set session IDs for task state machine
    taskStateMachine.setSessionIds(coderSessionId, reviewerSessionId);

    // Set TaskStateMachine reference in AuditLogger for phase tracking
    auditLogger.setTaskStateMachine(taskStateMachine);

    // Setup Ink UI first if enabled - UI is the app!
    // Conditional Ink UI rendering for main task path
    if (options?.uiMode === 'ink') {
        try {
            // Create Promise-based callback mechanism for plan feedback
            let planFeedbackResolver: ((feedback: PlanFeedback) => void) | null = null;
            const createPlanFeedbackPromise = () => new Promise<PlanFeedback>((resolve) => {
                planFeedbackResolver = resolve;
            });

            // Create callback function that resolves the Promise when user provides feedback
            const handlePlanFeedback = (feedback: PlanFeedback) => {
                if (planFeedbackResolver) {
                    planFeedbackResolver(feedback);
                    planFeedbackResolver = null; // Clean up resolver
                }
            };

            // Update uiCallback to wire up the resolver from the planner's promise and provide rerender
            uiCallback = (feedbackPromise: Promise<PlanFeedback>, rerenderCallback?: () => void) => {
                // Extract and store the resolver from the planner's promise
                // The planner attaches the resolver to the promise object
                planFeedbackResolver = (feedbackPromise as any).resolve;

                // If rerender is requested, update the Ink UI
                if (rerenderCallback && inkInstance) {
                    // Re-render the Ink UI (App will read current state dynamically)
                    inkInstance.rerender(React.createElement(App, {
                        taskStateMachine,
                        onPlanFeedback: handlePlanFeedback
                    }));
                    rerenderCallback();
                }
            };

            // Render Ink UI immediately - it will observe state changes
            // Don't pass currentState as prop - let App read it dynamically
            const { unmount, waitUntilExit, rerender } = render(React.createElement(App, {
                taskStateMachine,
                onPlanFeedback: handlePlanFeedback
            }));

            // Store the Ink instance with all necessary methods
            inkInstance = { unmount, waitUntilExit, rerender };

            // Keep the Ink app alive by waiting on it
            inkInstance.waitUntilExit().then(() => {
                log.orchestrator("Ink UI exited");
            }).catch(error => {
                log.orchestrator(`Ink UI exit error: ${error}`);
            });

            log.orchestrator("🖥️ Ink UI started - will display all task phases");
        } catch (error) {
            log.warn(`⚠️ Failed to render Ink UI: ${error instanceof Error ? error.message : 'Unknown error'}`);
            log.warn("Falling back to standard interactive planning interface");
            uiCallback = undefined; // Ensure fallback to existing behavior
        }
    }

    // Start the task
    taskStateMachine.transition(TaskEvent.START_TASK);

    // Update Ink UI to reflect initial state change
    if (inkInstance) {
        inkInstance.rerender(React.createElement(App, {
            taskStateMachine,
            onPlanFeedback: undefined  // Will be set when needed
        }));
    }

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
                    // Task refinement through UI
                    if (inkInstance) {
                        // Use UI-based refinement
                        log.info("🔍 Refining task description...");
                        const refinerAgent = new RefinerAgent(provider);

                        // Generate refinement
                        const refinedTask = await refinerAgent.refine(cwd, humanTask, taskId);

                        // Store as pending for UI approval
                        taskStateMachine.setPendingRefinement(refinedTask);

                        // Create promise for UI feedback
                        let resolverFunc: ((value: RefinementFeedback) => void) | null = null;
                        const feedbackPromise = new Promise<RefinementFeedback>((resolve) => {
                            resolverFunc = resolve;
                        });
                        // Attach the resolver to the promise object for the UI to access
                        (feedbackPromise as any).resolve = resolverFunc;

                        // Create callback for UI to wire up
                        const refinementCallback = (feedback: Promise<RefinementFeedback>, rerenderCallback?: () => void) => {
                            // Wire up the promise resolver to the UI handler
                            (feedback as any).resolve = resolverFunc;
                        };

                        // Update UI to show pending refinement with approval callback
                        inkInstance.rerender(React.createElement(App, {
                            taskStateMachine,
                            onPlanFeedback: undefined,
                            onRefinementFeedback: refinementCallback
                        }));

                        // Invoke callback with promise
                        refinementCallback(feedbackPromise);

                        // Wait for UI feedback
                        const feedback = await feedbackPromise;

                        if (feedback.type === "approve") {
                            const taskToUse = formatRefinedTaskForPlanner(refinedTask);
                            taskStateMachine.setRefinedTask(refinedTask, taskToUse);
                            log.orchestrator("Using refined task specification for planning.");
                            taskStateMachine.transition(TaskEvent.REFINEMENT_COMPLETE);

                            // Update UI after approval
                            inkInstance.rerender(React.createElement(App, {
                                taskStateMachine,
                                onPlanFeedback: undefined,
                                onRefinementFeedback: undefined
                            }));
                        } else {
                            log.warn("Task refinement rejected. Using original description.");
                            taskStateMachine.transition(TaskEvent.REFINEMENT_CANCELLED);

                            // Update UI after rejection
                            inkInstance.rerender(React.createElement(App, {
                                taskStateMachine,
                                onPlanFeedback: undefined,
                                onRefinementFeedback: undefined
                            }));
                        }
                    } else {
                        // Fallback to interactive refinement if no UI
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
                    }
                    break;
                }

                case TaskState.TASK_PLANNING: {
                    // Planning phase

                    // Set live activity message for planner
                    taskStateMachine.setLiveActivityMessage('Planner', 'Creating strategic plan...');

                    // Re-render UI to show planning state before generating plan
                    if (inkInstance) {
                        inkInstance.rerender(React.createElement(App, {
                            taskStateMachine,
                            onPlanFeedback: undefined,
                            onRefinementFeedback: undefined
                        }));
                    }

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
                        taskStateMachine.setExecutionStateMachine(new CoderReviewerStateMachine(7, 7, taskStateMachine.getBaselineCommit(), auditLogger));
                    }

                    const interactive = !options?.nonInteractive;
                    if (!interactive) {
                        log.planner(`Planning "${taskToUse}"…`);
                    }

                    try {
                        // Get SuperReviewer feedback if this is a retry cycle
                        const superReviewerFeedback = taskStateMachine.isRetry() ? taskStateMachine.getSuperReviewResult() : undefined;

                        // For Ink UI mode, handle plan approval like refiner
                        if (inkInstance && interactive) {
                            // Generate the plan without UI callback
                            const { planMd, planPath } = await runPlanner(provider, cwd, taskToUse, taskId, false, curmudgeonFeedback, superReviewerFeedback, undefined, taskStateMachine, inkInstance);

                            // Store the plan in state machine
                            taskStateMachine.setPlan(planMd, planPath);

                            // Re-render UI to show the plan
                            inkInstance.rerender(React.createElement(App, {
                                taskStateMachine,
                                onPlanFeedback: undefined,
                                onRefinementFeedback: undefined
                            }));

                            // Create promise for UI feedback
                            let resolverFunc: ((value: PlanFeedback) => void) | null = null;
                            const feedbackPromise = new Promise<PlanFeedback>((resolve) => {
                                resolverFunc = resolve;
                            });
                            // Attach the resolver to the promise object for the UI to access
                            (feedbackPromise as any).resolve = resolverFunc;

                            // Create callback for UI to wire up
                            const planCallback = (feedback: PlanFeedback) => {
                                resolverFunc?.(feedback);
                            };

                            // Update UI to show plan with approval callback
                            inkInstance.rerender(React.createElement(App, {
                                taskStateMachine,
                                onPlanFeedback: planCallback,
                                onRefinementFeedback: undefined
                            }));

                            // Wait for UI feedback
                            const feedback = await feedbackPromise;

                            if (feedback.type === "approve") {
                                log.orchestrator("Plan approved by user.");
                                taskStateMachine.transition(TaskEvent.PLAN_CREATED);
                            } else {
                                // Handle plan rejection - could loop back or abort
                                log.warn("Plan rejected by user. Aborting task.");
                                taskStateMachine.transition(TaskEvent.PLAN_FAILED, new Error("User rejected plan"));
                            }

                            // Clean up the callback after use
                            inkInstance.rerender(React.createElement(App, {
                                taskStateMachine,
                                onPlanFeedback: undefined,
                                onRefinementFeedback: undefined
                            }));

                            // Clear live activity message after Ink UI planning completes
                            taskStateMachine.clearLiveActivityMessage();

                        } else {
                            // Non-interactive mode - original behavior
                            const { planMd, planPath } = await runPlanner(provider, cwd, taskToUse, taskId, interactive, curmudgeonFeedback, superReviewerFeedback, uiCallback, taskStateMachine, inkInstance);
                            if (!interactive) {
                                // Display the full plan content in non-interactive mode
                                if (planMd) {
                                    log.planner(planMd);
                                }
                                log.planner(`Saved plan → ${planPath}`);
                            }
                            taskStateMachine.setPlan(planMd, planPath);
                            taskStateMachine.transition(TaskEvent.PLAN_CREATED);

                            // Clear live activity message after non-interactive planning completes
                            taskStateMachine.clearLiveActivityMessage();
                        }
                    } catch (error) {
                        log.warn(`Planning failed: ${error}`);
                        // Clear live activity message on planner error
                        taskStateMachine.clearLiveActivityMessage();
                        taskStateMachine.transition(TaskEvent.PLAN_FAILED, error);
                    }
                    break;
                }

                case TaskState.TASK_CURMUDGEONING: {
                    // Curmudgeon review phase - check for over-engineering
                    const planMd = taskStateMachine.getPlanMd();
                    const simplificationCount = taskStateMachine.getSimplificationCount();
                    const maxSimplifications = 2;

                    // Update UI to show we're entering curmudgeon phase
                    if (inkInstance) {
                        inkInstance.rerender(React.createElement(App, {
                            taskStateMachine,
                            onPlanFeedback: undefined,
                            onRefinementFeedback: undefined
                        }));
                    }

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

                                // Update UI to show feedback before transitioning
                                if (inkInstance) {
                                    inkInstance.rerender(React.createElement(App, {
                                        taskStateMachine,
                                        onPlanFeedback: undefined,
                                        onRefinementFeedback: undefined
                                    }));
                                }

                                taskStateMachine.transition(TaskEvent.CURMUDGEON_SIMPLIFY);
                            } else {
                                // This is the last allowed simplification
                                log.orchestrator(`⚠️ Curmudgeon requests simplification but this is the final attempt (${simplificationCount + 1}/${maxSimplifications})`);
                                taskStateMachine.setCurmudgeonFeedback(result.reasoning || "Plan needs simplification");

                                // Update UI to show feedback before transitioning
                                if (inkInstance) {
                                    inkInstance.rerender(React.createElement(App, {
                                        taskStateMachine,
                                        onPlanFeedback: undefined,
                                        onRefinementFeedback: undefined
                                    }));
                                }

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
                    // Keep Ink UI alive during execution phase for real-time updates
                    if (inkInstance) {
                        log.orchestrator("🖥️ Ink UI will continue displaying execution phase...");
                        // Re-render to show execution phase
                        inkInstance.rerender(React.createElement(App, {
                            taskStateMachine,
                            onPlanFeedback: undefined,
                            onRefinementFeedback: undefined
                        }));
                    }

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
                        executionStateMachine = new CoderReviewerStateMachine(7, 7, taskStateMachine.getBaselineCommit(), auditLogger);
                        taskStateMachine.setExecutionStateMachine(executionStateMachine);
                        executionStateMachine.transition(Event.START_CHUNKING);
                    } else if (taskStateMachine.getContext().retryFeedback) {
                        // We're retrying after SuperReviewer feedback - reset the state machine
                        log.orchestrator("🔄 Resetting execution state machine for retry cycle");
                        executionStateMachine = new CoderReviewerStateMachine(7, 7, taskStateMachine.getBaselineCommit(), auditLogger);
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
                        log,
                        checkpointService,
                        taskStateMachine,
                        inkInstance
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

                        // Create promise for UI-based decision (following refinement pattern)
                        let superReviewerResolverFunc: ((value: SuperReviewerDecision) => void) | null = null;
                        const superReviewerDecisionPromise = new Promise<SuperReviewerDecision>((resolve) => {
                            superReviewerResolverFunc = resolve;
                        });
                        // Attach the resolver to the promise object for the UI to access
                        (superReviewerDecisionPromise as any).resolve = superReviewerResolverFunc;

                        // Create callback for UI to wire up
                        const superReviewerCallback = (decision: Promise<SuperReviewerDecision>) => {
                            // Wire up the promise resolver to the UI handler
                            (decision as any).resolve = superReviewerResolverFunc;
                        };

                        // Update UI to show SuperReviewer results with decision callback
                        if (inkInstance) {
                            inkInstance.rerender(React.createElement(App, {
                                taskStateMachine,
                                onPlanFeedback: undefined,
                                onRefinementFeedback: undefined,
                                onSuperReviewerDecision: superReviewerCallback
                            }));

                            // Invoke callback with promise
                            superReviewerCallback(superReviewerDecisionPromise);
                        }

                        // Wait for UI decision
                        const humanDecision = await superReviewerDecisionPromise;

                        if (humanDecision.action === "approve") {
                            log.orchestrator("Human accepted work despite identified issues.");

                            // Update CLAUDE.md documentation with task completion (even for incomplete acceptance)
                            log.orchestrator("📝 Updating CLAUDE.md with task documentation (incomplete acceptance)...");
                            const taskDescription = taskStateMachine.getContext().taskToUse || taskStateMachine.getContext().humanTask;
                            await documentTaskCompletion(
                                provider,
                                cwd,
                                taskStateMachine.getContext().taskId,
                                taskDescription,
                                planMd
                            );

                            taskStateMachine.transition(TaskEvent.HUMAN_APPROVED);
                        } else if (humanDecision.action === "retry") {
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

                        // Update CLAUDE.md documentation with task completion
                        log.orchestrator("📝 Updating CLAUDE.md with task documentation...");
                        const taskDescription = taskStateMachine.getContext().taskToUse || taskStateMachine.getContext().humanTask;
                        await documentTaskCompletion(
                            provider,
                            cwd,
                            taskStateMachine.getContext().taskId,
                            taskDescription,
                            planMd
                        );

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
                    bell();
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
            bell();
            auditLogger.completeTask();
        }

    } catch (error) {
        // Mark audit task as failed on any unhandled error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        auditLogger.failTask(errorMessage);
        log.warn(`Task execution failed: ${errorMessage}`);
        throw error; // Re-throw to maintain existing error handling behavior
    } finally {
        // Ensure Ink UI is cleaned up if it's still running
        if (inkInstance) {
            try {
                log.orchestrator("🧹 Cleaning up Ink UI...");
                inkInstance.unmount();
                await inkInstance.waitUntilExit();
                inkInstance = null;
            } catch (cleanupError) {
                log.warn(`⚠️ Ink UI cleanup error: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`);
            }
        }
    }

    return { cwd };
}

// Helper function to run restored task with existing state machines
async function runRestoredTask(
    taskStateMachine: TaskStateMachine,
    provider: any,
    cwd: string,
    log: any,
    auditLogger: any,
    checkpointService: CheckpointService,
    beanCounterSessionId: string,
    coderSessionId: string,
    reviewerSessionId: string,
    beanCounterInitialized: boolean,
    coderInitialized: boolean,
    reviewerInitialized: boolean,
    uiCallback: ((feedbackPromise: Promise<PlanFeedback>, rerenderCallback?: () => void) => void) | undefined,
    inkInstance: { waitUntilExit: () => Promise<void>; unmount: () => void; rerender: (node: React.ReactElement) => void } | null,
    options?: { autoMerge?: boolean; nonInteractive?: boolean; recoveryDecision?: RecoveryDecision }
): Promise<{ cwd: string }> {
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
                        const refinedTask = await interactiveRefinement(refinerAgent, cwd, taskStateMachine.getContext().humanTask, taskStateMachine.getContext().taskId);

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
                        let taskToUse = taskStateMachine.getContext().taskToUse || taskStateMachine.getContext().humanTask;
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
                            taskStateMachine.setExecutionStateMachine(new CoderReviewerStateMachine(7, 7, taskStateMachine.getBaselineCommit(), auditLogger));
                        }

                        const interactive = !options?.nonInteractive;
                        if (!interactive) {
                            log.planner(`Planning "${taskToUse}"…`);
                        }

                        try {
                            // Get SuperReviewer feedback if this is a retry cycle
                            const superReviewerFeedback = taskStateMachine.isRetry() ? taskStateMachine.getSuperReviewResult() : undefined;

                            const { planMd, planPath } = await runPlanner(provider, cwd, taskToUse, taskStateMachine.getContext().taskId, interactive, curmudgeonFeedback, superReviewerFeedback, uiCallback, taskStateMachine, inkInstance);
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
                            const taskDescription = taskStateMachine.getContext().taskToUse || taskStateMachine.getContext().humanTask;

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
                        // Cleanup Ink UI when entering execution phase (restored tasks)
                        // Note: Restored tasks don't have inkInstance reference since UI wasn't rendered in this session
                        if (uiCallback) {
                            try {
                                log.orchestrator("🧹 Cleaning up Ink UI state after planning phase...");
                                uiCallback = undefined;  // Reset callback to prevent stale references
                                log.orchestrator("✅ Ink UI state cleanup complete");
                            } catch (error) {
                                log.warn(`⚠️ Ink UI cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                uiCallback = undefined;
                            }
                        }

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
                            executionStateMachine = new CoderReviewerStateMachine(7, 7, taskStateMachine.getBaselineCommit(), auditLogger);
                            taskStateMachine.setExecutionStateMachine(executionStateMachine);
                            executionStateMachine.transition(Event.START_CHUNKING);
                        } else if (taskStateMachine.getContext().retryFeedback) {
                            // We're retrying after SuperReviewer feedback - reset the state machine
                            log.orchestrator("🔄 Resetting execution state machine for retry cycle");
                            executionStateMachine = new CoderReviewerStateMachine(7, 7, taskStateMachine.getBaselineCommit(), auditLogger);
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
                            log,
                            checkpointService,
                            taskStateMachine,
                            null  // No UI for restored tasks
                        );

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

                            // Create promise for UI-based decision (following refinement pattern)
                            let superReviewerResolverFunc: ((value: SuperReviewerDecision) => void) | null = null;
                            const superReviewerDecisionPromise = new Promise<SuperReviewerDecision>((resolve) => {
                                superReviewerResolverFunc = resolve;
                            });
                            // Attach the resolver to the promise object for the UI to access
                            (superReviewerDecisionPromise as any).resolve = superReviewerResolverFunc;

                            // Create callback for UI to wire up
                            const superReviewerCallback = (decision: Promise<SuperReviewerDecision>) => {
                                // Wire up the promise resolver to the UI handler
                                (decision as any).resolve = superReviewerResolverFunc;
                            };

                            // Update UI to show SuperReviewer results with decision callback
                            if (inkInstance) {
                                inkInstance.rerender(React.createElement(App, {
                                    taskStateMachine,
                                    onPlanFeedback: undefined,
                                    onRefinementFeedback: undefined,
                                    onSuperReviewerDecision: superReviewerCallback
                                }));

                                // Invoke callback with promise
                                superReviewerCallback(superReviewerDecisionPromise);
                            }

                            // Wait for UI decision
                            const humanDecision = await superReviewerDecisionPromise;

                            if (humanDecision.action === "approve") {
                                log.orchestrator("Human accepted work despite identified issues.");

                                // Update CLAUDE.md documentation with task completion (even for incomplete acceptance)
                                log.orchestrator("📝 Updating CLAUDE.md with task documentation (incomplete acceptance)...");
                                const taskDescription = taskStateMachine.getContext().taskToUse || taskStateMachine.getContext().humanTask;
                                await documentTaskCompletion(
                                    provider,
                                    cwd,
                                    taskStateMachine.getContext().taskId,
                                    taskDescription,
                                    planMd
                                );

                                taskStateMachine.transition(TaskEvent.HUMAN_APPROVED);
                            } else if (humanDecision.action === "retry") {
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

                            // Update CLAUDE.md documentation with task completion
                            log.orchestrator("📝 Updating CLAUDE.md with task documentation...");
                            const taskDescription = taskStateMachine.getContext().taskToUse || taskStateMachine.getContext().humanTask;
                            await documentTaskCompletion(
                                provider,
                                cwd,
                                taskStateMachine.getContext().taskId,
                                taskDescription,
                                planMd
                            );

                            taskStateMachine.transition(TaskEvent.SUPER_REVIEW_PASSED);
                        }
                        break;
                    }

                    case TaskState.TASK_FINALIZING: {
                        // Finalization phase - merge or manual review
                        if (options?.autoMerge) {
                            log.orchestrator("📦 Auto-merging to master...");
                            mergeToMaster(taskStateMachine.getContext().taskId, cwd);
                            cleanupWorktree(taskStateMachine.getContext().taskId, cwd);
                            taskStateMachine.transition(TaskEvent.AUTO_MERGE);
                        } else {
                            // Provide direct git commands for npx users
                            log.orchestrator(`\nNext steps:
1. Review changes in worktree: ${cwd}
2. Run tests to verify
3. Merge to master:
   git checkout master
   git merge sandbox/${taskStateMachine.getContext().taskId} --squash
   git commit -m "Task ${taskStateMachine.getContext().taskId} completed"
4. Clean up:
   git worktree remove .worktrees/${taskStateMachine.getContext().taskId}
   git branch -D sandbox/${taskStateMachine.getContext().taskId}`);
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
    log: any,
    checkpointService: CheckpointService,
    taskStateMachine: TaskStateMachine,
    inkInstance: { waitUntilExit: () => Promise<void>; unmount: () => void; rerender: (node: React.ReactElement) => void } | null
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

                        // Capture Bean Counter output for UI
                        const chunkOutput = `${chunk.description}\n\nRequirements:\n${chunk.requirements.map((r: string) => `- ${r}`).join('\n')}\n\nContext: ${chunk.context}`;
                        stateMachine.setAgentOutput('bean', chunkOutput);

                        // Trigger UI update if Ink is active
                        if (taskStateMachine && inkInstance) {
                            inkInstance.rerender(React.createElement(App, {
                                taskStateMachine,
                                onPlanFeedback: undefined,
                                onRefinementFeedback: undefined
                            }));
                        }

                        // Session strategy per agent:
                        // - Coder: Global session persists across ALL chunks for full task context
                        // - Reviewer: Fresh session per chunk for unbiased review
                        reviewerSessionId = generateUUID();
                        reviewerInitialized = false;
                        // Note: coderSessionId and coderInitialized remain unchanged to maintain continuity
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

                    // Capture Coder output for UI
                    const coderOutput = `${proposal.description}\n\nFiles: ${proposal.affectedFiles?.join(", ") || "N/A"}\n\nSteps:\n${proposal.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
                    stateMachine.setAgentOutput('coder', coderOutput);

                    // Trigger UI update if Ink is active
                    if (taskStateMachine && inkInstance) {
                        inkInstance.rerender(React.createElement(App, {
                            taskStateMachine,
                            onPlanFeedback: undefined,
                            onRefinementFeedback: undefined
                        }));
                    }

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

                    // Generate summary for UI (plan review)
                    const planReviewOutput = `Verdict: ${verdict.verdict}\n\n${verdict.feedback || "No additional feedback"}`;
                    const planReviewSummary = await summarizeReviewerOutput(
                        provider,
                        planReviewOutput,
                        cwd
                    );
                    stateMachine.setSummary('reviewer', planReviewSummary);

                    // Trigger UI update if Ink is active
                    if (taskStateMachine && inkInstance) {
                        inkInstance.rerender(React.createElement(App, {
                            taskStateMachine,
                            onPlanFeedback: undefined,
                            onRefinementFeedback: undefined
                        }));
                    }

                    // Handle verdict
                    switch (verdict.verdict) {
                        case 'approve-plan':
                            stateMachine.transition(Event.PLAN_APPROVED);
                            break;

                        case 'already-complete':
                            // Work is already done, mark chunk as complete and continue to next
                            log.orchestrator(`✅ Chunk already complete: ${verdict.feedback}`);
                            stateMachine.transition(Event.CODE_APPROVED, verdict.feedback);

                            // Create checkpoint after code approval (work already complete)
                            await createCheckpointAfterApproval(
                                checkpointService,
                                stateMachine,
                                taskStateMachine,
                                beanCounterSessionId,
                                coderSessionId,
                                reviewerSessionId,
                                beanCounterInitialized,
                                coderInitialized,
                                reviewerInitialized,
                                `Work already complete: ${verdict.feedback || 'Chunk requirements satisfied'}`,
                                log
                            );
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

                    // Generate concise summary of Coder implementation response
                    const coderSummary = await summarizeCoderOutput(provider, response, cwd);
                    stateMachine.setSummary('coder', coderSummary);

                    // Trigger UI update if Ink is active
                    if (taskStateMachine && inkInstance) {
                        inkInstance.rerender(React.createElement(App, {
                            taskStateMachine,
                            onPlanFeedback: undefined,
                            onRefinementFeedback: undefined
                        }));
                    }

                    // Check if Coder applied changes (don't log here since Coder already displayed its response)
                    if (!response.includes("CODE_APPLIED:")) {
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

                    // Capture Reviewer output for UI
                    const reviewerOutput = `Verdict: ${verdict.verdict}\n\n${verdict.feedback || "No additional feedback"}`;
                    stateMachine.setAgentOutput('reviewer', reviewerOutput);

                    // Generate summary for UI (code review)
                    const reviewerSummary = await summarizeReviewerOutput(
                        provider,
                        reviewerOutput,
                        cwd
                    );
                    stateMachine.setSummary('reviewer', reviewerSummary);

                    // Trigger UI update if Ink is active
                    if (taskStateMachine && inkInstance) {
                        inkInstance.rerender(React.createElement(App, {
                            taskStateMachine,
                            onPlanFeedback: undefined,
                            onRefinementFeedback: undefined
                        }));
                    }

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

                            // Create checkpoint after successful code approval
                            await createCheckpointAfterApproval(
                                checkpointService,
                                stateMachine,
                                taskStateMachine,
                                beanCounterSessionId,
                                coderSessionId,
                                reviewerSessionId,
                                beanCounterInitialized,
                                coderInitialized,
                                reviewerInitialized,
                                `Code approved: ${changeDescription}`,
                                log
                            );
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

                            // Create checkpoint after chunk completion
                            await createCheckpointAfterApproval(
                                checkpointService,
                                stateMachine,
                                taskStateMachine,
                                beanCounterSessionId,
                                coderSessionId,
                                reviewerSessionId,
                                beanCounterInitialized,
                                coderInitialized,
                                reviewerInitialized,
                                `Chunk completed: ${changeDescription}`,
                                log
                            );
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

                                // Create checkpoint after human approval
                                await createCheckpointAfterApproval(
                                    checkpointService,
                                    stateMachine,
                                    taskStateMachine,
                                    beanCounterSessionId,
                                    coderSessionId,
                                    reviewerSessionId,
                                    beanCounterInitialized,
                                    coderInitialized,
                                    reviewerInitialized,
                                    `Human approved: ${changeDescription}`,
                                    log
                                );
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

/**
 * Helper function to create checkpoints after CODE_APPROVED events
 * Captures comprehensive state for audit-driven recovery
 */
async function createCheckpointAfterApproval(
    checkpointService: CheckpointService,
    executionStateMachine: CoderReviewerStateMachine,
    taskStateMachine: TaskStateMachine,
    beanCounterSessionId: string,
    coderSessionId: string,
    reviewerSessionId: string,
    beanCounterInitialized: boolean,
    coderInitialized: boolean,
    reviewerInitialized: boolean,
    description: string,
    log: any
): Promise<void> {
    try {
        // Only create checkpoints if service is enabled
        if (!checkpointService.isEnabled()) {
            return;
        }

        // Create comprehensive checkpoint with all necessary context
        const success = await checkpointService.createCheckpoint(
            'CODE_APPROVED',
            description,
            {
                taskStateMachine,
                executionStateMachine,
                beanCounterSessionId,
                coderSessionId,
                reviewerSessionId,
                beanCounterInitialized,
                coderInitialized,
                reviewerInitialized,
                // Future: Could include audit events since last checkpoint
                auditEventsSinceLastCheckpoint: []
            }
        );

        if (success) {
            log.orchestrator(`📍 Checkpoint ${checkpointService.getLatestCheckpointNumber()} created for recovery`);
        }
    } catch (error) {
        // Log warning but don't disrupt execution flow
        log.warn(`⚠️ Checkpoint creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
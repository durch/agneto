import { EventEmitter } from 'events';
import { log } from "./ui/log.js";
import { CoderReviewerStateMachine } from "./state-machine.js";
import type { SuperReviewerResult, GardenerResult } from "./types.js";
import type { TaskStateCheckpoint } from "./audit/types.js";
import type { AuditLogger } from "./audit/audit-logger.js";

// Parent states representing the complete task lifecycle
export enum TaskState {
  // Initial state
  TASK_INIT = "TASK_INIT",

  // Pre-execution phases
  TASK_REFINING = "TASK_REFINING",
  TASK_PLANNING = "TASK_PLANNING",
  TASK_CURMUDGEONING = "TASK_CURMUDGEONING",

  // Execution phase (delegates to CoderReviewerStateMachine)
  TASK_EXECUTING = "TASK_EXECUTING",

  // Post-execution phases
  TASK_SUPER_REVIEWING = "TASK_SUPER_REVIEWING",
  TASK_GARDENING = "TASK_GARDENING",

  // Terminal states
  TASK_COMPLETE = "TASK_COMPLETE",
  TASK_ABANDONED = "TASK_ABANDONED",
}

// Live activity message for UI display
export interface LiveActivityMessage {
  agent: string;
  message: string;
}

// Tool status for UI display
export interface ToolStatus {
  agent: string;
  tool: string;
  summary: string; // Brief description of what the tool is doing
}

// Events that trigger parent state transitions
export enum TaskEvent {
  // Initialization events
  START_TASK = "START_TASK",

  // Refinement events
  SKIP_REFINEMENT = "SKIP_REFINEMENT",
  REFINEMENT_COMPLETE = "REFINEMENT_COMPLETE",
  REFINEMENT_CANCELLED = "REFINEMENT_CANCELLED",

  // Planning events
  PLAN_CREATED = "PLAN_CREATED",
  PLAN_FAILED = "PLAN_FAILED",

  // Curmudgeon events
  CURMUDGEON_APPROVED = "CURMUDGEON_APPROVED",
  CURMUDGEON_SIMPLIFY = "CURMUDGEON_SIMPLIFY",

  // Execution events
  EXECUTION_STARTED = "EXECUTION_STARTED",
  EXECUTION_COMPLETE = "EXECUTION_COMPLETE",
  EXECUTION_FAILED = "EXECUTION_FAILED",

  // Super review events
  SUPER_REVIEW_PASSED = "SUPER_REVIEW_PASSED",
  SUPER_REVIEW_NEEDS_HUMAN = "SUPER_REVIEW_NEEDS_HUMAN",
  GARDENING_COMPLETE = "GARDENING_COMPLETE",

  // Human decision events
  HUMAN_APPROVED = "HUMAN_APPROVED",
  HUMAN_RETRY = "HUMAN_RETRY",
  HUMAN_ABANDON = "HUMAN_ABANDON",

  // Error event
  ERROR_OCCURRED = "ERROR_OCCURRED",
}

// Context for the parent state machine
export interface TaskContext {
  // Task identification
  taskId: string;
  humanTask: string;
  workingDirectory: string;

  // Refined task (if refinement occurred)
  refinedTask?: string;
  taskToUse?: string; // The actual task description to use (refined or original)
  pendingRefinement?: string; // Refinement awaiting approval

  // Planning outputs
  planMd?: string;
  planPath?: string;

  // Execution sub-machine
  executionStateMachine?: CoderReviewerStateMachine;
  coderSessionId?: string;
  reviewerSessionId?: string;

  // Super review results
  superReviewResult?: SuperReviewerResult;

  // Live activity tracking
  liveActivity: { agent: string; message: string } | null;

  // Configuration options
  options: {
    autoMerge?: boolean;
    nonInteractive?: boolean;
  };

  // Error tracking
  lastError?: Error;

  // Task baseline tracking (prevents reverting pre-task commits)
  baselineCommit?: string;

  // Retry decision for super review
  retryFeedback?: string;

  // Curmudgeon tracking
  simplificationCount: number;
  curmudgeonFeedback?: string;

  // User review tracking
  userHasReviewedPlan: boolean;
}

export class TaskStateMachine extends EventEmitter {
  private state: TaskState = TaskState.TASK_INIT;
  private context: TaskContext;
  private auditLogger?: AuditLogger;
  private liveActivityMessage: LiveActivityMessage | null = null;
  private toolStatus: ToolStatus | null = null;
  private currentQuestion: string | null = null;
  private answeringQuestion: boolean = false;
  private gardenerResult: GardenerResult | null = null;
  private injectionPauseRequested: boolean = false;
  private pendingInjection: string | null = null;
  private mergeInstructions: string | null = null;
  private clipboardStatus: 'success' | 'failed' | null = null;

  constructor(
    taskId: string,
    humanTask: string,
    workingDirectory: string,
    options: TaskContext["options"] = {},
    auditLogger?: AuditLogger
  ) {
    super(); // EventEmitter constructor
    this.context = {
      taskId,
      humanTask,
      workingDirectory,
      options,
      simplificationCount: 0,
      userHasReviewedPlan: false,
      liveActivity: null,
    };
    this.auditLogger = auditLogger;
    log.orchestrator(`Task state machine initialized: ${this.state}`);
  }

  // Getters for external access
  getCurrentState(): TaskState {
    return this.state;
  }

  getContext(): TaskContext {
    return this.context;
  }

  getExecutionStateMachine(): CoderReviewerStateMachine | undefined {
    return this.context.executionStateMachine;
  }

  getRefinedTask(): string | undefined {
    return this.context.refinedTask;
  }

  getPlanMd(): string | undefined {
    return this.context.planMd;
  }

  getPlanPath(): string | undefined {
    return this.context.planPath;
  }

  getSuperReviewResult(): SuperReviewerResult | undefined {
    return this.context.superReviewResult;
  }

  getLastError(): Error | undefined {
    return this.context.lastError;
  }

  getGardenerResult(): GardenerResult | null {
    return this.gardenerResult;
  }

  setGardenerResult(result: GardenerResult): void {
    this.gardenerResult = result;
    // Emit event for UI to show gardener result
    this.emit('gardener:complete', { result });
  }

  // Live activity message management
  getLiveActivityMessage(): LiveActivityMessage | null {
    return this.liveActivityMessage;
  }

  setLiveActivityMessage(agent: string, message: string): void {
    this.liveActivityMessage = { agent, message };
    this.emit('activity:updated', { agent, message });
  }

  clearLiveActivityMessage(): void {
    this.liveActivityMessage = null;
    this.emit('activity:updated', { message: null });
  }

  // Tool status management for UI display
  getToolStatus(): ToolStatus | null {
    return this.toolStatus;
  }

  setToolStatus(agent: string, tool: string, summary: string): void {
    this.toolStatus = { agent, tool, summary };
    this.emit('tool:status', { agent, tool, summary });  // UI auto-updates
  }

  clearToolStatus(): void {
    this.toolStatus = null;
    // Emit event with null values to notify UI to clear tool status display
    this.emit('tool:status', { agent: null, tool: null, summary: null });
  }

  // Setters for context updates
  setPendingRefinement(refinement: string) {
    this.context.pendingRefinement = refinement;
    // Emit event for UI to show pending refinement
    this.emit('refinement:ready', { refinement });
  }

  getPendingRefinement(): string | undefined {
    return this.context.pendingRefinement;
  }

  getCurrentQuestion(): string | null {
    return this.currentQuestion;
  }

  setCurrentQuestion(question: string | null): void {
    this.currentQuestion = question;
    // Emit event for UI to show question
    if (question) {
      this.emit('question:asked', { question });
    }
  }

  clearCurrentQuestion(): void {
    this.currentQuestion = null;
    // Emit event for UI to clear question display
    this.emit('question:cleared');
  }

  getAnsweringQuestion(): boolean {
    return this.answeringQuestion;
  }

  setAnsweringQuestion(isAnswering: boolean): void {
    this.answeringQuestion = isAnswering;
    // Emit event for UI to react to answering state change
    this.emit('question:answering', { isAnswering });
  }

  setRefinedTask(refinedTask: string, taskToUse: string) {
    this.context.refinedTask = refinedTask;
    this.context.taskToUse = taskToUse;
    // Clear pending once approved
    this.context.pendingRefinement = undefined;
    // Emit event for UI to update task display
    this.emit('task:refined', { refinedTask, taskToUse });
  }

  setPlan(planMd: string | undefined, planPath: string) {
    this.context.planMd = planMd;
    this.context.planPath = planPath;
    // Emit event for UI to show plan
    this.emit('plan:ready', { planMd, planPath });
  }

  setExecutionStateMachine(machine: CoderReviewerStateMachine) {
    this.context.executionStateMachine = machine;
  }

  setSessionIds(coderSessionId: string, reviewerSessionId: string) {
    this.context.coderSessionId = coderSessionId;
    this.context.reviewerSessionId = reviewerSessionId;
  }

  setSuperReviewResult(result: SuperReviewerResult) {
    this.context.superReviewResult = result;
    // Emit event for UI to show super review result
    this.emit('superreview:complete', { result });
  }

  setRetryFeedback(feedback: string) {
    this.context.retryFeedback = feedback;
  }

  clearRetryFeedback() {
    this.context.retryFeedback = undefined;
  }

  isRetry(): boolean {
    return this.context.retryFeedback !== undefined;
  }

  incrementSimplificationCount() {
    this.context.simplificationCount++;
  }

  getSimplificationCount(): number {
    return this.context.simplificationCount;
  }

  setCurmudgeonFeedback(feedback: string) {
    this.context.curmudgeonFeedback = feedback;
    this.emit('curmudgeon:feedback', { feedback });
  }

  getCurmudgeonFeedback(): string | undefined {
    return this.context.curmudgeonFeedback;
  }

  clearCurmudgeonFeedback() {
    this.context.curmudgeonFeedback = undefined;
    this.emit('curmudgeon:feedback', { feedback: undefined });
  }

  setUserHasReviewedPlan(value: boolean) {
    this.context.userHasReviewedPlan = value;
  }

  getUserHasReviewedPlan(): boolean {
    return this.context.userHasReviewedPlan;
  }

  getLiveActivity(): { agent: string; message: string } | null {
    return this.context.liveActivity;
  }

  clearLiveActivity(): void {
    this.context.liveActivity = null;
  }

  // Task baseline commit management (prevents reverting pre-task commits)
  setBaselineCommit(commitHash: string) {
    this.context.baselineCommit = commitHash;
  }

  getBaselineCommit(): string | undefined {
    return this.context.baselineCommit;
  }

  // Dynamic prompt injection state management
  requestInjectionPause(): void {
    this.injectionPauseRequested = true;
  }

  isInjectionPauseRequested(): boolean {
    return this.injectionPauseRequested;
  }

  clearInjectionPause(): void {
    this.injectionPauseRequested = false;
  }

  setPendingInjection(content: string): void {
    this.pendingInjection = content;
  }

  getPendingInjection(): string | null {
    return this.pendingInjection;
  }

  clearPendingInjection(): void {
    this.pendingInjection = null;
  }

  hasPendingInjection(): boolean {
    return this.pendingInjection !== null;
  }

  // Merge instructions management
  setMergeInstructions(instructions: string, status: 'success' | 'failed'): void {
    this.mergeInstructions = instructions;
    this.clipboardStatus = status;
  }

  getMergeInstructions(): string | null {
    return this.mergeInstructions;
  }

  getClipboardStatus(): 'success' | 'failed' | null {
    return this.clipboardStatus;
  }

  // Signal that plan is ready for user approval (after Curmudgeon approval)
  setPlanAwaitingApproval(): void {
    this.emit('plan:awaiting_approval');
  }

  // Signal that refinement is ready for user approval
  setRefinementAwaitingApproval(): void {
    this.emit('refinement:awaiting_approval');
  }

  // Signal that SuperReviewer results are ready for user decision
  setSuperReviewAwaitingApproval(): void {
    this.emit('superreview:awaiting_approval');
  }

  // Check if we can continue processing
  canContinue(): boolean {
    return ![TaskState.TASK_COMPLETE, TaskState.TASK_ABANDONED].includes(
      this.state
    );
  }

  // Check if we're in a terminal state
  isTerminal(): boolean {
    return !this.canContinue();
  }

  // Check if we're in execution phase
  isExecuting(): boolean {
    return this.state === TaskState.TASK_EXECUTING;
  }

  // Main state transition logic
  transition(event: TaskEvent, data?: any): TaskState {
    const oldState = this.state;
    const validTransition = this.handleTransition(event, data);

    if (!validTransition) {
      log.orchestrator(
        `Invalid task transition: ${oldState} + ${event} (ignored)`
      );
      return this.state;
    }

    if (oldState !== this.state) {
      log.orchestrator(
        `Task state transition: ${oldState} → ${this.state} (event: ${event})`
      );

      // Emit audit event for state transition
      if (this.auditLogger) {
        this.auditLogger.captureEvent('system', 'phase_transition', `State transition: ${oldState} → ${this.state}`, {
          metadata: {
            oldState,
            newState: this.state,
            event,
            taskId: this.context.taskId
          }
        });
      }

      // Emit event for UI to react to state change
      this.emit('state:changed', { oldState, newState: this.state, event });
      this.emit('phase:changed', { from: oldState, to: this.state });
    }

    return this.state;
  }

  // Internal transition handler
  private handleTransition(event: TaskEvent, data?: any): boolean {
    switch (this.state) {
      case TaskState.TASK_INIT:
        if (event === TaskEvent.START_TASK) {
          // Decide whether to refine or skip to planning
          if (this.context.options.nonInteractive) {
            this.state = TaskState.TASK_PLANNING;
            this.context.taskToUse = this.context.humanTask;
          } else {
            this.state = TaskState.TASK_REFINING;
          }
          return true;
        } else if (event === TaskEvent.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        }
        break;

      case TaskState.TASK_REFINING:
        if (event === TaskEvent.REFINEMENT_COMPLETE) {
          this.state = TaskState.TASK_PLANNING;
          // refinedTask and taskToUse should be set via setters before this event
          return true;
        } else if (event === TaskEvent.REFINEMENT_CANCELLED) {
          // Use original task and proceed to planning
          this.state = TaskState.TASK_PLANNING;
          this.context.taskToUse = this.context.humanTask;
          log.orchestrator(
            "Refinement cancelled, using original task description"
          );
          return true;
        } else if (event === TaskEvent.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        }
        break;

      case TaskState.TASK_PLANNING:
        if (event === TaskEvent.PLAN_CREATED) {
          this.state = TaskState.TASK_CURMUDGEONING;
          // planMd and planPath should be set via setters before this event
          return true;
        } else if (event === TaskEvent.PLAN_FAILED) {
          this.state = TaskState.TASK_ABANDONED;
          this.context.lastError = data;
          return true;
        } else if (event === TaskEvent.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        }
        break;

      case TaskState.TASK_CURMUDGEONING:
        if (event === TaskEvent.CURMUDGEON_APPROVED) {
          this.state = TaskState.TASK_EXECUTING;
          return true;
        } else if (event === TaskEvent.CURMUDGEON_SIMPLIFY) {
          this.state = TaskState.TASK_PLANNING;
          this.incrementSimplificationCount();
          return true;
        } else if (event === TaskEvent.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        }
        break;

      case TaskState.TASK_EXECUTING:
        if (event === TaskEvent.EXECUTION_COMPLETE) {
          this.state = TaskState.TASK_SUPER_REVIEWING;
          return true;
        } else if (event === TaskEvent.EXECUTION_FAILED) {
          this.state = TaskState.TASK_ABANDONED;
          this.context.lastError = data;
          return true;
        } else if (event === TaskEvent.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        }
        break;

      case TaskState.TASK_SUPER_REVIEWING:
        if (event === TaskEvent.SUPER_REVIEW_PASSED) {
          this.state = TaskState.TASK_GARDENING;
          return true;
        } else if (event === TaskEvent.SUPER_REVIEW_NEEDS_HUMAN) {
          // Stay in super review state, waiting for human decision
          return true;
        } else if (event === TaskEvent.HUMAN_APPROVED) {
          this.state = TaskState.TASK_GARDENING;
          return true;
        } else if (event === TaskEvent.HUMAN_RETRY) {
          // Go back to planning for a new cycle
          this.state = TaskState.TASK_PLANNING;
          // retryFeedback should be set via setter
          return true;
        } else if (event === TaskEvent.HUMAN_ABANDON) {
          this.state = TaskState.TASK_ABANDONED;
          return true;
        } else if (event === TaskEvent.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        }
        break;

      case TaskState.TASK_GARDENING:
        if (event === TaskEvent.GARDENING_COMPLETE) {
          this.state = TaskState.TASK_COMPLETE;
          return true;
        } else if (event === TaskEvent.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        }
        break;

      case TaskState.TASK_COMPLETE:
      case TaskState.TASK_ABANDONED:
        // Terminal states - no transitions
        return false;

      default:
        if (event === TaskEvent.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        }
    }

    return false;
  }

  // Error handling
  private handleError(error?: Error) {
    this.context.lastError = error;
    log.orchestrator(
      `Task error occurred: ${error?.message || "Unknown error"}`
    );

    // Determine recovery based on current state
    switch (this.state) {
      case TaskState.TASK_REFINING:
        // Refinement error - skip to planning with original task
        this.state = TaskState.TASK_PLANNING;
        this.context.taskToUse = this.context.humanTask;
        log.orchestrator("Refinement error - proceeding with original task");
        break;

      case TaskState.TASK_PLANNING:
      case TaskState.TASK_CURMUDGEONING:
      case TaskState.TASK_EXECUTING:
      case TaskState.TASK_SUPER_REVIEWING:
        // Critical errors - abandon task
        this.state = TaskState.TASK_ABANDONED;
        log.orchestrator("Critical error - task abandoned");
        break;

      default:
        this.state = TaskState.TASK_ABANDONED;
    }
  }

  // Restore state machine from checkpoint data
  restoreFromCheckpoint(checkpoint: TaskStateCheckpoint): void {
    try {
      log.orchestrator(`🔄 Restoring task state machine from checkpoint...`);

      // Validate checkpoint data
      if (!checkpoint) {
        throw new Error('Checkpoint data is required');
      }

      // Validate task ID compatibility
      if (checkpoint.taskId !== this.context.taskId) {
        throw new Error(`Task ID mismatch: checkpoint is for task '${checkpoint.taskId}', but current task is '${this.context.taskId}'`);
      }

      // Validate working directory compatibility
      if (checkpoint.workingDirectory !== this.context.workingDirectory) {
        log.orchestrator(`⚠️ Working directory mismatch: checkpoint from '${checkpoint.workingDirectory}', currently in '${this.context.workingDirectory}'`);
      }

      // Restore basic task information
      this.context.humanTask = checkpoint.humanTask;
      this.context.workingDirectory = checkpoint.workingDirectory;

      // Restore refined task data if available
      if (checkpoint.refinedTask && checkpoint.taskToUse) {
        // Handle legacy checkpoint format (RefinedTask object)
        if (typeof checkpoint.refinedTask === 'object' && checkpoint.refinedTask !== null) {
          // Convert RefinedTask object to string
          this.context.refinedTask = (checkpoint.refinedTask as any).raw ||
                                     (checkpoint.refinedTask as any).goal ||
                                     checkpoint.taskToUse;
        } else {
          // Already a string
          this.context.refinedTask = checkpoint.refinedTask as string;
        }
        this.context.taskToUse = checkpoint.taskToUse;
      } else if (checkpoint.taskToUse) {
        this.context.taskToUse = checkpoint.taskToUse;
      }

      // Restore planning outputs
      if (checkpoint.planMd !== undefined) {
        this.context.planMd = checkpoint.planMd;
      }
      if (checkpoint.planPath !== undefined) {
        this.context.planPath = checkpoint.planPath;
      }

      // Restore configuration options
      this.context.options = {
        ...this.context.options,
        ...checkpoint.options
      };

      // Restore error tracking
      if (checkpoint.lastError) {
        this.context.lastError = new Error(checkpoint.lastError.message);
        if (checkpoint.lastError.stack) {
          this.context.lastError.stack = checkpoint.lastError.stack;
        }
      } else {
        this.context.lastError = undefined;
      }

      // Restore retry feedback
      if (checkpoint.retryFeedback !== undefined) {
        this.context.retryFeedback = checkpoint.retryFeedback;
      }

      // Restore curmudgeon tracking
      this.context.simplificationCount = checkpoint.simplificationCount || 0;
      if (checkpoint.curmudgeonFeedback !== undefined) {
        this.context.curmudgeonFeedback = checkpoint.curmudgeonFeedback;
      }

      // Restore user review tracking
      this.context.userHasReviewedPlan = checkpoint.userHasReviewedPlan || false;

      // Restore dynamic prompt injection state (Ctrl+I override mechanism)
      // These fields ensure pending user input isn't lost during checkpoint recovery
      this.injectionPauseRequested = checkpoint.injectionPauseRequested || false;
      this.pendingInjection = checkpoint.pendingInjection || null;

      // Restore merge instructions if available
      this.mergeInstructions = checkpoint.mergeInstructions || null;
      this.clipboardStatus = checkpoint.clipboardStatus || null;

      // Restore super review result if available
      if (checkpoint.superReviewResult) {
        // Cast verdict to proper SuperReviewerVerdict type
        const superReviewResult: SuperReviewerResult = {
          verdict: checkpoint.superReviewResult.verdict as any, // Type assertion for verdict
          summary: checkpoint.superReviewResult.summary,
          issues: checkpoint.superReviewResult.issues || []
        };
        this.context.superReviewResult = superReviewResult;
      }

      // Restore the state machine state
      // Convert string state back to TaskState enum
      if (checkpoint.currentState && Object.values(TaskState).includes(checkpoint.currentState as TaskState)) {
        this.state = checkpoint.currentState as TaskState;
      } else {
        throw new Error(`Invalid state in checkpoint: ${checkpoint.currentState}`);
      }

      log.orchestrator(`✅ Task state machine restored to state: ${this.state}`);
      log.orchestrator(`📋 Restored context: taskToUse=${this.context.taskToUse ? 'set' : 'unset'}, planPath=${this.context.planPath ? 'set' : 'unset'}, refinedTask=${this.context.refinedTask ? 'set' : 'unset'}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.orchestrator(`❌ Failed to restore task state machine: ${errorMessage}`);
      throw new Error(`Task state machine restoration failed: ${errorMessage}`);
    }
  }

  // Get a human-readable status
  getStatus(): string {
    const parts = [`Task State: ${this.state}`];

    if (this.context.taskId) {
      parts.push(`Task ID: ${this.context.taskId}`);
    }

    if (this.context.refinedTask) {
      parts.push(`Refined: yes`);
    }

    if (this.context.planPath) {
      parts.push(`Plan: ${this.context.planPath}`);
    }

    if (
      this.state === TaskState.TASK_EXECUTING &&
      this.context.executionStateMachine
    ) {
      parts.push(
        `Execution: ${this.context.executionStateMachine.getStatus()}`
      );
    }

    if (this.context.superReviewResult) {
      parts.push(`Super Review: ${this.context.superReviewResult.verdict}`);
    }

    if (this.context.lastError) {
      parts.push(`Last error: ${this.context.lastError.message}`);
    }

    return parts.join(", ");
  }
}

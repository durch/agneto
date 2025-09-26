import { log } from "./ui/log.js";
import { CoderReviewerStateMachine } from "./state-machine.js";
import type { RefinedTask, SuperReviewerResult } from "./types.js";

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
  TASK_FINALIZING = "TASK_FINALIZING",

  // Terminal states
  TASK_COMPLETE = "TASK_COMPLETE",
  TASK_ABANDONED = "TASK_ABANDONED",
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

  // Human decision events
  HUMAN_APPROVED = "HUMAN_APPROVED",
  HUMAN_RETRY = "HUMAN_RETRY",
  HUMAN_ABANDON = "HUMAN_ABANDON",

  // Finalization events
  AUTO_MERGE = "AUTO_MERGE",
  MANUAL_MERGE = "MANUAL_MERGE",
  CLEANUP_COMPLETE = "CLEANUP_COMPLETE",

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
  refinedTask?: RefinedTask;
  taskToUse?: string; // The actual task description to use (refined or original)

  // Planning outputs
  planMd?: string;
  planPath?: string;

  // Execution sub-machine
  executionStateMachine?: CoderReviewerStateMachine;
  coderSessionId?: string;
  reviewerSessionId?: string;

  // Super review results
  superReviewResult?: SuperReviewerResult;

  // Configuration options
  options: {
    autoMerge?: boolean;
    nonInteractive?: boolean;
  };

  // Error tracking
  lastError?: Error;

  // Retry decision for super review
  retryFeedback?: string;

  // Curmudgeon tracking
  simplificationCount: number;
  curmudgeonFeedback?: string;
}

export class TaskStateMachine {
  private state: TaskState = TaskState.TASK_INIT;
  private context: TaskContext;

  constructor(
    taskId: string,
    humanTask: string,
    workingDirectory: string,
    options: TaskContext["options"] = {}
  ) {
    this.context = {
      taskId,
      humanTask,
      workingDirectory,
      options,
      simplificationCount: 0,
    };
    log.orchestrator(`Task state machine initialized: ${this.state}`);
  }

  // Getters for external access
  getCurrentState(): TaskState {
    return this.state;
  }

  getContext(): TaskContext {
    return this.context;
  }

  getExecutionStateMachine(): CoderReviewerStateMachine | null {
    return this.context.executionStateMachine ?? null;
  }

  getRefinedTask(): RefinedTask | undefined {
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

  // Setters for context updates
  setRefinedTask(refinedTask: RefinedTask, taskToUse: string) {
    this.context.refinedTask = refinedTask;
    this.context.taskToUse = taskToUse;
  }

  setPlan(planMd: string | undefined, planPath: string) {
    this.context.planMd = planMd;
    this.context.planPath = planPath;
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
  }

  getCurmudgeonFeedback(): string | undefined {
    return this.context.curmudgeonFeedback;
  }

  clearCurmudgeonFeedback() {
    this.context.curmudgeonFeedback = undefined;
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
          this.state = TaskState.TASK_FINALIZING;
          return true;
        } else if (event === TaskEvent.SUPER_REVIEW_NEEDS_HUMAN) {
          // Stay in super review state, waiting for human decision
          return true;
        } else if (event === TaskEvent.HUMAN_APPROVED) {
          this.state = TaskState.TASK_FINALIZING;
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

      case TaskState.TASK_FINALIZING:
        if (
          event === TaskEvent.AUTO_MERGE ||
          event === TaskEvent.MANUAL_MERGE
        ) {
          this.state = TaskState.TASK_COMPLETE;
          return true;
        } else if (event === TaskEvent.CLEANUP_COMPLETE) {
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
      case TaskState.TASK_FINALIZING:
        // Critical errors - abandon task
        this.state = TaskState.TASK_ABANDONED;
        log.orchestrator("Critical error - task abandoned");
        break;

      default:
        this.state = TaskState.TASK_ABANDONED;
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

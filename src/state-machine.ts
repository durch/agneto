import { log } from "./ui/log.js";
import type { CoderPlanProposal } from "./types.js";

// State definitions for the Bean Counter coordinated protocol
// AIDEV-NOTE: Bean Counter acts as "Scrum Master" - maintains session-based progress ledger,
// breaks down high-level plans into implementable chunks, coordinates review cycles
// Flow: BEAN_COUNTING → PLANNING → PLAN_REVIEW → IMPLEMENTING → CODE_REVIEW → back to BEAN_COUNTING
export enum State {
  // Initial state
  TASK_START = "TASK_START",

  // Phase 1: Work Chunking
  BEAN_COUNTING = "BEAN_COUNTING",

  // Phase 2: Implementation cycle (Bean Counter → Coder → Reviewer → Bean Counter)
  PLANNING = "PLANNING",
  PLAN_REVIEW = "PLAN_REVIEW",
  IMPLEMENTING = "IMPLEMENTING",
  CODE_REVIEW = "CODE_REVIEW",

  // Terminal states
  TASK_COMPLETE = "TASK_COMPLETE",
  TASK_FAILED = "TASK_FAILED",
  TASK_ABORTED = "TASK_ABORTED"
}

// Events that trigger state transitions
export enum Event {
  // Bean Counter events
  START_CHUNKING = "START_CHUNKING",
  CHUNK_READY = "CHUNK_READY",

  // Planning events
  START_PLANNING = "START_PLANNING",
  PLAN_PROPOSED = "PLAN_PROPOSED",
  PLAN_APPROVED = "PLAN_APPROVED",
  PLAN_REVISION_REQUESTED = "PLAN_REVISION_REQUESTED",
  PLAN_REJECTED = "PLAN_REJECTED",
  PLAN_NEEDS_HUMAN = "PLAN_NEEDS_HUMAN",

  // Implementation events
  START_IMPLEMENTATION = "START_IMPLEMENTATION",
  CODE_APPLIED = "CODE_APPLIED",
  CODE_APPROVED = "CODE_APPROVED",
  CODE_REVISION_REQUESTED = "CODE_REVISION_REQUESTED",
  CODE_REJECTED = "CODE_REJECTED",
  CODE_NEEDS_HUMAN = "CODE_NEEDS_HUMAN",

  // Control events
  CONTINUE_TO_NEXT = "CONTINUE_TO_NEXT",
  TASK_COMPLETED = "TASK_COMPLETED",
  MAX_ATTEMPTS_REACHED = "MAX_ATTEMPTS_REACHED",
  ERROR_OCCURRED = "ERROR_OCCURRED",
  HUMAN_ABORT = "HUMAN_ABORT"
}

// Context data that flows through states
export interface StateMachineContext {
  // Current plan being worked on
  currentPlan?: CoderPlanProposal;

  // Bean Counter work chunk context
  currentChunk?: {
    description: string;
    requirements: string[];
    context: string;
  };

  // Feedback for revisions
  planFeedback?: string;
  codeFeedback?: string;

  // Attempt tracking
  planAttempts: number;
  codeAttempts: number;

  // Error information
  lastError?: Error;

  // Configuration
  maxPlanAttempts: number;
  maxCodeAttempts: number;
}

export class CoderReviewerStateMachine {
  private state: State = State.TASK_START;
  private context: StateMachineContext;

  constructor(maxPlanAttempts = 7, maxCodeAttempts = 7) {
    this.context = {
      planAttempts: 0,
      codeAttempts: 0,
      maxPlanAttempts,
      maxCodeAttempts
    };
    log.orchestrator(`State machine initialized: ${this.state}`);
  }

  // Getters for external access
  getCurrentState(): State {
    return this.state;
  }

  getContext(): StateMachineContext {
    return this.context;
  }

  getCurrentPlan(): CoderPlanProposal | undefined {
    return this.context.currentPlan;
  }

  getCurrentChunk(): { description: string; requirements: string[]; context: string; } | undefined {
    return this.context.currentChunk;
  }

  getPlanFeedback(): string | null {
    return this.context.planFeedback ?? null;
  }

  getCodeFeedback(): string | null {
    return this.context.codeFeedback ?? null;
  }

  getPlanAttempts(): number {
    return this.context.planAttempts;
  }

  getCodeAttempts(): number {
    return this.context.codeAttempts;
  }

  getLastError(): Error | undefined {
    return this.context.lastError;
  }

  // Setters for testing and external manipulation
  setPlanFeedback(feedback: string | null) {
    this.context.planFeedback = feedback ?? undefined;
  }

  setCodeFeedback(feedback: string | null) {
    this.context.codeFeedback = feedback ?? undefined;
  }

  setLastError(error: Error) {
    this.context.lastError = error;
  }

  clearPlanFeedback() {
    this.context.planFeedback = undefined;
  }

  clearCodeFeedback() {
    this.context.codeFeedback = undefined;
  }

  // Increment attempts - should be called before each attempt
  incrementPlanAttempts() {
    this.context.planAttempts++;
  }

  incrementCodeAttempts() {
    this.context.codeAttempts++;
  }

  // Check if we can continue processing
  canContinue(): boolean {
    return ![
      State.TASK_COMPLETE,
      State.TASK_FAILED,
      State.TASK_ABORTED
    ].includes(this.state);
  }

  // Check if we're in a terminal state
  isTerminal(): boolean {
    return !this.canContinue();
  }

  // Main state transition logic - pure, no side effects
  transition(event: Event, data?: any): State {
    const oldState = this.state;
    const validTransition = this.handleTransition(event, data);

    if (!validTransition) {
      log.orchestrator(`Invalid transition: ${oldState} + ${event} (ignored)`);
      return this.state;
    }

    if (oldState !== this.state) {
      log.orchestrator(`State transition: ${oldState} → ${this.state} (event: ${event})`);
    }

    return this.state;
  }

  // Internal transition handler
  private handleTransition(event: Event, data?: any): boolean {
    // Handle HUMAN_ABORT from any state
    if (event === Event.HUMAN_ABORT) {
      this.state = State.TASK_ABORTED;
      return true;
    }

    switch (this.state) {
      case State.TASK_START:
        if (event === Event.START_CHUNKING) {
          this.state = State.BEAN_COUNTING;
          this.context.planAttempts = 0;
          this.context.codeAttempts = 0;
          this.context.planFeedback = undefined;
          this.context.codeFeedback = undefined;
          this.context.currentChunk = undefined;
          return true;
        }
        break;

      case State.BEAN_COUNTING:
        if (event === Event.CHUNK_READY) {
          this.state = State.PLANNING;
          this.context.currentChunk = data;
          this.context.codeFeedback = undefined;
          this.context.planFeedback = undefined;
          return true;
        } else if (event === Event.TASK_COMPLETED) {
          this.state = State.TASK_COMPLETE;
          return true;
        }
        break;

      case State.PLANNING:
        if (event === Event.PLAN_PROPOSED) {
          this.state = State.PLAN_REVIEW;
          this.context.currentPlan = data;
          // Note: attempts are incremented in orchestrator before proposing
          this.context.planFeedback = undefined; // Clear old feedback
          return true;
        } else if (event === Event.TASK_COMPLETED) {
          this.state = State.TASK_COMPLETE;
          return true;
        } else if (event === Event.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        } else if (event === Event.MAX_ATTEMPTS_REACHED) {
          this.state = State.TASK_FAILED;
          return true;
        }
        break;

      case State.PLAN_REVIEW:
        if (event === Event.PLAN_APPROVED) {
          this.state = State.IMPLEMENTING;
          this.context.codeAttempts = 0;  // Reset for implementation phase
          return true;
        } else if (event === Event.CODE_APPROVED) {
          // Work is already complete for this chunk, move to next
          this.state = State.BEAN_COUNTING;
          return true;
        } else if (event === Event.PLAN_REVISION_REQUESTED) {
          if (this.context.planAttempts >= this.context.maxPlanAttempts) {
            log.orchestrator(`Max plan attempts (${this.context.maxPlanAttempts}) reached`);
            this.state = State.TASK_FAILED;
          } else {
            this.state = State.PLANNING;
            // Store feedback for next attempt - use data if provided, otherwise keep existing
            if (data !== undefined) {
              this.context.planFeedback = data;
            }
          }
          return true;
        } else if (event === Event.PLAN_REJECTED) {
          this.state = State.PLANNING;
          this.context.planAttempts = 0; // Reset on rejection
          this.context.planFeedback = data;
          return true;
        } else if (event === Event.PLAN_NEEDS_HUMAN) {
          // Store feedback and wait for human decision
          this.context.planFeedback = data;
          return true; // Stay in PLAN_REVIEW state
        } else if (event === Event.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        }
        break;

      case State.IMPLEMENTING:
        if (event === Event.CODE_APPLIED) {
          this.state = State.CODE_REVIEW;
          return true;
        } else if (event === Event.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        } else if (event === Event.MAX_ATTEMPTS_REACHED) {
          this.state = State.TASK_FAILED;
          return true;
        }
        break;

      case State.CODE_REVIEW:
        if (event === Event.CODE_APPROVED) {
          // Ready for Bean Counter to determine next chunk
          this.state = State.BEAN_COUNTING;
          this.context.planAttempts = 0;  // Reset for new cycle
          this.context.codeAttempts = 0;  // Reset for new cycle
          this.context.currentPlan = undefined;
          this.context.planFeedback = undefined;
          this.context.currentChunk = undefined;
          return true;
        } else if (event === Event.CODE_REVISION_REQUESTED) {
          if (this.context.codeAttempts >= this.context.maxCodeAttempts) {
            log.orchestrator(`Max code attempts (${this.context.maxCodeAttempts}) reached`);
            this.state = State.TASK_FAILED;
          } else {
            this.state = State.IMPLEMENTING;
            // Store feedback for next attempt - use data if provided, otherwise keep existing
            if (data !== undefined) {
              this.context.codeFeedback = data;
            }
          }
          return true;
        } else if (event === Event.CODE_REJECTED) {
          // Go back to Bean Counter to re-chunk
          this.state = State.BEAN_COUNTING;
          this.context.planAttempts = 0;
          this.context.codeAttempts = 0;
          this.context.currentPlan = undefined;
          this.context.currentChunk = undefined;
          this.context.planFeedback = data; // Use rejection reason as feedback
          return true;
        } else if (event === Event.CODE_NEEDS_HUMAN) {
          // Store feedback and wait for human decision
          this.context.codeFeedback = data;
          return true; // Stay in CODE_REVIEW state
        } else if (event === Event.TASK_COMPLETED) {
          this.state = State.TASK_COMPLETE;
          return true;
        } else if (event === Event.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        }
        break;

      case State.TASK_COMPLETE:
      case State.TASK_FAILED:
      case State.TASK_ABORTED:
        // Terminal states - no transitions
        return false;

      default:
        if (event === Event.ERROR_OCCURRED) {
          this.handleError(data);
          return true;
        }
    }

    return false;
  }

  // Error handling
  private handleError(error?: Error) {
    this.context.lastError = error;
    log.orchestrator(`Error occurred: ${error?.message || 'Unknown error'}`);

    // Determine recovery based on current state
    switch (this.state) {
      case State.PLANNING:
      case State.PLAN_REVIEW:
        // Note: attempts are incremented in orchestrator before each attempt
        // Check if we can retry
        if (this.context.planAttempts < this.context.maxPlanAttempts) {
          this.state = State.PLANNING;
          this.context.planFeedback = `Previous attempt failed: ${error?.message || 'Unknown error'}`;
          log.orchestrator(`Will retry planning after error`);
        } else {
          this.state = State.TASK_FAILED;
          log.orchestrator(`Max plan attempts reached after error`);
        }
        break;

      case State.IMPLEMENTING:
      case State.CODE_REVIEW:
        // Note: attempts are incremented in orchestrator before each attempt
        // Check if we can retry
        if (this.context.codeAttempts < this.context.maxCodeAttempts) {
          this.state = State.IMPLEMENTING;
          this.context.codeFeedback = `Previous attempt failed: ${error?.message || 'Unknown error'}`;
          log.orchestrator(`Will retry implementation after error`);
        } else {
          this.state = State.TASK_FAILED;
          log.orchestrator(`Max code attempts reached after error`);
        }
        break;

      default:
        this.state = State.TASK_FAILED;
    }
  }

  // Reset for a new cycle
  reset() {
    this.state = State.TASK_START;
    this.context = {
      planAttempts: 0,
      codeAttempts: 0,
      maxPlanAttempts: this.context.maxPlanAttempts,
      maxCodeAttempts: this.context.maxCodeAttempts
    };
  }

  // Get a human-readable status
  getStatus(): string {
    const parts = [`State: ${this.state}`];

    if (this.context.currentPlan) {
      parts.push(`Current plan: ${this.context.currentPlan.description}`);
    }

    if (this.state === State.PLANNING || this.state === State.PLAN_REVIEW) {
      parts.push(`Plan attempts: ${this.context.planAttempts}/${this.context.maxPlanAttempts}`);
    }

    if (this.state === State.IMPLEMENTING || this.state === State.CODE_REVIEW) {
      parts.push(`Code attempts: ${this.context.codeAttempts}/${this.context.maxCodeAttempts}`);
    }

    if (this.context.lastError) {
      parts.push(`Last error: ${this.context.lastError.message}`);
    }

    return parts.join(', ');
  }
}
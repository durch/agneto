import { EventEmitter } from 'events';
import { log } from "./ui/log.js";
import type { CoderPlanProposal } from "./types.js";
import type { ExecutionStateCheckpoint } from "./audit/types.js";
import type { AuditLogger } from "./audit/audit-logger.js";
import type { ToolStatus } from "./task-state-machine.js";

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

  // Task baseline tracking (prevents reverting pre-task commits)
  baselineCommit?: string;

  // Agent outputs for UI display
  lastBeanCounterOutput?: string;
  lastCoderOutput?: string;
  lastReviewerOutput?: string;

  // Agent summaries for concise progress tracking
  coderSummary?: string;
  reviewerSummary?: string;

  // Human review tracking
  needsHumanReview: boolean;
  humanReviewContext?: string;

  // Configuration
  maxPlanAttempts: number;
  maxCodeAttempts: number;
}

export class CoderReviewerStateMachine extends EventEmitter {
  private state: State = State.TASK_START;
  private context: StateMachineContext;
  private auditLogger?: AuditLogger;
  private toolStatus: ToolStatus | null = null;

  constructor(maxPlanAttempts = 7, maxCodeAttempts = 7, baselineCommit?: string, auditLogger?: AuditLogger) {
    super();
    this.context = {
      planAttempts: 0,
      codeAttempts: 0,
      maxPlanAttempts,
      maxCodeAttempts,
      baselineCommit,
      needsHumanReview: false
    };
    this.auditLogger = auditLogger;
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

  // Agent output accessors for UI display
  setAgentOutput(agent: 'bean' | 'coder' | 'reviewer', output: string) {
    if (agent === 'bean') {
      this.context.lastBeanCounterOutput = output;
    } else if (agent === 'coder') {
      this.context.lastCoderOutput = output;
    } else if (agent === 'reviewer') {
      this.context.lastReviewerOutput = output;
    }
    this.emit('execution:output:updated', { agent, output });
  }

  getAgentOutput(agent: 'bean' | 'coder' | 'reviewer'): string | undefined {
    if (agent === 'bean') {
      return this.context.lastBeanCounterOutput;
    } else if (agent === 'coder') {
      return this.context.lastCoderOutput;
    } else if (agent === 'reviewer') {
      return this.context.lastReviewerOutput;
    }
    return undefined;
  }

  // Summary accessors for concise progress tracking
  setSummary(agent: 'coder' | 'reviewer', summary: string): void {
    if (agent === 'coder') {
      this.context.coderSummary = summary;
    } else if (agent === 'reviewer') {
      this.context.reviewerSummary = summary;
    }
    this.emit('execution:summary:updated', { agent, summary });
  }

  getSummary(agent: 'coder' | 'reviewer'): string | undefined {
    if (agent === 'coder') {
      return this.context.coderSummary;
    } else if (agent === 'reviewer') {
      return this.context.reviewerSummary;
    }
    return undefined;
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

  // Human review state management
  setNeedsHumanReview(needed: boolean, context?: string): void {
    this.context.needsHumanReview = needed;
    this.context.humanReviewContext = context;
  }

  getNeedsHumanReview(): boolean {
    return this.context.needsHumanReview;
  }

  getHumanReviewContext(): string | undefined {
    return this.context.humanReviewContext;
  }

  clearHumanReview(): void {
    this.context.needsHumanReview = false;
    this.context.humanReviewContext = undefined;
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

    // Emit event for debug overlay
    this.emit('execution:event', { event, oldState, newState: this.state });

    if (oldState !== this.state) {
      log.orchestrator(`State transition: ${oldState} → ${this.state} (event: ${event})`);

      // Emit state change event for debug overlay
      this.emit('execution:state:changed', { oldState, newState: this.state, event });

      // Emit phase change event (mirrors TaskStateMachine pattern)
      this.emit('execution:phase:changed', { from: oldState, to: this.state });

      // Emit audit event for state transition
      if (this.auditLogger) {
        this.auditLogger.captureEvent('system', 'phase_transition', `State transition: ${oldState} → ${this.state}`, {
          metadata: {
            oldState,
            newState: this.state,
            event
          }
        });
      }
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
        } else if (event === Event.ERROR_OCCURRED) {
          this.state = State.TASK_FAILED;
          this.context.lastError = data;
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
        } else if (event === Event.ERROR_OCCURRED) {
          this.state = State.TASK_FAILED;
          this.context.lastError = data;
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
          // Store feedback about what was already complete for Bean Counter
          if (data !== undefined) {
            this.context.codeFeedback = data;
          }
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
          this.context.codeFeedback = data; // Use rejection reason as feedback
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
      case State.TASK_START:
      case State.BEAN_COUNTING:
        // No retry for these states - go to failed
        this.state = State.TASK_FAILED;
        log.orchestrator(`Error in ${this.state} - task failed`);
        break;

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
        log.orchestrator(`Unhandled error in state ${this.state} - task failed`);
    }
  }

  // Reset for a new cycle
  reset() {
    this.state = State.TASK_START;
    this.context = {
      planAttempts: 0,
      codeAttempts: 0,
      maxPlanAttempts: this.context.maxPlanAttempts,
      maxCodeAttempts: this.context.maxCodeAttempts,
      needsHumanReview: false
    };
  }

  // Restore state machine from checkpoint data
  restoreFromCheckpoint(checkpoint: ExecutionStateCheckpoint): void {
    try {
      log.orchestrator(`🔄 Restoring execution state machine from checkpoint...`);

      // Validate checkpoint data
      if (!checkpoint) {
        throw new Error('Checkpoint data is required');
      }

      // Restore current plan if available
      if (checkpoint.currentPlan) {
        this.context.currentPlan = {
          type: checkpoint.currentPlan.type,
          description: checkpoint.currentPlan.description,
          steps: [...checkpoint.currentPlan.steps],
          affectedFiles: [...checkpoint.currentPlan.affectedFiles]
        } as CoderPlanProposal;
      } else {
        this.context.currentPlan = undefined;
      }

      // Restore Bean Counter work chunk context
      if (checkpoint.currentChunk) {
        this.context.currentChunk = {
          description: checkpoint.currentChunk.description,
          requirements: [...checkpoint.currentChunk.requirements],
          context: checkpoint.currentChunk.context
        };
      } else {
        this.context.currentChunk = undefined;
      }

      // Restore feedback properties
      this.context.planFeedback = checkpoint.planFeedback;
      this.context.codeFeedback = checkpoint.codeFeedback;

      // Restore attempt counters
      this.context.planAttempts = checkpoint.planAttempts || 0;
      this.context.codeAttempts = checkpoint.codeAttempts || 0;

      // Restore attempt limits
      this.context.maxPlanAttempts = checkpoint.maxPlanAttempts || 7;
      this.context.maxCodeAttempts = checkpoint.maxCodeAttempts || 7;

      // Restore error information with proper Error object reconstruction
      if (checkpoint.lastError) {
        this.context.lastError = new Error(checkpoint.lastError.message);
        if (checkpoint.lastError.stack) {
          this.context.lastError.stack = checkpoint.lastError.stack;
        }
      } else {
        this.context.lastError = undefined;
      }

      // Validate and restore state
      // Convert string state back to State enum
      if (checkpoint.currentState && Object.values(State).includes(checkpoint.currentState as State)) {
        this.state = checkpoint.currentState as State;
      } else {
        throw new Error(`Invalid state in checkpoint: ${checkpoint.currentState}`);
      }

      log.orchestrator(`✅ Execution state machine restored to state: ${this.state}`);
      log.orchestrator(`📋 Restored context: plan=${this.context.currentPlan ? 'set' : 'unset'}, chunk=${this.context.currentChunk ? 'set' : 'unset'}, attempts=${this.context.planAttempts}/${this.context.codeAttempts}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.orchestrator(`❌ Failed to restore execution state machine: ${errorMessage}`);
      throw new Error(`Execution state machine restoration failed: ${errorMessage}`);
    }
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
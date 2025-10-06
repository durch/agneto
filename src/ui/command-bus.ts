import { EventEmitter } from 'events';
import type { PlanFeedback } from './planning-interface.js';
import type { RefinementFeedback } from './refinement-interface.js';
import type { SuperReviewerDecision, HumanInteractionResult } from '../types.js';

/**
 * Command types for UI → Orchestrator communication
 */
export type Command =
  | { type: 'plan:approve' }
  | { type: 'plan:reject'; details: string }
  | { type: 'refinement:approve' }
  | { type: 'refinement:reject'; details: string }
  | { type: 'question:answer'; answer: string }
  | { type: 'superreview:approve' }
  | { type: 'superreview:retry'; feedback: string }
  | { type: 'superreview:abandon' }
  | { type: 'humanreview:approve'; feedback: string }
  | { type: 'humanreview:revise'; feedback: string }
  | { type: 'humanreview:needs_human'; feedback: string };

/**
 * CommandBus - Central command handler for UI → Orchestrator communication
 *
 * Uses event-driven architecture to decouple UI from orchestrator logic.
 * UI sends commands, orchestrator listens and processes them.
 */
export class CommandBus extends EventEmitter {
  private commandQueue: Array<{ command: Command; resolve: (value: any) => void }> = [];
  private processing: boolean = false;

  /**
   * Send a command from UI to orchestrator
   * Returns a promise that resolves when the command is processed
   */
  async sendCommand<T = void>(command: Command): Promise<T> {
    return new Promise((resolve) => {
      this.commandQueue.push({ command, resolve });
      this.processQueue();
    });
  }

  /**
   * Process the command queue
   */
  private processQueue(): void {
    if (this.processing || this.commandQueue.length === 0) {
      return;
    }

    this.processing = true;
    const { command, resolve } = this.commandQueue.shift()!;

    // Emit the command as an event for orchestrator to handle
    this.emit('command', command, resolve);
  }

  /**
   * Mark current command as complete and process next
   */
  commandComplete(): void {
    this.processing = false;
    this.processQueue();
  }

  /**
   * Wait for a specific command type
   * Used by orchestrator to wait for user input
   */
  async waitForCommand<T = void>(type: Command['type']): Promise<T> {
    return new Promise((resolve) => {
      const handler = (command: Command, commandResolve: (value: any) => void) => {
        if (command.type === type) {
          this.off('command', handler);

          // Extract the relevant data based on command type
          let result: any;
          switch (command.type) {
            case 'plan:approve':
              result = { type: 'approve' } as PlanFeedback;
              break;
            case 'plan:reject':
              result = { type: 'wrong-approach', details: command.details } as PlanFeedback;
              break;
            case 'refinement:approve':
              result = { type: 'approve' } as RefinementFeedback;
              break;
            case 'refinement:reject':
              result = { type: 'reject', details: command.details } as RefinementFeedback;
              break;
            case 'question:answer':
              result = command.answer;
              break;
            case 'superreview:approve':
              result = { action: 'approve' } as SuperReviewerDecision;
              break;
            case 'superreview:retry':
              result = { action: 'retry', feedback: command.feedback } as SuperReviewerDecision;
              break;
            case 'superreview:abandon':
              result = { action: 'abandon' } as SuperReviewerDecision;
              break;
            case 'humanreview:approve':
              result = { decision: 'approve', feedback: command.feedback } as HumanInteractionResult;
              break;
            case 'humanreview:revise':
              result = { decision: 'retry', feedback: command.feedback } as HumanInteractionResult;
              break;
            case 'humanreview:needs_human':
              result = { decision: 'reject', feedback: command.feedback } as HumanInteractionResult;
              break;
          }

          commandResolve(result);
          this.commandComplete();
          resolve(result);
        }
      };

      this.on('command', handler);
    });
  }

  /**
   * Wait for any command from a list of types
   * Useful when multiple command types are valid
   */
  async waitForAnyCommand<T = void>(types: Command['type'][]): Promise<T> {
    return new Promise((resolve) => {
      const handler = (command: Command, commandResolve: (value: any) => void) => {
        if (types.includes(command.type)) {
          this.off('command', handler);

          // Extract the relevant data (same logic as waitForCommand)
          let result: any;
          switch (command.type) {
            case 'plan:approve':
              result = { type: 'approve' } as PlanFeedback;
              break;
            case 'plan:reject':
              result = { type: 'wrong-approach', details: command.details } as PlanFeedback;
              break;
            case 'refinement:approve':
              result = { type: 'approve' } as RefinementFeedback;
              break;
            case 'refinement:reject':
              result = { type: 'reject', details: command.details } as RefinementFeedback;
              break;
            case 'question:answer':
              result = command.answer;
              break;
            case 'superreview:approve':
              result = { action: 'approve' } as SuperReviewerDecision;
              break;
            case 'superreview:retry':
              result = { action: 'retry', feedback: command.feedback } as SuperReviewerDecision;
              break;
            case 'superreview:abandon':
              result = { action: 'abandon' } as SuperReviewerDecision;
              break;
            case 'humanreview:approve':
              result = { decision: 'approve', feedback: command.feedback } as HumanInteractionResult;
              break;
            case 'humanreview:revise':
              result = { decision: 'retry', feedback: command.feedback } as HumanInteractionResult;
              break;
            case 'humanreview:needs_human':
              result = { decision: 'reject', feedback: command.feedback } as HumanInteractionResult;
              break;
          }

          commandResolve(result);
          this.commandComplete();
          resolve(result);
        }
      };

      this.on('command', handler);
    });
  }

  /**
   * Clear the command queue (useful for cleanup/reset)
   */
  clear(): void {
    this.commandQueue = [];
    this.processing = false;
  }
}

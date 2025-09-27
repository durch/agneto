import { describe, it, expect, beforeEach } from 'vitest';
import { CoderReviewerStateMachine, State, Event } from '../../src/state-machine.js';

describe('CoderReviewerStateMachine', () => {
  let stateMachine: CoderReviewerStateMachine;

  beforeEach(() => {
    stateMachine = new CoderReviewerStateMachine();
  });

  describe('Initial State', () => {
    it('starts in TASK_START state', () => {
      expect(stateMachine.getCurrentState()).toBe(State.TASK_START);
    });

    it('can continue from initial state', () => {
      expect(stateMachine.canContinue()).toBe(true);
    });
  });

  describe('Bean Counter Coordination', () => {
    it('starts with chunking before planning', () => {
      // Start chunking (Bean Counter phase)
      stateMachine.transition(Event.START_CHUNKING);
      expect(stateMachine.getCurrentState()).toBe(State.BEAN_COUNTING);

      // Bean Counter provides chunk
      const chunk = {
        description: 'Implement user authentication',
        requirements: ['Add login form', 'Add validation'],
        context: 'Working on auth module'
      };
      stateMachine.transition(Event.CHUNK_READY, chunk);
      expect(stateMachine.getCurrentState()).toBe(State.PLANNING);
      expect(stateMachine.getCurrentChunk()).toEqual(chunk);
    });

    it('can complete task directly from Bean Counter', () => {
      stateMachine.transition(Event.START_CHUNKING);
      stateMachine.transition(Event.TASK_COMPLETED);
      expect(stateMachine.getCurrentState()).toBe(State.TASK_COMPLETE);
    });
  });

  describe('Planning Cycle', () => {
    beforeEach(() => {
      // Get to planning state via Bean Counter
      stateMachine.transition(Event.START_CHUNKING);
      const chunk = {
        description: 'Test chunk',
        requirements: ['Requirement 1'],
        context: 'Test context'
      };
      stateMachine.transition(Event.CHUNK_READY, chunk);
    });

    it('transitions through planning states correctly', () => {
      expect(stateMachine.getCurrentState()).toBe(State.PLANNING);

      // Propose a plan
      stateMachine.transition(Event.PLAN_PROPOSED);
      expect(stateMachine.getCurrentState()).toBe(State.PLAN_REVIEW);

      // Approve the plan
      stateMachine.transition(Event.PLAN_APPROVED);
      expect(stateMachine.getCurrentState()).toBe(State.IMPLEMENTING);
    });

    it('handles plan revision requests', () => {
      stateMachine.transition(Event.PLAN_PROPOSED);

      // Request revision
      stateMachine.setPlanFeedback('Please add more detail');
      stateMachine.transition(Event.PLAN_REVISION_REQUESTED);

      expect(stateMachine.getCurrentState()).toBe(State.PLANNING);
      expect(stateMachine.getPlanFeedback()).toBe('Please add more detail');
    });

    it('handles plan rejection', () => {
      stateMachine.transition(Event.PLAN_PROPOSED);

      stateMachine.transition(Event.PLAN_REJECTED);
      // Rejection resets to planning with clean slate
      expect(stateMachine.getCurrentState()).toBe(State.PLANNING);
      expect(stateMachine.canContinue()).toBe(true);
      // Attempts should be reset
      expect(stateMachine.getPlanAttempts()).toBe(0);
    });

    it('tracks planning attempts', () => {
      expect(stateMachine.getPlanAttempts()).toBe(0);

      stateMachine.incrementPlanAttempts();
      expect(stateMachine.getPlanAttempts()).toBe(1);

      stateMachine.incrementPlanAttempts();
      expect(stateMachine.getPlanAttempts()).toBe(2);
    });

    it('handles max planning attempts', () => {
      // Max out attempts
      for (let i = 0; i < 4; i++) {
        stateMachine.incrementPlanAttempts();
      }

      stateMachine.transition(Event.MAX_ATTEMPTS_REACHED);
      expect(stateMachine.getCurrentState()).toBe(State.TASK_FAILED);
    });
  });

  describe('Implementation Cycle', () => {
    beforeEach(() => {
      // Get to implementation state via Bean Counter flow
      stateMachine.transition(Event.START_CHUNKING);
      const chunk = {
        description: 'Test chunk',
        requirements: ['Requirement 1'],
        context: 'Test context'
      };
      stateMachine.transition(Event.CHUNK_READY, chunk);
      stateMachine.transition(Event.PLAN_PROPOSED);
      stateMachine.transition(Event.PLAN_APPROVED);
    });

    it('transitions through implementation states', () => {
      expect(stateMachine.getCurrentState()).toBe(State.IMPLEMENTING);

      // Apply code
      stateMachine.transition(Event.CODE_APPLIED);
      expect(stateMachine.getCurrentState()).toBe(State.CODE_REVIEW);

      // Approve code
      stateMachine.transition(Event.CODE_APPROVED);
      expect(stateMachine.getCurrentState()).toBe(State.BEAN_COUNTING);
    });

    it('handles code revision requests', () => {
      stateMachine.transition(Event.CODE_APPLIED);

      stateMachine.setCodeFeedback('Fix the import statement');
      stateMachine.transition(Event.CODE_REVISION_REQUESTED);

      expect(stateMachine.getCurrentState()).toBe(State.IMPLEMENTING);
      expect(stateMachine.getCodeFeedback()).toBe('Fix the import statement');
    });

    it('handles code rejection', () => {
      stateMachine.transition(Event.CODE_APPLIED);
      stateMachine.transition(Event.CODE_REJECTED);

      // Rejection goes back to Bean Counter for re-chunking
      expect(stateMachine.getCurrentState()).toBe(State.BEAN_COUNTING);
      expect(stateMachine.canContinue()).toBe(true);
      // Attempts should be reset
      expect(stateMachine.getPlanAttempts()).toBe(0);
      expect(stateMachine.getCodeAttempts()).toBe(0);
    });

    it('tracks implementation attempts', () => {
      expect(stateMachine.getCodeAttempts()).toBe(0);

      stateMachine.incrementCodeAttempts();
      expect(stateMachine.getCodeAttempts()).toBe(1);

      stateMachine.incrementCodeAttempts();
      expect(stateMachine.getCodeAttempts()).toBe(2);
    });

    it('handles max implementation attempts', () => {
      // Max out attempts
      for (let i = 0; i < 4; i++) {
        stateMachine.incrementCodeAttempts();
      }

      stateMachine.transition(Event.MAX_ATTEMPTS_REACHED);
      expect(stateMachine.getCurrentState()).toBe(State.TASK_FAILED);
    });
  });

  describe('Task Completion', () => {
    it('completes task when signaled from Bean Counter', () => {
      stateMachine.transition(Event.START_CHUNKING);
      stateMachine.transition(Event.TASK_COMPLETED);

      expect(stateMachine.getCurrentState()).toBe(State.TASK_COMPLETE);
      expect(stateMachine.canContinue()).toBe(false);
    });

    it('continues to next step when approved - goes to Bean Counter', () => {
      // Get to code review
      stateMachine.transition(Event.START_CHUNKING);
      const chunk = {
        description: 'Test chunk',
        requirements: ['Requirement 1'],
        context: 'Test context'
      };
      stateMachine.transition(Event.CHUNK_READY, chunk);
      stateMachine.transition(Event.PLAN_PROPOSED);
      stateMachine.transition(Event.PLAN_APPROVED);
      stateMachine.transition(Event.CODE_APPLIED);

      // Approve with continue - goes back to Bean Counter
      stateMachine.transition(Event.CODE_APPROVED);
      expect(stateMachine.getCurrentState()).toBe(State.BEAN_COUNTING);
    });

    it('completes when task is done', () => {
      // Get to code review
      stateMachine.transition(Event.START_CHUNKING);
      const chunk = {
        description: 'Test chunk',
        requirements: ['Requirement 1'],
        context: 'Test context'
      };
      stateMachine.transition(Event.CHUNK_READY, chunk);
      stateMachine.transition(Event.PLAN_PROPOSED);
      stateMachine.transition(Event.PLAN_APPROVED);
      stateMachine.transition(Event.CODE_APPLIED);

      // Complete the task from code review
      stateMachine.transition(Event.TASK_COMPLETED);

      expect(stateMachine.getCurrentState()).toBe(State.TASK_COMPLETE);
    });
  });

  describe('Human Interaction', () => {
    it('handles plan needs_human verdict', () => {
      stateMachine.transition(Event.START_CHUNKING);
      const chunk = {
        description: 'Test chunk',
        requirements: ['Requirement 1'],
        context: 'Test context'
      };
      stateMachine.transition(Event.CHUNK_READY, chunk);
      stateMachine.transition(Event.PLAN_PROPOSED);
      stateMachine.transition(Event.PLAN_NEEDS_HUMAN);

      expect(stateMachine.getCurrentState()).toBe(State.PLAN_REVIEW);
      // State machine pauses here for human input
    });

    it('handles code needs_human verdict', () => {
      stateMachine.transition(Event.START_CHUNKING);
      const chunk = {
        description: 'Test chunk',
        requirements: ['Requirement 1'],
        context: 'Test context'
      };
      stateMachine.transition(Event.CHUNK_READY, chunk);
      stateMachine.transition(Event.PLAN_PROPOSED);
      stateMachine.transition(Event.PLAN_APPROVED);
      stateMachine.transition(Event.CODE_APPLIED);
      stateMachine.transition(Event.CODE_NEEDS_HUMAN);

      expect(stateMachine.getCurrentState()).toBe(State.CODE_REVIEW);
      // State machine pauses here for human input
    });

    it('handles human abort', () => {
      stateMachine.transition(Event.START_CHUNKING);
      stateMachine.transition(Event.HUMAN_ABORT);

      expect(stateMachine.getCurrentState()).toBe(State.TASK_ABORTED);
      expect(stateMachine.canContinue()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('handles errors during planning', () => {
      stateMachine.transition(Event.START_CHUNKING);
      const chunk = {
        description: 'Test chunk',
        requirements: ['Requirement 1'],
        context: 'Test context'
      };
      stateMachine.transition(Event.CHUNK_READY, chunk);

      const error = new Error('Planning failed');
      stateMachine.transition(Event.ERROR_OCCURRED, error);

      // Should retry since we have attempts left (0 < 7)
      expect(stateMachine.getCurrentState()).toBe(State.PLANNING);
      expect(stateMachine.getLastError()).toBe(error);
      expect(stateMachine.getPlanFeedback()).toBe('Previous attempt failed: Planning failed');
    });

    it('handles errors during implementation', () => {
      stateMachine.transition(Event.START_CHUNKING);
      const chunk = {
        description: 'Test chunk',
        requirements: ['Requirement 1'],
        context: 'Test context'
      };
      stateMachine.transition(Event.CHUNK_READY, chunk);
      stateMachine.transition(Event.PLAN_PROPOSED);
      stateMachine.transition(Event.PLAN_APPROVED);

      const error = new Error('Implementation failed');
      stateMachine.transition(Event.ERROR_OCCURRED, error);

      // Should retry since we have attempts left (0 < 7)
      expect(stateMachine.getCurrentState()).toBe(State.IMPLEMENTING);
      expect(stateMachine.getLastError()).toBe(error);
      expect(stateMachine.getCodeFeedback()).toBe('Previous attempt failed: Implementation failed');
    });
  });

  describe('Context Management', () => {
    it('maintains context through transitions', () => {
      const context = stateMachine.getContext();

      expect(context.maxPlanAttempts).toBe(7);
      expect(context.maxCodeAttempts).toBe(7);
      expect(context.planAttempts).toBe(0);
      expect(context.codeAttempts).toBe(0);
    });

    it('preserves feedback between attempts', () => {
      stateMachine.setPlanFeedback('Add error handling');
      stateMachine.setCodeFeedback('Fix imports');

      expect(stateMachine.getPlanFeedback()).toBe('Add error handling');
      expect(stateMachine.getCodeFeedback()).toBe('Fix imports');

      // Clear feedback
      stateMachine.clearPlanFeedback();
      stateMachine.clearCodeFeedback();

      expect(stateMachine.getPlanFeedback()).toBeNull();
      expect(stateMachine.getCodeFeedback()).toBeNull();
    });

    it('resets attempts when moving to new phase', () => {
      stateMachine.transition(Event.START_CHUNKING);
      const chunk = {
        description: 'Test chunk',
        requirements: ['Requirement 1'],
        context: 'Test context'
      };
      stateMachine.transition(Event.CHUNK_READY, chunk);
      stateMachine.incrementPlanAttempts();
      stateMachine.incrementPlanAttempts();

      // Move to implementation
      stateMachine.transition(Event.PLAN_PROPOSED);
      stateMachine.transition(Event.PLAN_APPROVED);

      // Plan attempts preserved, code attempts start fresh
      expect(stateMachine.getPlanAttempts()).toBe(2);
      expect(stateMachine.getCodeAttempts()).toBe(0);
    });
  });
});
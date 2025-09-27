import { describe, it, expect, beforeEach } from 'vitest';
import { TaskStateMachine, TaskState, TaskEvent } from '../../src/task-state-machine.js';
import { CoderReviewerStateMachine } from '../../src/state-machine.js';

describe('TaskStateMachine', () => {
  let stateMachine: TaskStateMachine;
  const taskId = 'test-task-1';
  const humanTask = 'Add a new feature';
  const cwd = '/test/workspace';

  beforeEach(() => {
    stateMachine = new TaskStateMachine(taskId, humanTask, cwd, {});
  });

  describe('Initial State', () => {
    it('starts in TASK_INIT state', () => {
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_INIT);
    });

    it('stores task context correctly', () => {
      const context = stateMachine.getContext();
      expect(context.taskId).toBe(taskId);
      expect(context.humanTask).toBe(humanTask);
      expect(context.workingDirectory).toBe(cwd);
    });

    it('can continue from initial state', () => {
      expect(stateMachine.canContinue()).toBe(true);
    });
  });

  describe('Task Refinement Phase', () => {
    it('skips refinement in non-interactive mode', () => {
      const nonInteractive = new TaskStateMachine(taskId, humanTask, cwd, { nonInteractive: true });
      nonInteractive.transition(TaskEvent.START_TASK);

      expect(nonInteractive.getCurrentState()).toBe(TaskState.TASK_PLANNING);
    });

    it('enters refinement in interactive mode', () => {
      const interactive = new TaskStateMachine(taskId, humanTask, cwd, { nonInteractive: false });
      interactive.transition(TaskEvent.START_TASK);

      expect(interactive.getCurrentState()).toBe(TaskState.TASK_REFINING);
    });

    it('handles refinement completion', () => {
      stateMachine.transition(TaskEvent.START_TASK);
      stateMachine.transition(TaskEvent.REFINEMENT_COMPLETE);

      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_PLANNING);
    });

    it('handles refinement cancellation', () => {
      stateMachine.transition(TaskEvent.START_TASK);
      stateMachine.transition(TaskEvent.REFINEMENT_CANCELLED);

      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_PLANNING);
    });

    it('stores refined task', () => {
      const refinedTask = {
        goal: 'Refined goal',
        context: 'Context info',
        constraints: ['Constraint 1'],
        successCriteria: ['Criteria 1'],
        raw: 'Raw input'
      };

      stateMachine.setRefinedTask(refinedTask, 'Refined task description');

      const context = stateMachine.getContext();
      expect(context.refinedTask).toEqual(refinedTask);
      expect(context.taskToUse).toBe('Refined task description');
    });
  });

  describe('Planning Phase', () => {
    beforeEach(() => {
      const nonInteractive = new TaskStateMachine(taskId, humanTask, cwd, { nonInteractive: true });
      nonInteractive.transition(TaskEvent.START_TASK);
      stateMachine = nonInteractive;
    });

    it('transitions to planning state', () => {
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_PLANNING);
    });

    it('handles successful plan creation', () => {
      const planMd = '# Plan\n\n1. Step 1\n2. Step 2';
      const planPath = '/test/plan.md';

      stateMachine.setPlan(planMd, planPath);
      stateMachine.transition(TaskEvent.PLAN_CREATED);

      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_CURMUDGEONING);
      expect(stateMachine.getPlanMd()).toBe(planMd);
      expect(stateMachine.getPlanPath()).toBe(planPath);
    });

    it('handles planning failure', () => {
      const error = new Error('Planning failed');
      stateMachine.transition(TaskEvent.PLAN_FAILED, error);

      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_ABANDONED);
      expect(stateMachine.getLastError()).toBe(error);
    });
  });

  describe('Curmudgeon Phase', () => {
    beforeEach(() => {
      const nonInteractive = new TaskStateMachine(taskId, humanTask, cwd, { nonInteractive: true });
      nonInteractive.transition(TaskEvent.START_TASK);
      nonInteractive.setPlan('# Test Plan', '/test/plan.md');
      nonInteractive.transition(TaskEvent.PLAN_CREATED);
      stateMachine = nonInteractive;
    });

    it('enters curmudgeon state after planning', () => {
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_CURMUDGEONING);
    });

    it('handles curmudgeon approval', () => {
      stateMachine.transition(TaskEvent.CURMUDGEON_APPROVED);
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_EXECUTING);
    });

    it('handles curmudgeon simplify request', () => {
      stateMachine.transition(TaskEvent.CURMUDGEON_SIMPLIFY);
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_PLANNING);
      expect(stateMachine.getSimplificationCount()).toBe(1);
    });

    it('tracks simplification count', () => {
      expect(stateMachine.getSimplificationCount()).toBe(0);
      stateMachine.transition(TaskEvent.CURMUDGEON_SIMPLIFY);
      expect(stateMachine.getSimplificationCount()).toBe(1);
    });

    it('manages curmudgeon feedback', () => {
      stateMachine.setCurmudgeonFeedback('Too complex, simplify');
      expect(stateMachine.getCurmudgeonFeedback()).toBe('Too complex, simplify');

      stateMachine.clearCurmudgeonFeedback();
      expect(stateMachine.getCurmudgeonFeedback()).toBeUndefined();
    });
  });

  describe('Execution Phase', () => {
    beforeEach(() => {
      const nonInteractive = new TaskStateMachine(taskId, humanTask, cwd, { nonInteractive: true });
      nonInteractive.transition(TaskEvent.START_TASK);
      nonInteractive.setPlan('# Test Plan', '/test/plan.md');
      nonInteractive.transition(TaskEvent.PLAN_CREATED);
      nonInteractive.transition(TaskEvent.CURMUDGEON_APPROVED);
      stateMachine = nonInteractive;
    });

    it('enters execution state', () => {
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_EXECUTING);
    });

    it('manages execution state machine', () => {
      expect(stateMachine.getExecutionStateMachine()).toBeNull();

      const execMachine = new CoderReviewerStateMachine();
      stateMachine.setExecutionStateMachine(execMachine);

      expect(stateMachine.getExecutionStateMachine()).toBe(execMachine);
    });

    it('handles execution completion', () => {
      stateMachine.transition(TaskEvent.EXECUTION_COMPLETE);
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_SUPER_REVIEWING);
    });

    it('handles execution failure', () => {
      const error = new Error('Execution failed');
      stateMachine.transition(TaskEvent.EXECUTION_FAILED, error);

      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_ABANDONED);
      expect(stateMachine.getLastError()).toBe(error);
    });

    it('manages session IDs', () => {
      stateMachine.setSessionIds('coder-123', 'reviewer-456');

      const context = stateMachine.getContext();
      expect(context.coderSessionId).toBe('coder-123');
      expect(context.reviewerSessionId).toBe('reviewer-456');
    });
  });

  describe('Super Review Phase', () => {
    beforeEach(() => {
      const nonInteractive = new TaskStateMachine(taskId, humanTask, cwd, { nonInteractive: true });
      nonInteractive.transition(TaskEvent.START_TASK);
      nonInteractive.setPlan('# Test Plan', '/test/plan.md');
      nonInteractive.transition(TaskEvent.PLAN_CREATED);
      nonInteractive.transition(TaskEvent.CURMUDGEON_APPROVED);
      nonInteractive.transition(TaskEvent.EXECUTION_COMPLETE);
      stateMachine = nonInteractive;
    });

    it('enters super review state', () => {
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_SUPER_REVIEWING);
    });

    it('handles super review pass', () => {
      const result = {
        verdict: 'pass' as const,
        summary: 'All good',
        issues: []
      };

      stateMachine.setSuperReviewResult(result);
      stateMachine.transition(TaskEvent.SUPER_REVIEW_PASSED);

      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_FINALIZING);
      expect(stateMachine.getSuperReviewResult()).toEqual(result);
    });

    it('handles super review needs human', () => {
      const result = {
        verdict: 'needs-human' as const,
        summary: 'Issues found',
        issues: ['Issue 1', 'Issue 2']
      };

      stateMachine.setSuperReviewResult(result);
      stateMachine.transition(TaskEvent.SUPER_REVIEW_NEEDS_HUMAN);

      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_SUPER_REVIEWING);
    });

    it('handles human approval after review', () => {
      stateMachine.transition(TaskEvent.HUMAN_APPROVED);
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_FINALIZING);
    });

    it('handles human retry request', () => {
      stateMachine.setRetryFeedback('Fix the logging issue');
      stateMachine.transition(TaskEvent.HUMAN_RETRY);

      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_PLANNING);
      expect(stateMachine.isRetry()).toBe(true);
      expect(stateMachine.getContext().retryFeedback).toBe('Fix the logging issue');
    });

    it('handles human abandon', () => {
      stateMachine.transition(TaskEvent.HUMAN_ABANDON);
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_ABANDONED);
    });
  });

  describe('Finalization Phase', () => {
    beforeEach(() => {
      const nonInteractive = new TaskStateMachine(taskId, humanTask, cwd, { nonInteractive: true });
      nonInteractive.transition(TaskEvent.START_TASK);
      nonInteractive.setPlan('# Test Plan', '/test/plan.md');
      nonInteractive.transition(TaskEvent.PLAN_CREATED);
      nonInteractive.transition(TaskEvent.CURMUDGEON_APPROVED);
      nonInteractive.transition(TaskEvent.EXECUTION_COMPLETE);
      nonInteractive.transition(TaskEvent.SUPER_REVIEW_PASSED);
      stateMachine = nonInteractive;
    });

    it('enters finalization state', () => {
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_FINALIZING);
    });

    it('handles auto merge', () => {
      const autoMerge = new TaskStateMachine(taskId, humanTask, cwd, { autoMerge: true, nonInteractive: true });
      autoMerge.transition(TaskEvent.START_TASK);
      autoMerge.setPlan('# Test Plan', '/test/plan.md');
      autoMerge.transition(TaskEvent.PLAN_CREATED);
      autoMerge.transition(TaskEvent.CURMUDGEON_APPROVED);
      autoMerge.transition(TaskEvent.EXECUTION_COMPLETE);
      autoMerge.transition(TaskEvent.SUPER_REVIEW_PASSED);

      autoMerge.transition(TaskEvent.AUTO_MERGE);
      expect(autoMerge.getCurrentState()).toBe(TaskState.TASK_COMPLETE);
    });

    it('handles manual merge', () => {
      stateMachine.transition(TaskEvent.MANUAL_MERGE);
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_COMPLETE);
    });
  });

  describe('Error Handling', () => {
    it('handles errors at any state', () => {
      const error = new Error('Unexpected error');
      stateMachine.transition(TaskEvent.ERROR_OCCURRED, error);

      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_ABANDONED);
      expect(stateMachine.getLastError()).toBe(error);
      expect(stateMachine.canContinue()).toBe(false);
    });

    it('preserves error information', () => {
      const error = new Error('Test error');
      stateMachine.transition(TaskEvent.ERROR_OCCURRED, error);

      const context = stateMachine.getContext();
      expect(context.lastError).toBe(error);
    });
  });

  describe('Retry Logic', () => {
    it('tracks retry state', () => {
      expect(stateMachine.isRetry()).toBe(false);

      // Simulate retry flow
      const nonInteractive = new TaskStateMachine(taskId, humanTask, cwd, { nonInteractive: true });
      nonInteractive.transition(TaskEvent.START_TASK);
      nonInteractive.setPlan('# Test Plan', '/test/plan.md');
      nonInteractive.transition(TaskEvent.PLAN_CREATED);
      nonInteractive.transition(TaskEvent.CURMUDGEON_APPROVED);
      nonInteractive.transition(TaskEvent.EXECUTION_COMPLETE);
      nonInteractive.setRetryFeedback('Fix issues');
      nonInteractive.transition(TaskEvent.HUMAN_RETRY);

      expect(nonInteractive.isRetry()).toBe(true);
    });

    it('clears retry feedback', () => {
      stateMachine.setRetryFeedback('Fix this');
      expect(stateMachine.getContext().retryFeedback).toBe('Fix this');

      stateMachine.clearRetryFeedback();
      expect(stateMachine.getContext().retryFeedback).toBeUndefined();
    });
  });

  describe('State Validation', () => {
    it('prevents invalid transitions', () => {
      // Try to go directly to execution without planning
      stateMachine.transition(TaskEvent.EXECUTION_COMPLETE);

      // Should not change state
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_INIT);
    });

    it('stops at terminal states', () => {
      stateMachine.transition(TaskEvent.ERROR_OCCURRED);
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_ABANDONED);
      expect(stateMachine.canContinue()).toBe(false);

      // Try to transition from terminal state
      stateMachine.transition(TaskEvent.START_TASK);

      // Should remain in terminal state
      expect(stateMachine.getCurrentState()).toBe(TaskState.TASK_ABANDONED);
    });
  });
});
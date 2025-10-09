import React, { useState, useEffect, useMemo } from 'react';
import { Text } from 'ink';
import { Spinner } from './Spinner.js';
import { TaskStateMachine, TaskState, ToolStatus } from '../../../task-state-machine.js';
import { State } from '../../../state-machine.js';

interface PlanningStatusLineProps {
  taskStateMachine: TaskStateMachine;
  currentState: TaskState;
  pendingRefinement: string | undefined;
  planMd: string | undefined;
  curmudgeonFeedback: string | undefined;
}

export const PlanningStatusLine: React.FC<PlanningStatusLineProps> = React.memo(({
  taskStateMachine,
  currentState,
  pendingRefinement,
  planMd,
  curmudgeonFeedback
}) => {
  // Isolated tool:status subscription - only updates toolStatus state
  const [toolStatus, setToolStatus] = useState<ToolStatus | null>(taskStateMachine.getToolStatus());

  useEffect(() => {
    const handleToolStatus = () => {
      const next = taskStateMachine.getToolStatus();

      setToolStatus(prev => {
        if (
          prev?.agent === next?.agent &&
          prev?.tool === next?.tool &&
          prev?.summary === next?.summary
        ) {
          return prev;          // no change → skip re-render
        }
        return next ?? null;    // set to new status (or null when cleared)
      });
    };

    taskStateMachine.on('tool:status', handleToolStatus);

    return () => {
      taskStateMachine.off('tool:status', handleToolStatus);
    };
  }, [taskStateMachine]);

  // Memoized status line computation - prevents IIFE re-execution on unrelated renders
  const statusLine = useMemo(() => {
    // Recompute derived values inside memoization
    const executionStateMachine = taskStateMachine.getExecutionStateMachine();
    const executionState = executionStateMachine?.getCurrentState();
    const toolStatusResolved = executionStateMachine?.getToolStatus() || toolStatus;

    // Recompute isQueryInProgress inside memoization
    const isQueryInProgress =
      (currentState === TaskState.TASK_REFINING && !pendingRefinement) ||
      (currentState === TaskState.TASK_PLANNING && !planMd) ||
      (currentState === TaskState.TASK_CURMUDGEONING && !curmudgeonFeedback);

    // Base status message without redundant agent names
    let baseStatus = '';
    if (currentState === TaskState.TASK_REFINING) {
      baseStatus = 'Refining task description...';
    } else if (currentState === TaskState.TASK_PLANNING) {
      baseStatus = 'Creating strategic plan...';
    } else if (currentState === TaskState.TASK_CURMUDGEONING) {
      baseStatus = 'Reviewing plan complexity...';
    } else if (currentState === TaskState.TASK_SUPER_REVIEWING) {
      baseStatus = 'Performing final quality check...';
    } else if (currentState === TaskState.TASK_GARDENING) {
      baseStatus = 'Updating documentation...';
    } else if (currentState === TaskState.TASK_EXECUTING) {
      baseStatus = executionState === State.BEAN_COUNTING ? 'Determining work chunk...' :
                  executionState === State.PLANNING ? 'Proposing implementation...' :
                  executionState === State.PLAN_REVIEW ? 'Evaluating approach...' :
                  executionState === State.IMPLEMENTING ? 'Applying changes to codebase...' :
                  executionState === State.CODE_REVIEW ? 'Validating implementation...' :
                  'Executing task...';
    }

    // Merge tool status into message when active
    const statusMessage = toolStatusResolved ?
      `${baseStatus} → ${toolStatusResolved.tool}: ${toolStatusResolved.summary}` :
      baseStatus;

    // Only show spinner when there's actual activity
    const showSpinner = !!(toolStatusResolved || isQueryInProgress);

    if (process.env.DEBUG) {
      console.log('[PlanningStatusLine] Status line recomputed:', {
        toolStatus: toolStatusResolved?.tool,
        currentState,
        executionState,
        isQueryInProgress
      });
    }

    return { statusMessage, showSpinner, toolStatus: toolStatusResolved };
  }, [toolStatus, currentState, taskStateMachine, pendingRefinement, planMd, curmudgeonFeedback]);

  return (
    <Text color={statusLine.toolStatus ? "cyan" : undefined} dimColor={!statusLine.toolStatus}>
      {statusLine.showSpinner && <Spinner isActive={true} />}
      {statusLine.showSpinner && " "}
      {statusLine.statusMessage}
    </Text>
  );
});

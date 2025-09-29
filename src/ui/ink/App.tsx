import React from 'react';
import { Text, Box } from 'ink';
import { TaskStateMachine, TaskState } from '../../task-state-machine.js';
import { PlanningLayout } from './components/PlanningLayout.js';
import type { PlanFeedback } from '../planning-interface.js';

// TypeScript interface for component props
interface AppProps {
  taskStateMachine: TaskStateMachine;
  currentState: TaskState;
  onPlanFeedback?: (feedback: PlanFeedback) => void;
}

// Helper function to convert TaskState enum to human-readable format
const getPhaseDisplayName = (state: TaskState): string => {
  switch (state) {
    case TaskState.TASK_INIT:
      return 'Initializing';
    case TaskState.TASK_REFINING:
      return 'Refining Task';
    case TaskState.TASK_PLANNING:
      return 'Planning';
    case TaskState.TASK_CURMUDGEONING:
      return 'Reviewing Plan';
    case TaskState.TASK_EXECUTING:
      return 'Executing';
    case TaskState.TASK_SUPER_REVIEWING:
      return 'Final Review';
    case TaskState.TASK_FINALIZING:
      return 'Finalizing';
    case TaskState.TASK_COMPLETE:
      return 'Complete';
    case TaskState.TASK_ABANDONED:
      return 'Abandoned';
    default:
      return 'Unknown';
  }
};

// Helper function to get phase status color
const getPhaseColor = (state: TaskState): string => {
  switch (state) {
    case TaskState.TASK_INIT:
    case TaskState.TASK_REFINING:
    case TaskState.TASK_PLANNING:
    case TaskState.TASK_CURMUDGEONING:
      return 'blue';
    case TaskState.TASK_EXECUTING:
    case TaskState.TASK_SUPER_REVIEWING:
    case TaskState.TASK_FINALIZING:
      return 'yellow';
    case TaskState.TASK_COMPLETE:
      return 'green';
    case TaskState.TASK_ABANDONED:
      return 'red';
    default:
      return 'gray';
  }
};

// Main App component
export const App: React.FC<AppProps> = ({ taskStateMachine, currentState, onPlanFeedback }) => {
  // Use provided currentState instead of detecting internally
  const getPhaseInfo = (): { state: TaskState; displayName: string; color: string } => {
    return {
      state: currentState,
      displayName: getPhaseDisplayName(currentState),
      color: getPhaseColor(currentState)
    };
  };

  // Get basic task information with error handling
  const getTaskInfo = (): { taskId: string; description: string; status: string } => {
    try {
      if (!taskStateMachine) {
        return {
          taskId: 'unknown',
          description: 'Task information unavailable',
          status: 'Error: No task machine'
        };
      }

      const context = taskStateMachine.getContext();
      const status = taskStateMachine.getStatus();

      return {
        taskId: context.taskId || 'unknown',
        description: context.taskToUse || context.humanTask || 'No description available',
        status: status
      };
    } catch (error) {
      return {
        taskId: 'unknown',
        description: 'Error accessing task information',
        status: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  };

  const phase = getPhaseInfo();
  const taskInfo = getTaskInfo();

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header Section */}
      <Box marginBottom={1}>
        <Text bold>🤖 Agneto Task Monitor</Text>
      </Box>

      {/* Current Phase Display */}
      <Box marginBottom={1}>
        <Text>Current Phase: </Text>
        <Text color={phase.color} bold>
          {phase.displayName}
        </Text>
      </Box>

      {/* Task Information Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text dimColor>Task ID: </Text>
          <Text>{taskInfo.taskId}</Text>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>Description: </Text>
          <Text>{taskInfo.description}</Text>
        </Box>
      </Box>

      {/* Status Section - Ready for future phase-based content */}
      <Box borderStyle="round" borderColor="gray" padding={1}>
        <Box flexDirection="column">
          <Text dimColor>Status:</Text>
          <Text>{taskInfo.status}</Text>

          {/* Phase-specific content */}
          <Box marginTop={1}>
            {(phase.state === TaskState.TASK_REFINING ||
              phase.state === TaskState.TASK_PLANNING ||
              phase.state === TaskState.TASK_CURMUDGEONING) ? (
              <PlanningLayout
                currentState={phase.state}
                taskStateMachine={taskStateMachine}
                onPlanFeedback={onPlanFeedback}
              />
            ) : (
              <Text dimColor italic>
                Phase-specific content will be displayed here...
              </Text>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default App;
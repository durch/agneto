import React from 'react';
import { Text, Box } from 'ink';
import { TaskStateMachine, TaskState } from '../../../task-state-machine.js';

// TypeScript interface for PlanningLayout props
interface PlanningLayoutProps {
  currentState: TaskState;
  taskStateMachine: TaskStateMachine;
}

// Planning Layout Component - handles TASK_PLANNING, TASK_REFINING, TASK_CURMUDGEONING
export const PlanningLayout: React.FC<PlanningLayoutProps> = ({
  currentState,
  taskStateMachine
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={1}>
      <Box marginBottom={1}>
        <Text color="blue" bold>📋 Planning Phase</Text>
      </Box>

      <Box flexDirection="column">
        <Text dimColor>Current Stage: </Text>
        <Text>{currentState === TaskState.TASK_REFINING && 'Refining task description...'}
             {currentState === TaskState.TASK_PLANNING && 'Creating strategic plan...'}
             {currentState === TaskState.TASK_CURMUDGEONING && 'Reviewing plan complexity...'}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor italic>
          Planning-specific components will be rendered here...
        </Text>
      </Box>
    </Box>
  );
};

export default PlanningLayout;
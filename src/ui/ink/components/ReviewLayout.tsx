import React from 'react';
import { Text, Box } from 'ink';
import { TaskStateMachine, TaskState } from '../../../task-state-machine.js';

// TypeScript interface for ReviewLayout props
interface ReviewLayoutProps {
  currentState: TaskState;
  taskStateMachine: TaskStateMachine;
}

// Review Layout Component - handles TASK_SUPER_REVIEWING
export const ReviewLayout: React.FC<ReviewLayoutProps> = ({
  currentState,
  taskStateMachine
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1}>
      <Box marginBottom={1}>
        <Text color="magenta" bold>🔍 Review Phase</Text>
      </Box>

      <Box flexDirection="column">
        <Text dimColor>Current Stage: </Text>
        <Text>{currentState === TaskState.TASK_SUPER_REVIEWING && 'Final quality review in progress...'}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor italic>
          Review-specific components will be rendered here...
        </Text>
      </Box>
    </Box>
  );
};

export default ReviewLayout;
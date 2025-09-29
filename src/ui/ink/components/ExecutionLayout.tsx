import React from 'react';
import { Text, Box } from 'ink';
import { TaskStateMachine } from '../../../task-state-machine.js';

// TypeScript interface for ExecutionLayout props
interface ExecutionLayoutProps {
  taskStateMachine: TaskStateMachine;
}

// Execution Layout Component - handles TASK_EXECUTING
export const ExecutionLayout: React.FC<ExecutionLayoutProps> = ({ taskStateMachine }) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Box marginBottom={1}>
        <Text color="yellow" bold>⚡ Execution Phase</Text>
      </Box>

      <Box flexDirection="column">
        <Text dimColor>Status: </Text>
        <Text>Bean Counter coordinating implementation chunks...</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor italic>
          Execution-specific components will be rendered here...
        </Text>
      </Box>
    </Box>
  );
};

export default ExecutionLayout;
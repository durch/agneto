import React from 'react';
import { Text, Box } from 'ink';
import { TaskStateMachine, TaskState } from '../../../task-state-machine.js';
import { CommandBus } from '../../../ui/command-bus.js';
import { PlanningLayout } from './PlanningLayout.js';
import { ExecutionLayout } from './ExecutionLayout.js';
import { ReviewLayout } from './ReviewLayout.js';

// TypeScript interface for component props
interface PhaseLayoutProps {
  taskStateMachine: TaskStateMachine;
  commandBus: CommandBus;  // Required - event-driven architecture
}

// Phase group enumeration for clear categorization
enum PhaseGroup {
  PLANNING = 'PLANNING',
  EXECUTION = 'EXECUTION',
  REVIEW = 'REVIEW',
  TERMINAL = 'TERMINAL',
  INIT = 'INIT'
}

// Core phase detection logic - categorizes TaskState values into phase groups
const getPhaseGroup = (state: TaskState): PhaseGroup => {
  switch (state) {
    // Planning Layout: Pre-execution phases
    case TaskState.TASK_PLANNING:
    case TaskState.TASK_REFINING:
    case TaskState.TASK_CURMUDGEONING:
      return PhaseGroup.PLANNING;

    // Execution Layout: Active implementation phase
    case TaskState.TASK_EXECUTING:
      return PhaseGroup.EXECUTION;

    // Review Layout: Post-execution phases
    case TaskState.TASK_SUPER_REVIEWING:
    case TaskState.TASK_GARDENING:
      return PhaseGroup.REVIEW;

    // Terminal states
    case TaskState.TASK_COMPLETE:
    case TaskState.TASK_ABANDONED:
      return PhaseGroup.TERMINAL;

    // Initial state
    case TaskState.TASK_INIT:
      return PhaseGroup.INIT;

    default:
      // Fallback for any unknown states
      return PhaseGroup.INIT;
  }
};




// Terminal Layout Component - handles TASK_COMPLETE, TASK_ABANDONED
const TerminalLayout: React.FC<{ currentState: TaskState; taskStateMachine: TaskStateMachine }> = ({
  currentState,
  taskStateMachine
}) => {
  const isComplete = currentState === TaskState.TASK_COMPLETE;
  const color = isComplete ? 'green' : 'red';
  const icon = isComplete ? '✅' : '❌';
  const title = isComplete ? 'Task Complete' : 'Task Abandoned';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} padding={1}>
      <Box marginBottom={1}>
        <Text color={color} bold>{icon} {title}</Text>
      </Box>

      <Box flexDirection="column">
        <Text dimColor>Final Status: </Text>
        <Text>{isComplete ? 'Task completed successfully!' : 'Task was abandoned or failed.'}</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor italic>
          Terminal state - no further actions available.
        </Text>
      </Box>
    </Box>
  );
};

// Initialization Layout Component - handles TASK_INIT and unknown states
const InitLayout: React.FC<{ currentState: TaskState; taskStateMachine: TaskStateMachine }> = ({
  currentState,
  taskStateMachine
}) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      <Box marginBottom={1}>
        <Text color="gray" bold>🔄 Initializing</Text>
      </Box>

      <Box flexDirection="column">
        <Text dimColor>Status: </Text>
        <Text>Task system starting up...</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor italic>
          Preparing task execution environment...
        </Text>
      </Box>
    </Box>
  );
};

// Main PhaseLayout component with conditional rendering logic
export const PhaseLayout: React.FC<PhaseLayoutProps> = ({ taskStateMachine, commandBus }) => {
  // Phase detection with error handling
  const getCurrentPhaseData = (): { state: TaskState; group: PhaseGroup } => {
    try {
      if (!taskStateMachine) {
        throw new Error('TaskStateMachine is not available');
      }

      const currentState = taskStateMachine.getCurrentState();
      const phaseGroup = getPhaseGroup(currentState);

      return {
        state: currentState,
        group: phaseGroup
      };
    } catch (error) {
      // Fallback to safe defaults on error
      return {
        state: TaskState.TASK_INIT,
        group: PhaseGroup.INIT
      };
    }
  };

  const { state: currentState, group: phaseGroup } = getCurrentPhaseData();

  // Conditional rendering based on phase group
  const renderPhaseContent = (): React.ReactElement => {
    switch (phaseGroup) {
      case PhaseGroup.PLANNING:
        return <PlanningLayout
          currentState={currentState}
          taskStateMachine={taskStateMachine}
          commandBus={commandBus}
          terminalHeight={40}
          terminalWidth={120}
          availableContentHeight={30}
        />;

      case PhaseGroup.EXECUTION:
        return <ExecutionLayout taskStateMachine={taskStateMachine} commandBus={commandBus} />;

      case PhaseGroup.REVIEW:
        return <ReviewLayout currentState={currentState} taskStateMachine={taskStateMachine} />;

      case PhaseGroup.TERMINAL:
        return <TerminalLayout currentState={currentState} taskStateMachine={taskStateMachine} />;

      case PhaseGroup.INIT:
      default:
        return <InitLayout currentState={currentState} taskStateMachine={taskStateMachine} />;
    }
  };

  return (
    <Box flexDirection="column">
      {renderPhaseContent()}
    </Box>
  );
};

export default PhaseLayout;
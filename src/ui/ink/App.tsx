import React, { useState } from 'react';
import { Text, Box, useStdout, useInput } from 'ink';
import { TaskStateMachine, TaskState } from '../../task-state-machine.js';
import { PlanningLayout } from './components/PlanningLayout.js';
import { ExecutionLayout } from './components/ExecutionLayout.js';
import { FullscreenModal } from './components/FullscreenModal.js';
import type { PlanFeedback } from '../planning-interface.js';
import type { RefinementFeedback } from '../refinement-interface.js';

// TypeScript interface for component props
interface AppProps {
  taskStateMachine: TaskStateMachine;
  onPlanFeedback?: (feedback: PlanFeedback) => void;
  onRefinementFeedback?: (feedback: Promise<RefinementFeedback>, rerenderCallback?: () => void) => void;
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
export const App: React.FC<AppProps> = ({ taskStateMachine, onPlanFeedback, onRefinementFeedback }) => {
  // Get terminal dimensions for responsive layout
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows || 40; // Default to 40 if unavailable
  const terminalWidth = stdout?.columns || 120; // Default to 120 if unavailable

  // Global modal state for plan viewer
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // Modal state for execution phase agent outputs
  const [viewMode, setViewMode] = useState<'split' | 'fullscreen'>('split');
  const [fullscreenContent, setFullscreenContent] = useState<{title: string, text: string} | null>(null);

  // Global keyboard handler for plan modal and execution phase modals
  useInput((input, key) => {
    // If in fullscreen mode, only allow Esc to close
    if (viewMode === 'fullscreen') {
      if (key.escape) {
        setViewMode('split');
        setFullscreenContent(null);
      }
      return;
    }

    // Handle 'p' or 'P' to toggle plan modal
    if (input === 'p' || input === 'P') {
      const planMd = taskStateMachine.getPlanMd();
      if (planMd) {
        setIsPlanModalOpen(true);
      }
      // Silently ignore if no plan exists yet
      return;
    }

    // Handle execution phase keyboard shortcuts (C/R for Coder/Reviewer)
    const currentState = taskStateMachine.getCurrentState();
    if (currentState === TaskState.TASK_EXECUTING) {
      const executionStateMachine = taskStateMachine.getExecutionStateMachine();

      if (input === 'c' || input === 'C') {
        const coderOutput = executionStateMachine?.getAgentOutput('coder');
        if (coderOutput) {
          setFullscreenContent({
            title: '🤖 Coder Implementation',
            text: coderOutput
          });
          setViewMode('fullscreen');
        }
        return;
      }

      if (input === 'r' || input === 'R') {
        const reviewerOutput = executionStateMachine?.getAgentOutput('reviewer');
        if (reviewerOutput) {
          setFullscreenContent({
            title: '👀 Reviewer Feedback',
            text: reviewerOutput
          });
          setViewMode('fullscreen');
        }
        return;
      }
    }
  });

  // Read current state dynamically from taskStateMachine
  const getPhaseInfo = (): { state: TaskState; displayName: string; color: string } => {
    const currentState = taskStateMachine.getCurrentState();
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

  // Calculate available height for content
  // Header: 4 rows, Footer: 3 rows, Status border/padding: 4 rows, margins: 2 rows
  const headerHeight = 4;
  const footerHeight = 3;
  const statusOverhead = 4;
  const margins = 2;
  const availableContentHeight = Math.max(10, terminalHeight - headerHeight - footerHeight - statusOverhead - margins);

  // Render plan modal if open
  if (isPlanModalOpen) {
    const planMd = taskStateMachine.getPlanMd();
    const planPath = taskStateMachine.getPlanPath();

    return (
      <FullscreenModal
        title="📋 Strategic Plan"
        content={planMd || 'No plan available'}
        terminalHeight={terminalHeight}
        terminalWidth={terminalWidth}
        onClose={() => setIsPlanModalOpen(false)}
      />
    );
  }

  // Render execution phase modal if in fullscreen mode
  if (viewMode === 'fullscreen' && fullscreenContent) {
    return (
      <FullscreenModal
        title={fullscreenContent.title}
        content={fullscreenContent.text}
        terminalHeight={terminalHeight}
        terminalWidth={terminalWidth}
        onClose={() => {
          setViewMode('split');
          setFullscreenContent(null);
        }}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1} minHeight={terminalHeight}>
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
                onRefinementFeedback={onRefinementFeedback}
                terminalHeight={terminalHeight}
                terminalWidth={terminalWidth}
                availableContentHeight={availableContentHeight}
              />
            ) : phase.state === TaskState.TASK_EXECUTING ? (
              <ExecutionLayout taskStateMachine={taskStateMachine} />
            ) : (
              <Text dimColor italic>
                Phase-specific content will be displayed here...
              </Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Keyboard Shortcuts Footer */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          [P]lan View
          {(phase.state === TaskState.TASK_REFINING ||
            phase.state === TaskState.TASK_PLANNING ||
            phase.state === TaskState.TASK_CURMUDGEONING ||
            phase.state === TaskState.TASK_EXECUTING) && (
            <>  [←/→] Navigate  [Tab] Cycle  [Enter] Expand  [Esc] Close</>
          )}
          {(phase.state === TaskState.TASK_REFINING ||
            phase.state === TaskState.TASK_PLANNING ||
            phase.state === TaskState.TASK_CURMUDGEONING) && (
            <>  [A]pprove  [R]eject</>
          )}
          {phase.state === TaskState.TASK_EXECUTING && (
            <>  [C]oder Output  [R]eviewer Feedback</>
          )}
        </Text>
      </Box>
    </Box>
  );
};

export default App;
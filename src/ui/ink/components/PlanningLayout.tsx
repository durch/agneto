import React, { useState } from 'react';
import { Text, Box, useStdout, useInput } from 'ink';
import { TaskStateMachine, TaskState } from '../../../task-state-machine.js';
import { getPlanFeedback, type PlanFeedback } from '../../planning-interface.js';

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
  const { stdout } = useStdout();

  // Local state for interactive feedback
  const [isProcessingFeedback, setIsProcessingFeedback] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Handle keyboard input for approve/reject actions
  useInput((input, key) => {
    // Only handle input during planning states when we can show interactive options
    if (currentState !== TaskState.TASK_PLANNING || isProcessingFeedback) {
      return;
    }

    if (input === 'a' || input === 'A') {
      handleApprove();
    } else if (input === 'r' || input === 'R') {
      handleReject();
    }
  });

  // Handle approve action
  const handleApprove = async () => {
    setIsProcessingFeedback(true);
    setLastAction('Approved');

    try {
      const feedback: PlanFeedback = { type: 'approve' };
      // In a real implementation, this would be passed back to the orchestrator
      // For now, we'll just track the action locally
    } catch (error) {
      setLastAction('Error processing approval');
    } finally {
      setIsProcessingFeedback(false);
    }
  };

  // Handle reject action
  const handleReject = async () => {
    setIsProcessingFeedback(true);
    setLastAction('Rejected - feedback requested');

    try {
      // This would trigger the getPlanFeedback flow for rejection details
      const feedback = await getPlanFeedback();
      setLastAction(`Feedback: ${feedback.type}`);
    } catch (error) {
      setLastAction('Error processing rejection');
    } finally {
      setIsProcessingFeedback(false);
    }
  };

  // Calculate responsive layout based on terminal width
  const terminalWidth = stdout?.columns || 80;
  const isWideTerminal = terminalWidth > 120;
  const panelWidth = Math.floor(terminalWidth * 0.4);

  // Get data from TaskStateMachine
  const context = taskStateMachine.getContext();
  const taskToUse = context.taskToUse || context.humanTask;
  const planMd = taskStateMachine.getPlanMd();
  const planPath = taskStateMachine.getPlanPath();

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={1}>
      <Box marginBottom={1}>
        <Text color="blue" bold>📋 Planning Phase</Text>
      </Box>

      {/* Top row: Refined Task and Plan Content panels */}
      <Box
        flexDirection={isWideTerminal ? "row" : "column"}
        marginBottom={1}
      >
        {/* Left Panel: Refined Task */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="cyan"
          padding={1}
          width={isWideTerminal ? panelWidth : undefined}
          marginRight={isWideTerminal ? 1 : 0}
          marginBottom={isWideTerminal ? 0 : 1}
        >
          <Text color="cyan" bold>📝 Refined Task</Text>
          <Box marginTop={1}>
            {currentState === TaskState.TASK_REFINING ? (
              <Text dimColor>Refining task description...</Text>
            ) : taskToUse ? (
              <Text wrap="wrap">{taskToUse}</Text>
            ) : (
              <Text dimColor>No task description available</Text>
            )}
          </Box>
        </Box>

        {/* Middle Panel: Plan Content */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="green"
          padding={1}
          width={isWideTerminal ? panelWidth : undefined}
          marginBottom={isWideTerminal ? 0 : 1}
        >
          <Text color="green" bold>📋 Plan Content</Text>
          <Box marginTop={1}>
            {currentState === TaskState.TASK_REFINING ? (
              <Text dimColor>Waiting for task refinement...</Text>
            ) : currentState === TaskState.TASK_PLANNING ? (
              <Text dimColor>Creating strategic plan...</Text>
            ) : planMd ? (
              <Box flexDirection="column">
                <Text wrap="wrap">{planMd.substring(0, 200)}...</Text>
                {planPath && (
                  <Text dimColor color="gray">Saved to: {planPath}</Text>
                )}
              </Box>
            ) : (
              <Text dimColor>Plan created, under review...</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Bottom Panel: Live Activity (full width) */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="yellow"
        padding={1}
      >
        <Text color="yellow" bold>⚡ Live Activity</Text>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>
            Current Stage: {' '}
            {currentState === TaskState.TASK_REFINING && 'Refining task description...'}
            {currentState === TaskState.TASK_PLANNING && 'Creating strategic plan...'}
            {currentState === TaskState.TASK_CURMUDGEONING && 'Reviewing plan complexity...'}
          </Text>

          {/* Interactive Instructions - Only show during planning state */}
          {currentState === TaskState.TASK_PLANNING && planMd && (
            <Box marginTop={1} flexDirection="column">
              <Text color="green" bold>🎯 Plan Ready for Review</Text>
              <Box marginTop={1}>
                <Text>
                  Press <Text color="green" bold>[A]</Text> to approve and start coding
                </Text>
                <Text>
                  Press <Text color="red" bold>[R]</Text> to reject and provide feedback
                </Text>
              </Box>

              {/* Show feedback processing state */}
              {isProcessingFeedback && (
                <Box marginTop={1}>
                  <Text color="blue">⏳ Processing your feedback...</Text>
                </Box>
              )}

              {/* Show last action taken */}
              {lastAction && !isProcessingFeedback && (
                <Box marginTop={1}>
                  <Text color="cyan">✓ {lastAction}</Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default PlanningLayout;
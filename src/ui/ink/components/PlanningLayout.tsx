import React, { useState } from 'react';
import { Text, Box, useStdout, useInput } from 'ink';
import { TaskStateMachine, TaskState } from '../../../task-state-machine.js';
import { State } from '../../../state-machine.js';
import { getPlanFeedback, type PlanFeedback } from '../../planning-interface.js';
import type { RefinementFeedback } from '../../refinement-interface.js';
import { FullscreenModal } from './FullscreenModal.js';

// TypeScript interface for PlanningLayout props
interface PlanningLayoutProps {
  currentState: TaskState;
  taskStateMachine: TaskStateMachine;
  onPlanFeedback?: (feedback: PlanFeedback) => void;
  onRefinementFeedback?: (feedback: Promise<RefinementFeedback>, rerenderCallback?: () => void) => void;
  terminalHeight: number;
  terminalWidth: number;
  availableContentHeight: number;
}

// Helper function to truncate content
function truncateContent(content: string, maxLines: number): { display: string; isTruncated: boolean } {
  if (!content) return { display: '', isTruncated: false };

  const lines = content.split('\n');
  if (lines.length <= maxLines) {
    return { display: content, isTruncated: false };
  }

  const visibleLines = lines.slice(0, maxLines - 1);
  return {
    display: visibleLines.join('\n') + '\n... [Press Enter to view all]',
    isTruncated: true
  };
}

// Planning Layout Component - handles TASK_PLANNING, TASK_REFINING, TASK_CURMUDGEONING
export const PlanningLayout: React.FC<PlanningLayoutProps> = ({
  currentState,
  taskStateMachine,
  onPlanFeedback,
  onRefinementFeedback,
  terminalHeight,
  terminalWidth,
  availableContentHeight
}) => {
  const { stdout } = useStdout();

  // Local state for interactive feedback
  const [isProcessingFeedback, setIsProcessingFeedback] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [refinementResolver, setRefinementResolver] = useState<((value: RefinementFeedback) => void) | null>(null);

  // Track previous curmudgeon feedback to enable swap pattern when replanning
  const [previousCurmudgeonFeedback, setPreviousCurmudgeonFeedback] = useState<string | null>(null);

  // Pane navigation state
  const [focusedPane, setFocusedPane] = useState<'left' | 'right'>('left');

  // Modal state for fullscreen view
  const [viewMode, setViewMode] = useState<'split' | 'fullscreen'>('split');
  const [fullscreenContent, setFullscreenContent] = useState<{title: string, text: string} | null>(null);

  // Animation state for live activity indicator
  const [activityIndicatorIndex, setActivityIndicatorIndex] = useState(0);
  const activityChars = ['⋯', '•••', '⋯'];

  // Animate the activity indicator
  React.useEffect(() => {
    const interval = setInterval(() => {
      setActivityIndicatorIndex((prev) => (prev + 1) % activityChars.length);
    }, 500); // Rotate every 500ms

    return () => clearInterval(interval);
  }, [activityChars.length]);

  // Store curmudgeon feedback when it becomes available
  React.useEffect(() => {
    const curmudgeonFeedback = taskStateMachine.getCurmudgeonFeedback();
    if (curmudgeonFeedback && currentState === TaskState.TASK_PLANNING) {
      // Coming back to planning from curmudgeon - store the feedback for display
      setPreviousCurmudgeonFeedback(curmudgeonFeedback);
    }
  }, [currentState, taskStateMachine]);

  // Wire up refinement feedback when callback is provided
  React.useEffect(() => {
    if (onRefinementFeedback && currentState === TaskState.TASK_REFINING && taskStateMachine.getPendingRefinement()) {
      // Create a dummy promise to get the resolver attached by orchestrator
      const dummyPromise = new Promise<RefinementFeedback>((resolve) => {
        // This resolve will be replaced by the orchestrator
      });

      // Call the callback which will attach the real resolver
      onRefinementFeedback(dummyPromise);

      // Extract the resolver that was attached by orchestrator
      const resolver = (dummyPromise as any).resolve;
      if (resolver) {
        setRefinementResolver(() => resolver);
      }
    }
  }, [onRefinementFeedback, currentState]);

  // Handle keyboard input for navigation, modal, and approve/reject actions
  useInput((input, key) => {
    // If in fullscreen mode, only allow Esc to close
    if (viewMode === 'fullscreen') {
      if (key.escape) {
        setViewMode('split');
        setFullscreenContent(null);
      }
      return;
    }

    if (isProcessingFeedback) return;

    // Pane navigation with arrow keys
    if (key.leftArrow) {
      setFocusedPane('left');
      return;
    }
    if (key.rightArrow) {
      setFocusedPane('right');
      return;
    }

    // Tab to cycle focus
    if (key.tab) {
      setFocusedPane(prev => prev === 'left' ? 'right' : 'left');
      return;
    }

    // Enter to open focused pane in fullscreen
    if (key.return) {
      handleOpenFullscreen();
      return;
    }

    // Handle refinement approval during TASK_REFINING state
    if (currentState === TaskState.TASK_REFINING && refinementResolver && taskStateMachine.getPendingRefinement()) {
      if (input === 'a' || input === 'A') {
        handleRefinementApprove();
      } else if (input === 'r' || input === 'R') {
        handleRefinementReject();
      }
      return;
    }

    // Handle plan approval during TASK_PLANNING state
    if (currentState === TaskState.TASK_PLANNING) {
      if (input === 'a' || input === 'A') {
        handleApprove();
      } else if (input === 'r' || input === 'R') {
        handleReject();
      }
    }
  });

  // Handle approve action
  const handleApprove = async () => {
    setIsProcessingFeedback(true);
    setLastAction('Approved');

    try {
      const feedback: PlanFeedback = { type: 'approve' };
      onPlanFeedback?.(feedback);
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
      const feedback: PlanFeedback = { type: 'wrong-approach' };
      onPlanFeedback?.(feedback);
      setLastAction('Rejection feedback sent');
    } catch (error) {
      setLastAction('Error processing rejection');
    } finally {
      setIsProcessingFeedback(false);
    }
  };

  // Handle refinement approve action
  const handleRefinementApprove = async () => {
    if (!refinementResolver) return;

    setIsProcessingFeedback(true);
    setLastAction('Approved refinement');

    try {
      const feedback: RefinementFeedback = { type: 'approve' };
      refinementResolver(feedback);
      setRefinementResolver(null);
    } catch (error) {
      setLastAction('Error processing refinement approval');
    } finally {
      setIsProcessingFeedback(false);
    }
  };

  // Handle refinement reject action
  const handleRefinementReject = async () => {
    if (!refinementResolver) return;

    setIsProcessingFeedback(true);
    setLastAction('Rejected refinement');

    try {
      const feedback: RefinementFeedback = { type: 'reject', details: 'User rejected via UI' };
      refinementResolver(feedback);
      setRefinementResolver(null);
    } catch (error) {
      setLastAction('Error processing refinement rejection');
    } finally {
      setIsProcessingFeedback(false);
    }
  };

  // Handle opening fullscreen modal for focused pane
  const handleOpenFullscreen = () => {
    // Get content based on focused pane and current state
    const context = taskStateMachine.getContext();
    const planMd = taskStateMachine.getPlanMd();
    const curmudgeonFeedback = taskStateMachine.getCurmudgeonFeedback();
    const pendingRefinement = taskStateMachine.getPendingRefinement();
    const taskToUse = context.taskToUse || context.humanTask;

    let title = '';
    let content = '';

    if (focusedPane === 'left') {
      // Left pane logic
      if (currentState === TaskState.TASK_EXECUTING) {
        title = '🧮 Bean Counter Chunk';
        content = beanCounterOutput || 'Determining work chunk...';
      } else if (currentState === TaskState.TASK_CURMUDGEONING) {
        title = '📋 Current Plan';
        content = planMd || 'No plan available';
      } else if (currentState === TaskState.TASK_PLANNING && previousCurmudgeonFeedback) {
        title = '🧐 Previous Feedback';
        content = previousCurmudgeonFeedback;
      } else if (currentState === TaskState.TASK_REFINING && pendingRefinement) {
        title = '📝 Refined Task';
        content = pendingRefinement.raw || pendingRefinement.goal;
      } else {
        title = '📝 Task Description';
        content = taskToUse || 'No task description';
      }
    } else {
      // Right pane logic
      if (currentState === TaskState.TASK_EXECUTING) {
        title = reviewerOutput ? '👀 Reviewer Feedback' : '🤖 Coder Proposal';
        content = reviewerOutput || coderOutput || 'Processing...';
      } else if (currentState === TaskState.TASK_CURMUDGEONING) {
        title = '🧐 Curmudgeon Feedback';
        content = curmudgeonFeedback || 'Reviewing plan for over-engineering...';
      } else if (currentState === TaskState.TASK_PLANNING && previousCurmudgeonFeedback) {
        title = '📋 New Plan';
        content = planMd || 'Creating simplified plan...';
      } else {
        title = '📋 Plan Content';
        content = planMd || 'Creating strategic plan...';
      }
    }

    if (content) {
      setFullscreenContent({ title, text: content });
      setViewMode('fullscreen');
    }
  };

  // Calculate responsive layout based on terminal width
  const isWideTerminal = terminalWidth > 120;
  const panelWidth = Math.floor(terminalWidth * 0.48);

  // Get data from TaskStateMachine
  const context = taskStateMachine.getContext();
  const taskToUse = context.taskToUse || context.humanTask;
  const pendingRefinement = taskStateMachine.getPendingRefinement();
  const planMd = taskStateMachine.getPlanMd();
  const planPath = taskStateMachine.getPlanPath();
  const curmudgeonFeedback = taskStateMachine.getCurmudgeonFeedback();
  const simplificationCount = taskStateMachine.getSimplificationCount();

  // Get execution state machine data if in TASK_EXECUTING
  const executionStateMachine = taskStateMachine.getExecutionStateMachine();
  const executionState = executionStateMachine?.getCurrentState();
  const beanCounterOutput = executionStateMachine?.getAgentOutput('bean');
  const coderOutput = executionStateMachine?.getAgentOutput('coder');
  const reviewerOutput = executionStateMachine?.getAgentOutput('reviewer');

  // Calculate content height for each pane in split view
  const paneContentHeight = Math.floor(availableContentHeight / 2) - 4; // Divide by 2 for two rows, subtract for borders/padding

  // If in fullscreen mode, render the modal
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

  // Determine phase title and color
  const isExecuting = currentState === TaskState.TASK_EXECUTING;
  const phaseTitle = isExecuting ? '⚡ Execution Phase' : '📋 Planning Phase';
  const phaseColor = isExecuting ? 'yellow' : 'blue';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={phaseColor} padding={1} flexGrow={1}>
      <Box marginBottom={1}>
        <Text color={phaseColor} bold>{phaseTitle}</Text>
      </Box>

      {/* Top row: Refined Task and Plan Content panels */}
      <Box
        flexDirection={isWideTerminal ? "row" : "column"}
        marginBottom={1}
      >
        {/* Left Panel: Dynamic content - Refined Task, Plan (during curmudgeon), or Old Feedback (during replanning) */}
        <Box
          flexDirection="column"
          borderStyle={focusedPane === 'left' ? "double" : "single"}
          borderColor={
            focusedPane === 'left'
              ? "cyan"
              : (currentState === TaskState.TASK_CURMUDGEONING ? "green" : (currentState === TaskState.TASK_PLANNING && previousCurmudgeonFeedback ? "yellow" : "gray"))
          }
          padding={1}
          width={isWideTerminal ? panelWidth : undefined}
          marginRight={isWideTerminal ? 1 : 0}
          marginBottom={isWideTerminal ? 0 : 1}
        >
          {/* Dynamic header and content based on current state */}
          {currentState === TaskState.TASK_EXECUTING ? (
            // Execution: Always show Bean Counter chunk on left
            <>
              <Box justifyContent="space-between">
                <Text color="cyan" bold>🧮 Bean Counter Chunk</Text>
                {focusedPane === 'left' && <Text dimColor>[Enter ⤢]</Text>}
              </Box>
              <Box marginTop={1}>
                <Text wrap="wrap">
                  {truncateContent(
                    beanCounterOutput || 'Determining work chunk...',
                    paneContentHeight
                  ).display}
                </Text>
              </Box>
            </>
          ) : currentState === TaskState.TASK_CURMUDGEONING ? (
            <>
              <Box justifyContent="space-between">
                <Text color="green" bold>📋 Current Plan</Text>
                {focusedPane === 'left' && <Text dimColor>[Enter ⤢]</Text>}
              </Box>
              <Box marginTop={1}>
                {planMd ? (
                  <Box flexDirection="column">
                    <Text wrap="wrap">{truncateContent(planMd, paneContentHeight).display}</Text>
                    {planPath && (
                      <Text dimColor color="gray">Saved to: {planPath}</Text>
                    )}
                  </Box>
                ) : (
                  <Text dimColor>No plan available</Text>
                )}
              </Box>
            </>
          ) : currentState === TaskState.TASK_PLANNING && previousCurmudgeonFeedback ? (
            <>
              <Box justifyContent="space-between">
                <Text color="yellow" bold>🧐 Previous Feedback</Text>
                {focusedPane === 'left' && <Text dimColor>[Enter ⤢]</Text>}
              </Box>
              <Box marginTop={1}>
                <Text wrap="wrap">{truncateContent(previousCurmudgeonFeedback, paneContentHeight).display}</Text>
              </Box>
            </>
          ) : (
            <>
              <Box justifyContent="space-between">
                <Text color="cyan" bold>📝 Refined Task</Text>
                {focusedPane === 'left' && <Text dimColor>[Enter ⤢]</Text>}
              </Box>
              <Box marginTop={1}>
                {currentState === TaskState.TASK_REFINING && pendingRefinement ? (
                  <Box flexDirection="column">
                    <Text wrap="wrap">{truncateContent(pendingRefinement.raw || pendingRefinement.goal, paneContentHeight).display}</Text>
                    <Box marginTop={1}>
                      <Text color="yellow" bold>⏳ Awaiting Approval</Text>
                    </Box>
                  </Box>
                ) : currentState === TaskState.TASK_REFINING ? (
                  <Text dimColor>Refining task description...</Text>
                ) : taskToUse ? (
                  <Text wrap="wrap">{truncateContent(taskToUse, paneContentHeight).display}</Text>
                ) : (
                  <Text dimColor>No task description available</Text>
                )}
              </Box>
            </>
          )}
        </Box>

        {/* Middle Panel (Right Pane): Dynamic content based on state */}
        <Box
          flexDirection="column"
          borderStyle={focusedPane === 'right' ? "double" : "single"}
          borderColor={
            focusedPane === 'right'
              ? "cyan"
              : (currentState === TaskState.TASK_CURMUDGEONING ? "yellow" : "gray")
          }
          padding={1}
          width={isWideTerminal ? panelWidth : undefined}
          marginBottom={isWideTerminal ? 0 : 1}
        >
          {/* Dynamic header and content based on current state */}
          {currentState === TaskState.TASK_EXECUTING ? (
            // Execution: Show latest agent output (Reviewer or Coder) on right
            <>
              <Box justifyContent="space-between">
                <Text color="green" bold>
                  {reviewerOutput ? '👀 Reviewer Feedback' : '🤖 Coder Proposal'}
                </Text>
                {focusedPane === 'right' && <Text dimColor>[Enter ⤢]</Text>}
              </Box>
              <Box marginTop={1}>
                <Text wrap="wrap">
                  {truncateContent(
                    reviewerOutput || coderOutput || 'Processing...',
                    paneContentHeight
                  ).display}
                </Text>
              </Box>
            </>
          ) : currentState === TaskState.TASK_CURMUDGEONING ? (
            <>
              <Box justifyContent="space-between">
                <Text color="yellow" bold>🧐 Curmudgeon Feedback</Text>
                {focusedPane === 'right' && <Text dimColor>[Enter ⤢]</Text>}
              </Box>
              <Box marginTop={1}>
                {curmudgeonFeedback ? (
                  <Box flexDirection="column">
                    <Text wrap="wrap">{truncateContent(curmudgeonFeedback, paneContentHeight).display}</Text>
                    <Box marginTop={1}>
                      <Text dimColor>Simplification attempt {simplificationCount + 1}/2</Text>
                    </Box>
                  </Box>
                ) : (
                  <Text dimColor>Reviewing plan for over-engineering...</Text>
                )}
              </Box>
            </>
          ) : currentState === TaskState.TASK_PLANNING && previousCurmudgeonFeedback ? (
            <>
              <Box justifyContent="space-between">
                <Text color="green" bold>📋 New Plan</Text>
                {focusedPane === 'right' && <Text dimColor>[Enter ⤢]</Text>}
              </Box>
              <Box marginTop={1}>
                {planMd ? (
                  <Box flexDirection="column">
                    <Text wrap="wrap">{truncateContent(planMd, paneContentHeight).display}</Text>
                    {planPath && (
                      <Text dimColor color="gray">Saved to: {planPath}</Text>
                    )}
                  </Box>
                ) : (
                  <Text dimColor>Creating simplified plan...</Text>
                )}
              </Box>
            </>
          ) : (
            <>
              <Box justifyContent="space-between">
                <Text color="green" bold>📋 Plan Content</Text>
                {focusedPane === 'right' && <Text dimColor>[Enter ⤢]</Text>}
              </Box>
              <Box marginTop={1}>
                {currentState === TaskState.TASK_REFINING ? (
                  <Text dimColor>Waiting for task refinement...</Text>
                ) : currentState === TaskState.TASK_PLANNING && !planMd ? (
                  <Text dimColor>Creating strategic plan...</Text>
                ) : planMd ? (
                  <Box flexDirection="column">
                    <Text wrap="wrap">{truncateContent(planMd, paneContentHeight).display}</Text>
                    {planPath && (
                      <Text dimColor color="gray">Saved to: {planPath}</Text>
                    )}
                  </Box>
                ) : (
                  <Text dimColor>Plan created, under review...</Text>
                )}
              </Box>
            </>
          )}
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
          {/* Display live activity message from task state machine */}
          {(() => {
            const liveActivity = taskStateMachine.getLiveActivityMessage();
            if (liveActivity) {
              return (
                <Box marginBottom={1}>
                  <Text color="cyan">
                    {activityChars[activityIndicatorIndex]} {liveActivity.agent}: {liveActivity.message}
                  </Text>
                </Box>
              );
            }
            return null;
          })()}

          <Text dimColor>
            Current Stage: {' '}
            {currentState === TaskState.TASK_REFINING && 'Refining task description...'}
            {currentState === TaskState.TASK_PLANNING && 'Creating strategic plan...'}
            {currentState === TaskState.TASK_CURMUDGEONING && 'Reviewing plan complexity...'}
            {currentState === TaskState.TASK_EXECUTING && (
              executionState === State.BEAN_COUNTING ? 'Bean Counter determining work chunk...' :
              executionState === State.PLANNING ? 'Coder proposing implementation...' :
              executionState === State.PLAN_REVIEW ? 'Reviewer evaluating approach...' :
              executionState === State.IMPLEMENTING ? 'Applying changes to codebase...' :
              executionState === State.CODE_REVIEW ? 'Reviewer validating implementation...' :
              'Executing task...'
            )}
          </Text>

          {/* Interactive Instructions - Show for refinement or planning states */}
          {currentState === TaskState.TASK_REFINING && pendingRefinement && (
            <Box marginTop={1} flexDirection="column">
              <Text color="green" bold>🔍 Refined Task Ready for Review</Text>
              <Box marginTop={1}>
                <Text>
                  Press <Text color="green" bold>[A]</Text> to approve refined task
                </Text>
                <Text>
                  Press <Text color="red" bold>[R]</Text> to reject and use original
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
import React, { useState } from 'react';
import { Text, Box, useStdout } from 'ink';
import SelectInput from 'ink-select-input';
import { TaskStateMachine, TaskState } from '../../../task-state-machine.js';
import { State } from '../../../state-machine.js';
import { getPlanFeedback, type PlanFeedback } from '../../planning-interface.js';
import type { RefinementFeedback } from '../../refinement-interface.js';
import type { SuperReviewerDecision } from '../../../types.js';
import { FullscreenModal } from './FullscreenModal.js';
import { TextInputModal } from './TextInputModal.js';
import { MarkdownText } from './MarkdownText.js';
import { useSpinner } from '../hooks/useSpinner.js';

// TypeScript interface for PlanningLayout props
interface PlanningLayoutProps {
  currentState: TaskState;
  taskStateMachine: TaskStateMachine;
  onPlanFeedback?: (feedback: PlanFeedback) => void;
  onRefinementFeedback?: (feedback: Promise<RefinementFeedback>, rerenderCallback?: () => void) => void;
  onSuperReviewerDecision?: (decision: Promise<SuperReviewerDecision>) => void;
  terminalHeight: number;
  terminalWidth: number;
  availableContentHeight: number;
}

// Planning Layout Component - handles TASK_PLANNING, TASK_REFINING, TASK_CURMUDGEONING
export const PlanningLayout: React.FC<PlanningLayoutProps> = ({
  currentState,
  taskStateMachine,
  onPlanFeedback,
  onRefinementFeedback,
  onSuperReviewerDecision,
  terminalHeight,
  terminalWidth,
  availableContentHeight
}) => {
  const { stdout } = useStdout();

  // Modal state interface
  interface ModalState {
    isOpen: boolean;
    context: 'refinement' | 'plan' | 'superreviewer' | null;
    title: string;
    placeholder: string;
  }

  // Local state for interactive feedback
  const [isProcessingFeedback, setIsProcessingFeedback] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [refinementResolver, setRefinementResolver] = useState<((value: RefinementFeedback) => void) | null>(null);
  const [superReviewerResolver, setSuperReviewerResolver] = useState<((value: SuperReviewerDecision) => void) | null>(null);

  // Structured modal state
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    context: null,
    title: '',
    placeholder: ''
  });

  // Active resolver for modal text input
  const [activeResolver, setActiveResolver] = useState<((value: string) => void) | null>(null);

  // Track previous curmudgeon feedback to enable swap pattern when replanning
  const [previousCurmudgeonFeedback, setPreviousCurmudgeonFeedback] = useState<string | null>(null);

  // Unified helper to open text input modal with context
  const openTextInputModal = (
    context: 'refinement' | 'plan' | 'superreviewer',
    title: string,
    placeholder: string,
    resolver: (value: string) => void
  ) => {
    setModalState({
      isOpen: true,
      context,
      title,
      placeholder
    });
    setActiveResolver(() => resolver);
  };

  // Get live activity to determine if spinner should animate
  const liveActivity = taskStateMachine.getLiveActivityMessage();

  // Animated activity indicator (spinner when activity is present)
  const activityIndicator = useSpinner(!!liveActivity);

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

  // Wire up SuperReviewer decision when callback is provided
  React.useEffect(() => {
    if (onSuperReviewerDecision && currentState === TaskState.TASK_SUPER_REVIEWING && taskStateMachine.getSuperReviewResult()) {
      // Create a dummy promise to get the resolver attached by orchestrator
      const dummyPromise = new Promise<SuperReviewerDecision>((resolve) => {
        // This resolve will be replaced by the orchestrator
      });

      // Call the callback which will attach the real resolver
      onSuperReviewerDecision(dummyPromise);

      // Extract the resolver that was attached by orchestrator
      const resolver = (dummyPromise as any).resolve;
      if (resolver) {
        setSuperReviewerResolver(() => resolver);
      }
    }
  }, [onSuperReviewerDecision, currentState, taskStateMachine]);


  // Handle approve action
  const handleApprove = async () => {
    setIsProcessingFeedback(true);
    setLastAction('Approved');

    try {
      const feedback: PlanFeedback = { type: 'approve' };
      onPlanFeedback?.(feedback);
    } catch (error) {
      setLastAction('Error processing approval');
      setIsProcessingFeedback(false); // Only reset on error
    }
  };

  // Handle reject action - opens modal to collect feedback
  const handleReject = () => {
    openTextInputModal(
      'plan',
      'Reject Plan',
      'Explain what\'s wrong with this approach...',
      (feedbackText: string) => {
        setIsProcessingFeedback(true);
        setLastAction('Rejected - sending feedback');

        try {
          const feedback: PlanFeedback = { type: 'wrong-approach', details: feedbackText };
          onPlanFeedback?.(feedback);
          setLastAction('Rejection feedback sent');
        } catch (error) {
          setLastAction('Error processing rejection');
          setIsProcessingFeedback(false); // Only reset on error
        }
      }
    );
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

  // Handle refinement reject action - opens modal to collect feedback
  const handleRefinementReject = () => {
    if (!refinementResolver) return;

    openTextInputModal(
      'refinement',
      'Reject Refinement',
      'Why reject this refinement? Explain what\'s wrong...',
      (feedbackText: string) => {
        setIsProcessingFeedback(true);
        setLastAction('Rejected refinement - sending feedback');

        try {
          const feedback: RefinementFeedback = { type: 'reject', details: feedbackText };
          refinementResolver(feedback);
          setRefinementResolver(null);
          setLastAction('Refinement rejection sent');
        } catch (error) {
          setLastAction('Error processing refinement rejection');
        } finally {
          setIsProcessingFeedback(false);
        }
      }
    );
  };

  // Handle modal submit - calls the active resolver and closes modal
  const handleModalSubmit = (feedbackText: string) => {
    if (activeResolver) {
      activeResolver(feedbackText);
    }
    setModalState({
      isOpen: false,
      context: null,
      title: '',
      placeholder: ''
    });
    setActiveResolver(null);
  };

  // Handle modal cancel - just closes the modal
  const handleModalCancel = () => {
    setModalState({
      isOpen: false,
      context: null,
      title: '',
      placeholder: ''
    });
    setActiveResolver(null);
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

  // Determine phase title and color
  const isExecuting = currentState === TaskState.TASK_EXECUTING;
  const isSuperReviewing = currentState === TaskState.TASK_SUPER_REVIEWING;
  const phaseTitle = isSuperReviewing ? '🔍 Final Quality Check' : (isExecuting ? '⚡ Execution Phase' : '📋 Planning Phase');
  const phaseColor = isSuperReviewing ? 'green' : (isExecuting ? 'yellow' : 'blue');

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
          borderStyle="single"
          borderColor={
            currentState === TaskState.TASK_CURMUDGEONING ? "green" : (currentState === TaskState.TASK_PLANNING && previousCurmudgeonFeedback ? "yellow" : "gray")
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
              </Box>
              <Box marginTop={1}>
                {beanCounterOutput ? (
                  <MarkdownText maxLines={paneContentHeight}>{beanCounterOutput}</MarkdownText>
                ) : (
                  <Text dimColor>Determining work chunk...</Text>
                )}
              </Box>
            </>
          ) : currentState === TaskState.TASK_SUPER_REVIEWING ? (
            // SuperReviewer: Show original plan on left
            <>
              <Box justifyContent="space-between">
                <Text color="cyan" bold>📋 Original Plan</Text>
              </Box>
              <Box marginTop={1}>
                {planMd ? (
                  <Box flexDirection="column">
                    <MarkdownText maxLines={paneContentHeight}>{planMd}</MarkdownText>
                    {planPath && (
                      <Text dimColor color="gray">Saved to: {planPath}</Text>
                    )}
                  </Box>
                ) : (
                  <Text dimColor>No plan available</Text>
                )}
              </Box>
            </>
          ) : currentState === TaskState.TASK_CURMUDGEONING ? (
            <>
              <Box justifyContent="space-between">
                <Text color="green" bold>📋 Current Plan</Text>
              </Box>
              <Box marginTop={1}>
                {planMd ? (
                  <Box flexDirection="column">
                    <MarkdownText maxLines={paneContentHeight}>{planMd}</MarkdownText>
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
              </Box>
              <Box marginTop={1}>
                <MarkdownText maxLines={paneContentHeight}>{previousCurmudgeonFeedback}</MarkdownText>
              </Box>
            </>
          ) : (
            <>
              <Box justifyContent="space-between">
                <Text color="cyan" bold>📝 Refined Task</Text>
              </Box>
              <Box marginTop={1}>
                {currentState === TaskState.TASK_REFINING && pendingRefinement ? (
                  <Box flexDirection="column">
                    <MarkdownText maxLines={paneContentHeight - 2}>
                      {pendingRefinement.raw || pendingRefinement.goal}
                    </MarkdownText>
                    <Box marginTop={1}>
                      <Text color="yellow" bold>⏳ Awaiting Approval</Text>
                    </Box>
                  </Box>
                ) : currentState === TaskState.TASK_REFINING ? (
                  <Text dimColor>Refining task description...</Text>
                ) : taskToUse ? (
                  <MarkdownText maxLines={paneContentHeight}>{taskToUse}</MarkdownText>
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
          borderStyle="single"
          borderColor={currentState === TaskState.TASK_CURMUDGEONING ? "yellow" : "gray"}
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
              </Box>
              <Box marginTop={1}>
                {reviewerOutput || coderOutput ? (
                  <MarkdownText maxLines={paneContentHeight}>
                    {reviewerOutput || coderOutput || ''}
                  </MarkdownText>
                ) : (
                  <Text dimColor>Processing...</Text>
                )}
              </Box>
            </>
          ) : currentState === TaskState.TASK_SUPER_REVIEWING ? (
            // SuperReviewer: Show results on right
            <>
              <Box justifyContent="space-between">
                <Text color="green" bold>🔍 Quality Check Results</Text>
              </Box>
              <Box marginTop={1}>
                {(() => {
                  const superReviewResult = taskStateMachine.getSuperReviewResult();
                  if (superReviewResult) {
                    return (
                      <Box flexDirection="column">
                        <MarkdownText maxLines={paneContentHeight - 5}>{superReviewResult.summary}</MarkdownText>
                        {superReviewResult.issues && superReviewResult.issues.length > 0 && (
                          <Box marginTop={1} flexDirection="column">
                            <Text color="yellow" bold>Issues Found:</Text>
                            {superReviewResult.issues.map((issue, idx) => (
                              <Text key={idx} color="yellow">• {issue}</Text>
                            ))}
                          </Box>
                        )}
                        <Box marginTop={1}>
                          <Text dimColor>Verdict: {superReviewResult.verdict === 'approve' ? '✅ Approved' : '⚠️ Needs Human Review'}</Text>
                        </Box>
                      </Box>
                    );
                  }
                  return <Text dimColor>Performing final quality check...</Text>;
                })()}
              </Box>
            </>
          ) : currentState === TaskState.TASK_CURMUDGEONING ? (
            <>
              <Box justifyContent="space-between">
                <Text color="yellow" bold>🧐 Curmudgeon Feedback</Text>
              </Box>
              <Box marginTop={1}>
                {curmudgeonFeedback ? (
                  <Box flexDirection="column">
                    <MarkdownText maxLines={paneContentHeight - 2}>{curmudgeonFeedback}</MarkdownText>
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
              </Box>
              <Box marginTop={1}>
                {planMd ? (
                  <Box flexDirection="column">
                    <MarkdownText maxLines={paneContentHeight}>{planMd}</MarkdownText>
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
              </Box>
              <Box marginTop={1}>
                {currentState === TaskState.TASK_REFINING ? (
                  <Text dimColor>Waiting for task refinement...</Text>
                ) : currentState === TaskState.TASK_PLANNING && !planMd ? (
                  <Text dimColor>Creating strategic plan...</Text>
                ) : planMd ? (
                  <Box flexDirection="column">
                    <MarkdownText maxLines={paneContentHeight}>{planMd}</MarkdownText>
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
          {liveActivity && (() => {
            // Filter out multiline content (likely full plan output) from live activity
            // Only show brief status updates (single line or short messages)
            const isLongContent = liveActivity.message.includes('\n') || liveActivity.message.length > 150;

            if (!isLongContent) {
              return (
                <Box marginBottom={1}>
                  <Text color="cyan">
                    {activityIndicator} {liveActivity.agent}: {liveActivity.message}
                  </Text>
                </Box>
              );
            }
            return null;
          })()}

          {/* Display tool status from state machine */}
          {(() => {
            // Check execution state machine first (if in execution phase)
            const executionStateMachine = taskStateMachine.getExecutionStateMachine();
            const toolStatus = executionStateMachine?.getToolStatus() || taskStateMachine.getToolStatus();

            if (toolStatus) {
              return (
                <Box marginBottom={1}>
                  <Text color="cyan">
                    ⚙️ [{toolStatus.agent}] → {toolStatus.tool}: {toolStatus.summary}
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
            {currentState === TaskState.TASK_SUPER_REVIEWING && 'SuperReviewer performing final quality check...'}
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
          {currentState === TaskState.TASK_REFINING && pendingRefinement && refinementResolver && (
            <Box marginTop={1} flexDirection="column">
              <Text color="green" bold>🔍 Refined Task Ready for Review</Text>
              <Box marginTop={1}>
                <SelectInput
                  items={[
                    { label: 'Approve Refined Task', value: 'approve' },
                    { label: 'Reject and Use Original', value: 'reject' }
                  ]}
                  onSelect={(item) => {
                    if (item.value === 'approve') {
                      handleRefinementApprove();
                    } else if (item.value === 'reject') {
                      handleRefinementReject();
                    }
                  }}
                />
              </Box>

              {/* Show feedback processing state */}
              {isProcessingFeedback && (
                <Box marginTop={1}>
                  <Text color="blue">⏳ Processing your feedback...</Text>
                </Box>
              )}
            </Box>
          )}

          {(currentState === TaskState.TASK_CURMUDGEONING && onPlanFeedback) &&
           planMd && !isProcessingFeedback && (
            <Box marginTop={1} flexDirection="column">
              <Text color="green" bold>🎯 Plan Ready for Review</Text>
              <Box marginTop={1}>
                <SelectInput
                  items={[
                    { label: 'Approve and Start Coding', value: 'approve' },
                    { label: 'Reject and Provide Feedback', value: 'reject' }
                  ]}
                  onSelect={(item) => {
                    if (item.value === 'approve') {
                      handleApprove();
                    } else if (item.value === 'reject') {
                      handleReject();
                    }
                  }}
                />
              </Box>

              {/* Show feedback processing state */}
              {isProcessingFeedback && (
                <Box marginTop={1}>
                  <Text color="blue">⏳ Processing your feedback...</Text>
                </Box>
              )}
            </Box>
          )}

          {currentState === TaskState.TASK_SUPER_REVIEWING && taskStateMachine.getSuperReviewResult() && superReviewerResolver && (
            <Box marginTop={1} flexDirection="column">
              <Text color="green" bold>🔍 Quality Check Complete</Text>
              <Box marginTop={1}>
                <SelectInput
                  items={[
                    { label: 'Approve and Complete Task', value: 'approve' },
                    { label: 'Retry and Fix Issues', value: 'retry' },
                    { label: 'Abandon Task', value: 'abandon' }
                  ]}
                  onSelect={(item) => {
                    if (item.value === 'approve') {
                      superReviewerResolver({ action: 'approve' });
                      setSuperReviewerResolver(null);
                    } else if (item.value === 'retry') {
                      openTextInputModal(
                        'superreviewer',
                        'Provide Retry Feedback',
                        'Describe what needs to be fixed or improved...',
                        (feedbackText: string) => {
                          if (superReviewerResolver) {
                            superReviewerResolver({ action: 'retry', feedback: feedbackText });
                            setSuperReviewerResolver(null);
                            setLastAction('Retry requested with feedback');
                          }
                        }
                      );
                    } else if (item.value === 'abandon') {
                      superReviewerResolver({ action: 'abandon' });
                      setSuperReviewerResolver(null);
                    }
                  }}
                />
              </Box>

              {/* Show feedback processing state */}
              {isProcessingFeedback && (
                <Box marginTop={1}>
                  <Text color="blue">⏳ Processing your decision...</Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* TextInputModal - unified for all rejection contexts */}
      {modalState.isOpen && (
        <TextInputModal
          title={modalState.title}
          placeholder={modalState.placeholder}
          onSubmit={handleModalSubmit}
          onCancel={handleModalCancel}
        />
      )}
    </Box>
  );
};

export default PlanningLayout;
import React, { useState } from 'react';
import { Text, Box, useStdout, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { TaskStateMachine, TaskState } from '../../../task-state-machine.js';
import { State } from '../../../state-machine.js';
import { CommandBus } from '../../../ui/command-bus.js';
import { getPlanFeedback, type PlanFeedback } from '../../planning-interface.js';
import type { RefinementFeedback, RefinementAction } from '../../refinement-interface.js';
import type { SuperReviewerDecision, GardenerResult, MergeApprovalDecision } from '../../../types.js';
import { FullscreenModal } from './FullscreenModal.js';
import { TextInputModal } from './TextInputModal.js';
import { MarkdownText } from './MarkdownText.js';
import { Spinner } from './Spinner.js';

// TypeScript interface for PlanningLayout props
interface PlanningLayoutProps {
  currentState: TaskState;
  taskStateMachine: TaskStateMachine;
  commandBus: CommandBus;  // Required - event-driven architecture
  onRefinementFeedback?: (feedback: RefinementFeedback) => void;
  onAnswerCallback?: (answer: string) => void;
  onRefinementInteraction?: (action: RefinementAction) => void;
  onSuperReviewerDecision?: (decision: SuperReviewerDecision) => void;
  onFullscreen?: (paneNum: number) => void;
  terminalHeight: number;
  terminalWidth: number;
  availableContentHeight: number;
  gardenerResult?: GardenerResult | null;
}

// Planning Layout Component - handles TASK_PLANNING, TASK_REFINING, TASK_CURMUDGEONING
export const PlanningLayout: React.FC<PlanningLayoutProps> = ({
  currentState,
  taskStateMachine,
  commandBus,
  onRefinementFeedback,
  onAnswerCallback,
  onRefinementInteraction,
  onSuperReviewerDecision,
  onFullscreen,
  terminalHeight,
  terminalWidth,
  availableContentHeight,
  gardenerResult
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
  const [answerResolver, setAnswerResolver] = useState<((answer: string) => void) | null>(null);
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

  // Injection modal state
  const [showInjectionModal, setShowInjectionModal] = useState(false);

  // Get data from TaskStateMachine (needed for useEffects)
  const context = taskStateMachine.getContext();
  const taskToUse = context.taskToUse || context.humanTask;
  const pendingRefinement = taskStateMachine.getPendingRefinement();
  const planMd = taskStateMachine.getPlanMd();
  const planPath = taskStateMachine.getPlanPath();
  const curmudgeonFeedback = taskStateMachine.getCurmudgeonFeedback();
  const simplificationCount = taskStateMachine.getSimplificationCount();
  const isAnsweringQuestion = taskStateMachine.getAnsweringQuestion();

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

  // Intercept Ctrl+Q/W/E for fullscreen panes
  useInput((input, key) => {
    if (key.ctrl && (input === 'q' || input === 'Q' || input === 'w' || input === 'W' || input === 'e' || input === 'E')) {
      const paneMap: { [key: string]: number } = { q: 1, Q: 1, w: 2, W: 2, e: 3, E: 3 };
      onFullscreen?.(paneMap[input]);
      return;
    }
  });

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
    if (onRefinementFeedback && currentState === TaskState.TASK_REFINING && pendingRefinement) {
      // Store the callback directly - it will handle the feedback
      setRefinementResolver(() => onRefinementFeedback);
    }
  }, [onRefinementFeedback, currentState, pendingRefinement]);

  // Wire up answer callback when a question is asked
  React.useEffect(() => {
    if (onAnswerCallback && currentState === TaskState.TASK_REFINING && taskStateMachine.getCurrentQuestion()) {
      // Store the callback directly - it will handle the answer
      setAnswerResolver(() => onAnswerCallback);
    }
  }, [onAnswerCallback, currentState, taskStateMachine]);

  // Wire up SuperReviewer decision when callback is provided
  React.useEffect(() => {
    if (onSuperReviewerDecision && currentState === TaskState.TASK_SUPER_REVIEWING && taskStateMachine.getSuperReviewResult()) {
      // Store the callback as the resolver - it will be called directly with the decision
      setSuperReviewerResolver(() => onSuperReviewerDecision);
    }
  }, [onSuperReviewerDecision, currentState, taskStateMachine]);


  // NEW: Unified refinement interaction handler
  const [refinementInteractionHandler, setRefinementInteractionHandler] = useState<((action: RefinementAction) => void) | null>(null);

  React.useEffect(() => {
    if (onRefinementInteraction && currentState === TaskState.TASK_REFINING) {
      setRefinementInteractionHandler(() => onRefinementInteraction);
    } else {
      setRefinementInteractionHandler(null);
    }
  }, [onRefinementInteraction, currentState]);


  // Handle approve action
  const handleApprove = async () => {
    setIsProcessingFeedback(true);
    setLastAction('Approved');

    try {
      await commandBus.sendCommand({ type: 'plan:approve' });
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
      async (feedbackText: string) => {
        setIsProcessingFeedback(true);
        setLastAction('Rejected - sending feedback');

        try {
          await commandBus.sendCommand({ type: 'plan:reject', details: feedbackText });
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
    setIsProcessingFeedback(true);
    setLastAction('Approved refinement');

    try {
      // Use CommandBus if available (new pattern)
      if (commandBus) {
        await commandBus.sendCommand({ type: 'refinement:approve' });
      }
      // Fallback to resolver callback (old pattern)
      else if (refinementResolver) {
        const feedback: RefinementFeedback = { type: 'approve' };
        refinementResolver(feedback);
        setRefinementResolver(null);
      }
    } catch (error) {
      setLastAction('Error processing refinement approval');
    } finally {
      setIsProcessingFeedback(false);
    }
  };

  // Handle refinement reject action - opens modal to collect feedback
  const handleRefinementReject = () => {
    if (!commandBus && !refinementResolver) return;  // Need at least one way to communicate

    openTextInputModal(
      'refinement',
      'Reject Refinement',
      'Why reject this refinement? Explain what\'s wrong...',
      async (feedbackText: string) => {
        setIsProcessingFeedback(true);
        setLastAction('Rejected refinement - sending feedback');

        try {
          // Use CommandBus if available (new pattern)
          if (commandBus) {
            await commandBus.sendCommand({ type: 'refinement:reject', details: feedbackText });
          }
          // Fallback to resolver callback (old pattern)
          else if (refinementResolver) {
            const feedback: RefinementFeedback = { type: 'reject', details: feedbackText };
            refinementResolver(feedback);
            setRefinementResolver(null);
          }
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

  // Handle injection modal submit
  const handleInjectionSubmit = (content: string) => {
    taskStateMachine.setPendingInjection(content);
    setShowInjectionModal(false);
  };

  // Handle injection modal cancel
  const handleInjectionCancel = () => {
    setShowInjectionModal(false);
  };


  // Calculate responsive layout based on terminal width
  const isWideTerminal = terminalWidth > 120;
  const panelWidth = Math.floor(terminalWidth * 0.49);

  // Monitor injection pause and show modal when appropriate
  React.useEffect(() => {
    const pauseRequested = taskStateMachine.isInjectionPauseRequested();

    // Determine if current phase is complete
    const isPlanningComplete = planMd !== null && !isProcessingFeedback;
    const isCurmudgeoningComplete = curmudgeonFeedback !== null && !isProcessingFeedback;

    const isPhaseComplete =
      (currentState === TaskState.TASK_PLANNING && isPlanningComplete) ||
      (currentState === TaskState.TASK_CURMUDGEONING && isCurmudgeoningComplete);

    // Detect if other modals are active
    const isQuestionModalActive =
      currentState === TaskState.TASK_REFINING &&
      taskStateMachine.getCurrentQuestion() &&
      answerResolver;

    const isAnyModalActive = isQuestionModalActive || modalState.isOpen;

    // Show injection modal when pause requested, phase complete, and no conflicts
    if (pauseRequested && isPhaseComplete && !isAnyModalActive) {
      setShowInjectionModal(true);
      taskStateMachine.clearInjectionPause();
    }
  }, [planMd, curmudgeonFeedback, isProcessingFeedback, modalState.isOpen, answerResolver, currentState]);

  // Get execution state machine data if in TASK_EXECUTING
  const executionStateMachine = taskStateMachine.getExecutionStateMachine();
  const executionState = executionStateMachine?.getCurrentState();
  const beanCounterOutput = executionStateMachine?.getAgentOutput('bean');
  const coderOutput = executionStateMachine?.getAgentOutput('coder');
  const reviewerOutput = executionStateMachine?.getAgentOutput('reviewer');

  // Calculate content height for each pane in split view
  const paneContentHeight = Math.floor(availableContentHeight / 2) - 4; // Divide by 2 for two rows, subtract for borders/padding

  // Determine if a query is in progress based on state and data availability
  const isQueryInProgress =
    (currentState === TaskState.TASK_REFINING && !pendingRefinement) ||
    (currentState === TaskState.TASK_PLANNING && !planMd) ||
    (currentState === TaskState.TASK_CURMUDGEONING && !curmudgeonFeedback);

  // Determine phase title and color
  const isExecuting = currentState === TaskState.TASK_EXECUTING;
  const isSuperReviewing = currentState === TaskState.TASK_SUPER_REVIEWING;
  const isGardening = currentState === TaskState.TASK_GARDENING;
  const phaseTitle = isSuperReviewing ? '🔍 Final Quality Check' :
                     isGardening ? '📚 Documentation Update Phase' :
                     (isExecuting ? '⚡ Execution Phase' : '📋 Planning Phase');
  const phaseColor = isSuperReviewing ? 'green' :
                     isGardening ? 'cyan' :
                     (isExecuting ? 'yellow' : 'blue');

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={phaseColor} padding={1} flexGrow={1}>
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
          paddingX={1}
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
                <Text dimColor>[Q]</Text>
              </Box>
              <Box marginTop={1}>
                {beanCounterOutput ? (
                  <MarkdownText maxLines={paneContentHeight}>{beanCounterOutput}</MarkdownText>
                ) : (
                  <Text dimColor>Determining work chunk...</Text>
                )}
              </Box>
            </>
          ) : (currentState === TaskState.TASK_SUPER_REVIEWING || currentState === TaskState.TASK_GARDENING) ? (
            // SuperReviewer/Gardening: Show quality check results on left
            <>
              <Box justifyContent="space-between">
                <Text color="green" bold>🔍 Quality Check Results</Text>
                <Text dimColor>[Q]</Text>
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
                              <Box key={idx}>
                                <Text color="yellow">• </Text>
                                <MarkdownText>{issue}</MarkdownText>
                              </Box>
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
                <Text color="green" bold>📋 Current Plan</Text>
                <Text dimColor>[Q]</Text>
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
                <Text dimColor>[Q]</Text>
              </Box>
              <Box marginTop={1}>
                <MarkdownText maxLines={paneContentHeight}>{previousCurmudgeonFeedback}</MarkdownText>
              </Box>
            </>
          ) : (
            <>
              <Box justifyContent="space-between">
                <Text color="cyan" bold>📝 Refined Task</Text>
                <Text dimColor>[Q]</Text>
              </Box>
              <Box marginTop={1}>
                {currentState === TaskState.TASK_REFINING && pendingRefinement ? (
                  <MarkdownText maxLines={paneContentHeight}>
                    {pendingRefinement}
                  </MarkdownText>
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
          paddingX={1}
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
                <Text dimColor>[W]</Text>
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
          ) : (currentState === TaskState.TASK_SUPER_REVIEWING || currentState === TaskState.TASK_GARDENING) ? (
            // SuperReviewer/Gardening: Show Gardener documentation update status on right
            <>
              <Box justifyContent="space-between">
                <Text color="cyan" bold>📝 Documentation Update Status</Text>
                <Text dimColor>[W]</Text>
              </Box>
              <Box marginTop={1}>
                {!gardenerResult ? (
                  <Box flexDirection="column">
                    <Text color="yellow">
                      <Spinner isActive={true} /> {currentState === TaskState.TASK_GARDENING ? 'Updating documentation...' : 'Awaiting documentation update...'}
                    </Text>
                  </Box>
                ) : gardenerResult.success ? (
                  <Box flexDirection="column">
                    <Text color="green" bold>✅ {gardenerResult.message}</Text>
                    {gardenerResult.sectionsUpdated.length > 0 && (
                      <Box marginTop={1} flexDirection="column">
                        <Text color="cyan" bold>Sections Updated:</Text>
                        {gardenerResult.sectionsUpdated.map((section, idx) => (
                          <Text key={idx} color="green">• {section}</Text>
                        ))}
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box flexDirection="column">
                    <Text color="red" bold>❌ Documentation update failed</Text>
                    {gardenerResult.error && (
                      <Box marginTop={1}>
                        <Text color="red">{gardenerResult.error}</Text>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </>
          ) : currentState === TaskState.TASK_CURMUDGEONING ? (
            <>
              <Box justifyContent="space-between">
                <Text color="yellow" bold>🧐 Curmudgeon Feedback</Text>
                <Text dimColor>[W]</Text>
              </Box>
              <Box marginTop={1}>
                {curmudgeonFeedback ? (
                  <Box flexDirection="column">
                    <MarkdownText maxLines={paneContentHeight - 2}>{curmudgeonFeedback}</MarkdownText>
                    <Box marginTop={1}>
                      <Text dimColor>Simplification attempt {simplificationCount + 1}/4</Text>
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
                <Text dimColor>[W]</Text>
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
                <Text dimColor>[W]</Text>
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
        borderColor={
          (pendingRefinement && refinementResolver) ||
          (planMd && currentState === TaskState.TASK_CURMUDGEONING && !isProcessingFeedback) ||
          (taskStateMachine.getCurrentQuestion() && answerResolver) ||
          (taskStateMachine.getSuperReviewResult()?.verdict === 'needs-human' && superReviewerResolver)
            ? "yellow"
            : "blue"
        }
        paddingX={1}
      >
        <Box flexDirection="column">
          {/* Injection pending indicator */}
          {taskStateMachine.hasPendingInjection() && (
            <Box marginBottom={1}>
              <Text dimColor>🎯 Injection Pending (Next Agent)</Text>
            </Box>
          )}

          {/* Combined status message with tool status */}
          {(() => {
            // Check execution state machine first (if in execution phase)
            const executionStateMachine = taskStateMachine.getExecutionStateMachine();
            const toolStatus = executionStateMachine?.getToolStatus() || taskStateMachine.getToolStatus();

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
            const statusMessage = toolStatus ?
              `${baseStatus} → ${toolStatus.tool}: ${toolStatus.summary}` :
              baseStatus;

            // Only show spinner when there's actual activity
            const showSpinner = !!(toolStatus || isQueryInProgress);

            return (
              <Text color={toolStatus ? "cyan" : undefined} dimColor={!toolStatus}>
                {showSpinner && <Spinner isActive={true} />}
                {showSpinner && " "}
                {statusMessage}
              </Text>
            );
          })()}

          {/* Interactive Instructions - Show for refinement or planning states */}
          {currentState === TaskState.TASK_REFINING && pendingRefinement && (commandBus || refinementInteractionHandler || refinementResolver) && (
            <Box marginTop={1} flexDirection="column">
              <Text color="green" bold>🔍 Refined Task Ready for Review</Text>
              <Box marginTop={1}>
                <SelectInput
                  items={[
                    { label: 'Approve Refined Task', value: 'approve' },
                    { label: 'Reject and Use Original', value: 'reject' }
                  ]}
                  onSelect={(item) => {
                    // Always use handlers - they use CommandBus (refinementInteractionHandler is for Q&A only)
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

          {currentState === TaskState.TASK_CURMUDGEONING &&
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

      {/* Question Modal - for clarifying questions during refinement */}
      {currentState === TaskState.TASK_REFINING && taskStateMachine.getCurrentQuestion() && (refinementInteractionHandler || answerResolver) && (
        <TextInputModal
          title="Clarifying Question"
          content={taskStateMachine.getCurrentQuestion() || undefined}  // Show the question in the modal body
          placeholder="Type your answer and press Enter to submit"
          width={terminalWidth - 4}  // Full width minus margin
          height={Math.min(terminalHeight - 4, 30)}  // Full height minus margin, max 30
          onSubmit={(answer) => {
            if (refinementInteractionHandler) {
              // Use unified handler if available
              refinementInteractionHandler({ type: 'answer', answer });
            } else if (answerResolver) {
              // Fall back to old pattern
              answerResolver(answer);
              setAnswerResolver(null);
            }
          }}
          onCancel={() => {
            if (refinementInteractionHandler) {
              // Use unified handler with empty answer
              refinementInteractionHandler({ type: 'answer', answer: '' });
            } else if (answerResolver) {
              answerResolver('');
              setAnswerResolver(null);
            }
          }}
        />
      )}

      {/* TextInputModal - unified for all rejection contexts */}
      {modalState.isOpen && (
        <TextInputModal
          title={modalState.title}
          placeholder={modalState.placeholder}
          onSubmit={handleModalSubmit}
          onCancel={handleModalCancel}
        />
      )}

      {/* Injection Modal - for dynamic prompt injection */}
      {showInjectionModal && (() => {
        const agentType = currentState === TaskState.TASK_PLANNING ? 'Planner' : 'Curmudgeon';
        const modalTitle = `Dynamic Prompt Injection → ${agentType}`;
        const taskDesc = taskStateMachine.getContext().taskToUse || taskStateMachine.getContext().humanTask;
        const contextInfo = `Task: ${taskDesc.substring(0, 60)}${taskDesc.length > 60 ? '...' : ''}`;

        return (
          <TextInputModal
            title={modalTitle}
            placeholder={contextInfo}
            onSubmit={handleInjectionSubmit}
            onCancel={handleInjectionCancel}
          />
        );
      })()}
    </Box>
  );
};

export default PlanningLayout;
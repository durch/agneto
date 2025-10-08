import React, { useState } from 'react';
import { Text, Box, useStdout, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { TaskStateMachine, TaskState } from '../../../task-state-machine.js';
import { State } from '../../../state-machine.js';
import { CommandBus } from '../../../ui/command-bus.js';
import { getPlanFeedback, type PlanFeedback } from '../../planning-interface.js';
import type { RefinementFeedback, RefinementAction } from '../../refinement-interface.js';
import type { SuperReviewerDecision, GardenerResult } from '../../../types.js';
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
    context: 'refinement' | 'plan' | null;
    title: string;
    placeholder: string;
  }

  // Local state for interactive feedback
  const [isProcessingFeedback, setIsProcessingFeedback] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [showPlanApproval, setShowPlanApproval] = useState(false);
  const [showRefinementApproval, setShowRefinementApproval] = useState(false);
  const [showSuperReviewApproval, setShowSuperReviewApproval] = useState(false);
  const [superReviewComplete, setSuperReviewComplete] = useState(false);

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

  // React state mirroring TaskStateMachine data (event-driven updates)
  const [context, setContext] = useState(taskStateMachine.getContext());
  const [pendingRefinement, setPendingRefinement] = useState(taskStateMachine.getPendingRefinement());
  const [planMd, setPlanMd] = useState(taskStateMachine.getPlanMd());
  const [planPath, setPlanPath] = useState(taskStateMachine.getPlanPath());
  const [curmudgeonFeedback, setCurmudgeonFeedback] = useState(taskStateMachine.getCurmudgeonFeedback());
  const [simplificationCount, setSimplificationCount] = useState(taskStateMachine.getSimplificationCount());
  const [isAnsweringQuestion, setIsAnsweringQuestion] = useState(taskStateMachine.getAnsweringQuestion());
  const [liveActivityMessage, setLiveActivityMessage] = useState(taskStateMachine.getLiveActivityMessage());
  const [taskToolStatus, setTaskToolStatus] = useState(taskStateMachine.getToolStatus());

  // Derived data
  const taskToUse = context.taskToUse || context.humanTask;

  // Unified helper to open text input modal with context
  const openTextInputModal = (
    context: 'refinement' | 'plan',
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

  // Subscribe to TaskStateMachine events for automatic re-rendering
  React.useEffect(() => {
    const handleSuperReviewComplete = () => {
      setSuperReviewComplete(true);
      handleDataUpdate();
    };

    const handleDataUpdate = () => {
      if (process.env.DEBUG) {
        console.log('[PlanningLayout.tsx] handleDataUpdate: updating React state from TaskStateMachine');
      }
      // Update all relevant state from TaskStateMachine
      setContext(taskStateMachine.getContext());
      setPendingRefinement(taskStateMachine.getPendingRefinement());
      setPlanMd(taskStateMachine.getPlanMd());
      setPlanPath(taskStateMachine.getPlanPath());
      setCurmudgeonFeedback(taskStateMachine.getCurmudgeonFeedback());
      setSimplificationCount(taskStateMachine.getSimplificationCount());
      setIsAnsweringQuestion(taskStateMachine.getAnsweringQuestion());
      setLiveActivityMessage(taskStateMachine.getLiveActivityMessage());
      setTaskToolStatus(taskStateMachine.getToolStatus());

      // Check if orchestrator is waiting for approval commands - restore menu visibility
      const pendingCommands = commandBus.getPendingCommandTypes();

      // Restore plan approval menu if waiting
      const isWaitingForPlanApproval = pendingCommands.some(type =>
        type === 'plan:approve' || type === 'plan:reject'
      );
      if (isWaitingForPlanApproval) {
        setShowPlanApproval(true);
      }

      // Restore refinement approval menu if waiting
      const isWaitingForRefinementApproval = pendingCommands.some(type =>
        type === 'refinement:approve' || type === 'refinement:reject'
      );
      if (isWaitingForRefinementApproval) {
        setShowRefinementApproval(true);
      }

      // Restore superreview approval menu if waiting
      const isWaitingForSuperReviewApproval = pendingCommands.some(type =>
        type === 'superreview:approve' || type === 'superreview:retry' || type === 'superreview:abandon'
      );
      if (isWaitingForSuperReviewApproval) {
        setShowSuperReviewApproval(true);
      }
    };

    const handlePlanAwaitingApproval = () => {
      if (process.env.DEBUG) {
        console.log('[PlanningLayout.tsx] handlePlanAwaitingApproval: showing plan approval menu');
      }
      setShowPlanApproval(true);
    };

    const handleRefinementAwaitingApproval = () => {
      if (process.env.DEBUG) {
        console.log('[PlanningLayout.tsx] handleRefinementAwaitingApproval: showing refinement approval menu');
      }
      setShowRefinementApproval(true);
    };

    const handleSuperReviewAwaitingApproval = () => {
      if (process.env.DEBUG) {
        console.log('[PlanningLayout.tsx] handleSuperReviewAwaitingApproval: showing superreview approval menu');
      }
      setShowSuperReviewApproval(true);
    };

    // Subscribe to events
    taskStateMachine.on('activity:updated', handleDataUpdate);
    taskStateMachine.on('tool:status', handleDataUpdate);
    taskStateMachine.on('plan:ready', handleDataUpdate);
    taskStateMachine.on('refinement:ready', handleDataUpdate);
    taskStateMachine.on('question:asked', handleDataUpdate);
    taskStateMachine.on('question:answering', handleDataUpdate);
    taskStateMachine.on('curmudgeon:feedback', handleDataUpdate);
    taskStateMachine.on('plan:awaiting_approval', handlePlanAwaitingApproval);
    taskStateMachine.on('refinement:awaiting_approval', handleRefinementAwaitingApproval);
    taskStateMachine.on('superreview:awaiting_approval', handleSuperReviewAwaitingApproval);
    taskStateMachine.on('superreview:complete', handleSuperReviewComplete);

    // Initialize menu state on mount - restore menus if commands pending
    handleDataUpdate();

    // Cleanup on unmount
    return () => {
      if (process.env.DEBUG) {
        console.log('[PlanningLayout.tsx] Cleanup: removing event listeners from TaskStateMachine');
      }
      taskStateMachine.off('activity:updated', handleDataUpdate);
      taskStateMachine.off('tool:status', handleDataUpdate);
      taskStateMachine.off('plan:ready', handleDataUpdate);
      taskStateMachine.off('refinement:ready', handleDataUpdate);
      taskStateMachine.off('question:asked', handleDataUpdate);
      taskStateMachine.off('question:answering', handleDataUpdate);
      taskStateMachine.off('curmudgeon:feedback', handleDataUpdate);
      taskStateMachine.off('plan:awaiting_approval', handlePlanAwaitingApproval);
      taskStateMachine.off('refinement:awaiting_approval', handleRefinementAwaitingApproval);
      taskStateMachine.off('superreview:awaiting_approval', handleSuperReviewAwaitingApproval);
      taskStateMachine.off('superreview:complete', handleSuperReviewComplete);
    };
  }, [taskStateMachine]);

  // Subscribe to immediate injection pause requests (Ctrl+I)
  React.useEffect(() => {
    const handleInjectionPauseRequest = () => {
      // Use the same modal conflict detection as the existing polling logic
      const isQuestionModalActive =
        currentState === TaskState.TASK_REFINING &&
        taskStateMachine.getCurrentQuestion() &&
        !isAnsweringQuestion;

      const isAnyModalActive = isQuestionModalActive || modalState.isOpen;

      // Don't show modal if other modals are already active
      if (isAnyModalActive) {
        return;
      }

      setShowInjectionModal(true);
      taskStateMachine.clearInjectionPause();
    };

    taskStateMachine.on('injection:pause:requested', handleInjectionPauseRequest);

    return () => {
      taskStateMachine.off('injection:pause:requested', handleInjectionPauseRequest);
    };
  }, [taskStateMachine, currentState, modalState.isOpen, isAnsweringQuestion]);

  // Reset approval flags when leaving their respective states
  React.useEffect(() => {
    if (currentState !== TaskState.TASK_CURMUDGEONING) {
      setShowPlanApproval(false);
    }
    if (currentState !== TaskState.TASK_REFINING) {
      setShowRefinementApproval(false);
    }
    if (currentState !== TaskState.TASK_SUPER_REVIEWING) {
      setShowSuperReviewApproval(false);
    }
    // Reset superReviewComplete when entering TASK_SUPER_REVIEWING (handles retries)
    if (currentState === TaskState.TASK_SUPER_REVIEWING) {
      setSuperReviewComplete(false);
    }
  }, [currentState]);

  // Handle approve action
  const handleApprove = async () => {
    setShowPlanApproval(false); // Hide menu immediately
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
    setShowPlanApproval(false); // Hide menu immediately
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
    setShowRefinementApproval(false); // Hide menu immediately
    setIsProcessingFeedback(true);
    setLastAction('Approved refinement');

    try {
      await commandBus.sendCommand({ type: 'refinement:approve' });
    } catch (error) {
      setLastAction('Error processing refinement approval');
      setIsProcessingFeedback(false); // Only reset on error
    }
  };

  // Handle refinement reject action - opens modal to collect feedback
  const handleRefinementReject = () => {
    setShowRefinementApproval(false); // Hide menu immediately
    openTextInputModal(
      'refinement',
      'Reject Refinement',
      'Why reject this refinement? Explain what\'s wrong...',
      async (feedbackText: string) => {
        setIsProcessingFeedback(true);
        setLastAction('Rejected refinement - sending feedback');

        try {
          await commandBus.sendCommand({ type: 'refinement:reject', details: feedbackText });
          setLastAction('Refinement rejection sent');
        } catch (error) {
          setLastAction('Error processing refinement rejection');
          setIsProcessingFeedback(false); // Only reset on error
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

  // Get execution state machine data if in TASK_EXECUTING
  const executionStateMachine = taskStateMachine.getExecutionStateMachine();
  const executionState = executionStateMachine?.getCurrentState();
  const beanCounterOutput = executionStateMachine?.getAgentOutput('bean');
  const coderOutput = executionStateMachine?.getAgentOutput('coder');
  const reviewerOutput = executionStateMachine?.getAgentOutput('reviewer');

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

  // Calculate maxHeight for MarkdownText instances (side-by-side panels = full height per pane)
  const paneHeight = availableContentHeight;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={phaseColor} padding={1} flexGrow={0}>
      {/* Top row: Refined Task and Plan Content panels */}
      <Box
        flexDirection={isWideTerminal ? "row" : "column"}
        marginBottom={1}
        flexGrow={0}
        flexShrink={1}
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
          flexShrink={1}
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
                  <MarkdownText maxHeight={paneHeight}>{beanCounterOutput}</MarkdownText>
                ) : (
                  <Text dimColor>Determining work chunk...</Text>
                )}
              </Box>
            </>
          ) : currentState === TaskState.TASK_SUPER_REVIEWING && !superReviewComplete ? (
            // SuperReviewer running but not complete: Keep showing Bean Counter context
            <>
              <Box justifyContent="space-between">
                <Text color="cyan" bold>🧮 Bean Counter Chunk</Text>
                <Text dimColor>[Q]</Text>
              </Box>
              <Box marginTop={1}>
                {beanCounterOutput ? (
                  <MarkdownText maxHeight={paneHeight}>{beanCounterOutput}</MarkdownText>
                ) : (
                  <Text dimColor>Determining work chunk...</Text>
                )}
              </Box>
            </>
          ) : ((currentState === TaskState.TASK_SUPER_REVIEWING && superReviewComplete) || currentState === TaskState.TASK_GARDENING) ? (
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
                    // Calculate proportional height for issues list (reserve space for summary + verdict)
                    const issueHeight = superReviewResult.issues && superReviewResult.issues.length > 0
                      ? Math.floor(paneHeight / (superReviewResult.issues.length + 2))
                      : paneHeight;
                    return (
                      <Box flexDirection="column">
                        <MarkdownText maxHeight={issueHeight}>{superReviewResult.summary}</MarkdownText>
                        {superReviewResult.issues && superReviewResult.issues.length > 0 && (
                          <Box marginTop={1} flexDirection="column">
                            <Text color="yellow" bold>Issues Found:</Text>
                            {superReviewResult.issues.map((issue, idx) => (
                              <Box key={idx}>
                                <Text color="yellow">• </Text>
                                <MarkdownText maxHeight={issueHeight}>{issue}</MarkdownText>
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
                    <MarkdownText maxHeight={paneHeight}>{planMd}</MarkdownText>
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
                <MarkdownText maxHeight={paneHeight}>{previousCurmudgeonFeedback}</MarkdownText>
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
                  <MarkdownText maxHeight={paneHeight}>
                    {pendingRefinement}
                  </MarkdownText>
                ) : currentState === TaskState.TASK_REFINING ? (
                  <Text dimColor>Refining task description...</Text>
                ) : taskToUse ? (
                  <MarkdownText maxHeight={paneHeight}>{taskToUse}</MarkdownText>
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
          flexShrink={1}
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
                  <MarkdownText maxHeight={paneHeight}>
                    {reviewerOutput || coderOutput || ''}
                  </MarkdownText>
                ) : (
                  <Text dimColor>Processing...</Text>
                )}
              </Box>
            </>
          ) : currentState === TaskState.TASK_SUPER_REVIEWING && !superReviewComplete ? (
            // SuperReviewer running but not complete: Show progress message
            <>
              <Box justifyContent="space-between">
                <Text color="green" bold>⏳ SuperReviewer Analysis</Text>
                <Text dimColor>[W]</Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>⏳ Performing final quality check...</Text>
              </Box>
            </>
          ) : ((currentState === TaskState.TASK_SUPER_REVIEWING && superReviewComplete) || currentState === TaskState.TASK_GARDENING) ? (
            // SuperReviewer complete or Gardening: Show Gardener documentation update status on right
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
                    <MarkdownText maxHeight={paneHeight}>{curmudgeonFeedback}</MarkdownText>
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
                    <MarkdownText maxHeight={paneHeight}>{planMd}</MarkdownText>
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
                    <MarkdownText maxHeight={paneHeight}>{planMd}</MarkdownText>
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
          showRefinementApproval ||
          showPlanApproval ||
          showSuperReviewApproval ||
          (taskStateMachine.getCurrentQuestion() && !isAnsweringQuestion)
            ? "yellow"
            : "blue"
        }
        paddingX={1}
        flexShrink={0}
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
            const toolStatus = executionStateMachine?.getToolStatus() || taskToolStatus;

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
          {showRefinementApproval && (
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

          {showPlanApproval && (
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

          {showSuperReviewApproval && (
            <Box marginTop={1} flexDirection="column">
              <Text color="green" bold>🔍 Quality Check Complete</Text>
              <Box marginTop={1}>
                <SelectInput
                  items={[
                    { label: 'Approve and Complete Task', value: 'approve' },
                    { label: 'Retry and Fix Issues', value: 'retry' },
                    { label: 'Abandon Task', value: 'abandon' }
                  ]}
                  onSelect={async (item) => {
                    setShowSuperReviewApproval(false); // Hide menu immediately
                    if (item.value === 'approve') {
                      await commandBus.sendCommand({ type: 'superreview:approve' });
                    } else if (item.value === 'retry') {
                      // Note: retry feedback currently not implemented via modal - would need 'plan' context type
                      await commandBus.sendCommand({ type: 'superreview:retry', feedback: '' });
                      setLastAction('Retry requested');
                    } else if (item.value === 'abandon') {
                      await commandBus.sendCommand({ type: 'superreview:abandon' });
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
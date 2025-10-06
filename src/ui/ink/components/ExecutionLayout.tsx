import React, { useState } from 'react';
import { Text, Box, useStdout, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { TaskStateMachine, ToolStatus } from '../../../task-state-machine.js';
import { CommandBus } from '../../../ui/command-bus.js';
import { State } from '../../../state-machine.js';
import { StatusIndicator } from './StatusIndicator.js';
import type { HumanInteractionResult } from '../../../types.js';
import { TextInputModal } from './TextInputModal.js';
import { Spinner } from './Spinner.js';
import { MarkdownText } from './MarkdownText.js';

// TypeScript interface for ExecutionLayout props
interface ExecutionLayoutProps {
  taskStateMachine: TaskStateMachine;
  commandBus: CommandBus;  // Required - event-driven architecture
  onFullscreen?: (paneNum: number) => void;
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
    display: visibleLines.join('\n') + '\n... [Content truncated]',
    isTruncated: true
  };
}

// Helper function to determine which agent is currently active
function getActiveAgent(currentState: State): 'coder' | 'reviewer' | null {
  switch (currentState) {
    case State.PLANNING:
    case State.IMPLEMENTING:
      return 'coder';
    case State.PLAN_REVIEW:
    case State.CODE_REVIEW:
      return 'reviewer';
    default:
      return null;
  }
}

// Helper function to get contextual status text for each agent
function getAgentStatusText(agent: 'coder' | 'reviewer', currentState: State): string {
  const activeAgent = getActiveAgent(currentState);

  if (agent === 'coder') {
    if (activeAgent === 'coder') {
      if (currentState === State.PLANNING) {
        return 'Active - Planning implementation';
      } else if (currentState === State.IMPLEMENTING) {
        return 'Active - Implementing changes';
      }
    }
    return 'Waiting for review';
  } else { // reviewer
    if (activeAgent === 'reviewer') {
      if (currentState === State.PLAN_REVIEW) {
        return 'Active - Reviewing plan';
      } else if (currentState === State.CODE_REVIEW) {
        return 'Active - Reviewing code';
      }
    }
    return 'Waiting for implementation';
  }
}

// Helper function to determine current agent for injection modal
function getCurrentAgentForInjection(currentState: State): string {
  // Bean Counter is active during BEAN_COUNTING, or just finished if in PLANNING
  if (currentState === State.BEAN_COUNTING || currentState === State.PLANNING) {
    return 'Bean Counter';
  }
  // Coder is active during PLANNING/IMPLEMENTING, or just finished if in CODE_REVIEW
  if (currentState === State.IMPLEMENTING || currentState === State.CODE_REVIEW) {
    return 'Coder';
  }
  // Reviewer is active during PLAN_REVIEW/CODE_REVIEW
  return 'Reviewer';
}

// Execution Layout Component - handles TASK_EXECUTING with dynamic two-pane view
export const ExecutionLayout: React.FC<ExecutionLayoutProps> = ({ taskStateMachine, commandBus, onFullscreen }) => {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 120;
  const terminalHeight = stdout?.rows || 40;

  // Get execution state machine
  const executionStateMachine = taskStateMachine.getExecutionStateMachine();

  // React state mirroring ExecutionStateMachine data (event-driven updates)
  const [currentPhase, setCurrentPhase] = useState<State>(executionStateMachine?.getCurrentState() || State.BEAN_COUNTING);
  const [beanCounterOutput, setBeanCounterOutput] = useState<string | undefined>(executionStateMachine?.getAgentOutput('bean'));
  const [coderOutput, setCoderOutput] = useState<string | undefined>(executionStateMachine?.getAgentOutput('coder'));
  const [reviewerOutput, setReviewerOutput] = useState<string | undefined>(executionStateMachine?.getAgentOutput('reviewer'));
  const [coderSummary, setCoderSummary] = useState<string | undefined>(executionStateMachine?.getSummary('coder'));
  const [reviewerSummary, setReviewerSummary] = useState<string | undefined>(executionStateMachine?.getSummary('reviewer'));
  const [needsHumanReview, setNeedsHumanReview] = useState<boolean>(executionStateMachine?.getNeedsHumanReview() || false);
  const [humanReviewContext, setHumanReviewContext] = useState<string | undefined>(executionStateMachine?.getHumanReviewContext());
  const [toolStatus, setToolStatus] = useState<ToolStatus | null>(executionStateMachine?.getToolStatus() || null);

  // Force re-render trigger for state propagation to child components (fallback mechanism)
  const [, forceUpdate] = useState({});

  // Retry modal state
  const [showRetryModal, setShowRetryModal] = React.useState(false);
  const [retryFeedback, setRetryFeedback] = React.useState("");

  // Injection modal state
  const [showInjectionModal, setShowInjectionModal] = React.useState(false);

  // Intercept Ctrl+Q/W/E for fullscreen panes
  useInput((input, key) => {
    if (key.ctrl && (input === 'q' || input === 'Q' || input === 'w' || input === 'W' || input === 'e' || input === 'E')) {
      const paneMap: { [key: string]: number } = { q: 1, Q: 1, w: 2, W: 2, e: 3, E: 3 };
      onFullscreen?.(paneMap[input]);
      return;
    }
  });

  // Subscribe to execution phase changes for injection modal
  React.useEffect(() => {
    if (!executionStateMachine) return;

    const handlePhaseChange = ({ to }: { from: State; to: State }) => {
      // Check if injection is pending
      if (!taskStateMachine.isInjectionPauseRequested()) return;

      // Don't show modal if task is complete
      if (to === State.TASK_COMPLETE) return;

      // Don't show modal if there are conflicting modals
      const isHumanReviewActive = executionStateMachine.getNeedsHumanReview();
      const isRetryModalActive = showRetryModal;
      if (isHumanReviewActive || isRetryModalActive) return;

      // Phase transition detected with pending injection → show modal
      setShowInjectionModal(true);
      taskStateMachine.clearInjectionPause();
    };

    // Subscribe to phase change events
    executionStateMachine.on('execution:phase:changed', handlePhaseChange);

    // Cleanup on unmount
    return () => {
      executionStateMachine.off('execution:phase:changed', handlePhaseChange);
    };
  }, [executionStateMachine, taskStateMachine, showRetryModal]);

  // Subscribe to execution data updates for automatic re-rendering
  React.useEffect(() => {
    if (!executionStateMachine) return;

    const handleUpdate = () => {
      if (process.env.DEBUG) {
        console.log('[ExecutionLayout.tsx] handleUpdate: updating React state from executionStateMachine');
      }
      // Update all state from executionStateMachine
      setCurrentPhase(executionStateMachine.getCurrentState());
      setBeanCounterOutput(executionStateMachine.getAgentOutput('bean'));
      setCoderOutput(executionStateMachine.getAgentOutput('coder'));
      setReviewerOutput(executionStateMachine.getAgentOutput('reviewer'));
      setCoderSummary(executionStateMachine.getSummary('coder'));
      setReviewerSummary(executionStateMachine.getSummary('reviewer'));
      setNeedsHumanReview(executionStateMachine.getNeedsHumanReview());
      setHumanReviewContext(executionStateMachine.getHumanReviewContext());
      setToolStatus(executionStateMachine.getToolStatus());
      forceUpdate({}); // Fallback mechanism (kept for backward compatibility)
    };

    // Initialize state on mount
    handleUpdate();

    // Subscribe to execution events
    executionStateMachine.on('execution:output:updated', handleUpdate);
    executionStateMachine.on('execution:summary:updated', handleUpdate);
    executionStateMachine.on('execution:phase:changed', handleUpdate);

    // Cleanup on unmount
    return () => {
      executionStateMachine.off('execution:output:updated', handleUpdate);
      executionStateMachine.off('execution:summary:updated', handleUpdate);
      executionStateMachine.off('execution:phase:changed', handleUpdate);
    };
  }, [executionStateMachine]);

  if (!executionStateMachine) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
        <Text dimColor>Initializing execution state machine...</Text>
      </Box>
    );
  }

  // Note: currentPhase, beanCounterOutput, coderOutput, reviewerOutput now come from React state (lines 99-107)
  const currentState = currentPhase; // Alias for backward compatibility with existing code

  // Calculate pane dimensions
  const isWideTerminal = terminalWidth > 120;
  const leftPanelWidth = Math.floor(terminalWidth * 0.49);
  const rightPanelWidth = Math.floor(terminalWidth * 0.49);
  // Bean Counter pane gets most of available vertical space (minus header, status panel, margins)
  const beanCounterHeight = Math.max(15, Math.floor(terminalHeight * 0.5));
  const agentPaneHeight = Math.floor(terminalHeight * 0.2);

  // Determine left and right pane content based on current state
  let leftTitle = '';
  let leftContent = '';
  let leftColor = 'gray';
  let rightTitle = '';
  let rightContent = '';
  let rightColor = 'gray';
  let statusMessage = '';

  // Left pane: Always show latest Bean Counter chunk
  leftTitle = '🧮 Bean Counter Chunk';
  leftContent = currentState === State.BEAN_COUNTING ? 'Bean Counting!' : (beanCounterOutput || 'Determining work chunk...');
  leftColor = 'cyan';

  // Status message based on execution state - includes tool status when active
  const baseStatusMessage = (() => {
    switch (currentState) {
      case State.BEAN_COUNTING:
        return 'Bean Counter is breaking down work into implementable chunks';
      case State.PLANNING:
        return 'Coder is proposing implementation approach';
      case State.PLAN_REVIEW:
        return 'Reviewer is evaluating the proposed approach';
      case State.IMPLEMENTING:
        return 'Coder is implementing the approved plan';
      case State.CODE_REVIEW:
        return 'Reviewer is validating the implementation';
      case State.TASK_COMPLETE:
        return 'All chunks implemented and approved';
      default:
        return 'Processing...';
    }
  })();

  // Merge tool status into status message when active
  if (toolStatus) {
    statusMessage = `${baseStatusMessage} → ${toolStatus.tool}: ${toolStatus.summary}`;
  } else {
    statusMessage = baseStatusMessage;
  }

  // Handle injection modal submit
  const handleInjectionSubmit = (content: string) => {
    taskStateMachine.setPendingInjection(content);
    setShowInjectionModal(false);
  };

  // Handle injection modal cancel
  const handleInjectionCancel = () => {
    setShowInjectionModal(false);
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      {/* Two-pane layout */}
      <Box
        flexDirection={isWideTerminal ? "row" : "column"}
        marginBottom={1}
      >
        {/* Left Panel - Bean Counter */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
          width={isWideTerminal ? leftPanelWidth : undefined}
          marginRight={isWideTerminal ? 1 : 0}
          marginBottom={isWideTerminal ? 0 : 1}
        >
          <Box justifyContent="space-between">
            <Box>
              <StatusIndicator agent="bean" isActive={currentState === State.BEAN_COUNTING} />
              <Text color={leftColor} bold>{leftTitle}</Text>
            </Box>
            <Text dimColor>[Q]</Text>
          </Box>
          <Box marginTop={1}>
            <Text wrap="wrap">{truncateContent(leftContent, beanCounterHeight).display}</Text>
          </Box>
        </Box>

        {/* Right Panel - Split into Coder (top) and Reviewer (bottom) */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
          width={isWideTerminal ? rightPanelWidth : undefined}
        >
          {/* Coder Section */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={getActiveAgent(currentState) === 'coder' ? 'green' : 'gray'}
            paddingX={1}
            marginBottom={1}
          >
            <Box justifyContent="space-between">
              <Box>
                <StatusIndicator agent="coder" isActive={getActiveAgent(currentState) === 'coder'} />
                <Text color={getActiveAgent(currentState) === 'coder' ? 'green' : 'gray'} bold>
                  🤖 Coder
                </Text>
              </Box>
              <Text dimColor>[W]</Text>
            </Box>
            {getActiveAgent(currentState) === 'coder' && (
              <Box marginTop={1}>
                <Text dimColor>{getAgentStatusText('coder', currentState)}</Text>
              </Box>
            )}
            {getActiveAgent(currentState) !== 'coder' && executionStateMachine.getSummary('coder') && (
              <MarkdownText>{executionStateMachine.getSummary('coder') || ''}</MarkdownText>
            )}
          </Box>

          {/* Reviewer Section */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={getActiveAgent(currentState) === 'reviewer' ? 'yellow' : 'gray'}
            paddingX={1}
          >
            <Box justifyContent="space-between">
              <Box>
                <StatusIndicator agent="reviewer" isActive={getActiveAgent(currentState) === 'reviewer'} />
                <Text color={getActiveAgent(currentState) === 'reviewer' ? 'yellow' : 'gray'} bold>
                  👀 Reviewer
                </Text>
              </Box>
              <Text dimColor>[E]</Text>
            </Box>
            {getActiveAgent(currentState) === 'reviewer' && (
              <Box marginTop={1}>
                <Text dimColor>{getAgentStatusText('reviewer', currentState)}</Text>
              </Box>
            )}
            {getActiveAgent(currentState) !== 'reviewer' && executionStateMachine.getSummary('reviewer') && (
              <MarkdownText>{executionStateMachine.getSummary('reviewer') || ''}</MarkdownText>
            )}
          </Box>
        </Box>
      </Box>

      {/* Status Panel */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={executionStateMachine.getNeedsHumanReview() ? "yellow" : "blue"}
        paddingX={1}
      >
        {/* Tool status display */}
        {toolStatus && (
          <Box marginBottom={1}>
            <Text color="cyan">
              <Spinner isActive={!!toolStatus} /> [{toolStatus.agent}] → {toolStatus.tool}: {toolStatus.summary}
            </Text>
          </Box>
        )}

        <Text>{statusMessage}</Text>
        <Box>
          <Text dimColor>State: {currentState}</Text>
          {taskStateMachine.hasPendingInjection() && (
            <Text dimColor> | 🎯 Injection Pending (Next Agent)</Text>
          )}
        </Box>

        {/* Human Review Menu */}
        {executionStateMachine.getNeedsHumanReview() && (
          <Box flexDirection="column" marginTop={1}>
            <Text color="yellow" bold>⚠ Human Review Required</Text>
            <MarkdownText>{executionStateMachine.getHumanReviewContext() || ''}</MarkdownText>
            <Box marginTop={1}>
              <SelectInput
                items={[
                  { label: 'Approve - Continue with implementation', value: 'approve' },
                  { label: 'Retry - Provide feedback for revision', value: 'retry' },
                  { label: 'Reject - Skip this chunk', value: 'reject' }
                ]}
                onSelect={async (item) => {
                  if (item.value === 'approve') {
                    await commandBus.sendCommand({ type: 'humanreview:approve', feedback: '' });
                    executionStateMachine.clearHumanReview();
                  } else if (item.value === 'retry') {
                    setShowRetryModal(true);
                  } else if (item.value === 'reject') {
                    await commandBus.sendCommand({ type: 'humanreview:reject', feedback: 'User chose to skip this chunk' });
                    executionStateMachine.clearHumanReview();
                  }
                }}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* Retry Feedback Modal */}
      {showRetryModal && (
        <TextInputModal
          title="Provide Retry Feedback"
          placeholder="Describe what needs to be fixed..."
          onSubmit={async (feedbackText) => {
            await commandBus.sendCommand({ type: 'humanreview:retry', feedback: feedbackText });
            executionStateMachine?.clearHumanReview();
            setShowRetryModal(false);
            setRetryFeedback("");
          }}
          onCancel={() => {
            setShowRetryModal(false);
            setRetryFeedback("");
          }}
        />
      )}

      {/* Injection Modal - for dynamic prompt injection */}
      {showInjectionModal && (() => {
        const currentChunk = executionStateMachine.getCurrentChunk();
        const agentType = getCurrentAgentForInjection(currentState);
        const chunkDesc = currentChunk?.description || 'Coordinating work chunks';
        const modalTitle = `Dynamic Prompt Injection → ${agentType}`;
        const contextInfo = `Chunk: ${chunkDesc.substring(0, 60)}${chunkDesc.length > 60 ? '...' : ''}`;

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

export default ExecutionLayout;
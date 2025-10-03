import React from 'react';
import { Text, Box, useStdout, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { TaskStateMachine } from '../../../task-state-machine.js';
import { State } from '../../../state-machine.js';
import { StatusIndicator } from './StatusIndicator.js';
import type { HumanInteractionResult } from '../../../types.js';
import { TextInputModal } from './TextInputModal.js';
import { Spinner } from './Spinner.js';

// TypeScript interface for ExecutionLayout props
interface ExecutionLayoutProps {
  taskStateMachine: TaskStateMachine;
  onHumanReviewDecision?: (decision: Promise<HumanInteractionResult>) => void;
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

// Execution Layout Component - handles TASK_EXECUTING with dynamic two-pane view
export const ExecutionLayout: React.FC<ExecutionLayoutProps> = ({ taskStateMachine, onHumanReviewDecision, onFullscreen }) => {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 120;
  const terminalHeight = stdout?.rows || 40;

  // Local state for human review decision resolver
  const [humanReviewResolver, setHumanReviewResolver] = React.useState<((value: HumanInteractionResult) => void) | null>(null);

  // Retry modal state
  const [showRetryModal, setShowRetryModal] = React.useState(false);
  const [retryFeedback, setRetryFeedback] = React.useState("");

  // Get execution state machine
  const executionStateMachine = taskStateMachine.getExecutionStateMachine();

  // Get tool status to determine if spinner should animate
  const toolStatus = executionStateMachine?.getToolStatus();

  // Intercept Ctrl+Q/W/E for fullscreen panes
  useInput((input, key) => {
    if (key.ctrl && (input === 'q' || input === 'Q' || input === 'w' || input === 'W' || input === 'e' || input === 'E')) {
      const paneMap: { [key: string]: number } = { q: 1, Q: 1, w: 2, W: 2, e: 3, E: 3 };
      onFullscreen?.(paneMap[input]);
      return;
    }
  });

  // Wire up human review decision when callback is provided
  React.useEffect(() => {
    if (onHumanReviewDecision && executionStateMachine?.getNeedsHumanReview()) {
      // Create a dummy promise to get the resolver attached by orchestrator
      const dummyPromise = new Promise<HumanInteractionResult>((resolve) => {
        // This resolve will be replaced by the orchestrator
      });

      // Call the callback which will attach the real resolver
      onHumanReviewDecision(dummyPromise);

      // Extract the resolver that was attached by orchestrator
      const resolver = (dummyPromise as any).resolve;
      if (resolver) {
        setHumanReviewResolver(() => resolver);
      }
    }
  }, [onHumanReviewDecision, executionStateMachine?.getNeedsHumanReview()]);

  if (!executionStateMachine) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
        <Text dimColor>Initializing execution state machine...</Text>
      </Box>
    );
  }

  const currentState = executionStateMachine.getCurrentState();
  const beanCounterOutput = executionStateMachine.getAgentOutput('bean');
  const coderOutput = executionStateMachine.getAgentOutput('coder');
  const reviewerOutput = executionStateMachine.getAgentOutput('reviewer');

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

  // Status message based on execution state
  switch (currentState) {
    case State.BEAN_COUNTING:
      statusMessage = 'Bean Counter is breaking down work into implementable chunks';
      break;
    case State.PLANNING:
      statusMessage = 'Coder is proposing implementation approach';
      break;
    case State.PLAN_REVIEW:
      statusMessage = 'Reviewer is evaluating the proposed approach';
      break;
    case State.IMPLEMENTING:
      statusMessage = 'Coder is implementing the approved plan';
      break;
    case State.CODE_REVIEW:
      statusMessage = 'Reviewer is validating the implementation';
      break;
    case State.TASK_COMPLETE:
      statusMessage = 'All chunks implemented and approved';
      break;
    default:
      statusMessage = 'Processing...';
  }

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
            <Box marginTop={1}>
              <Text dimColor>{getAgentStatusText('coder', currentState)}</Text>
            </Box>
            {getActiveAgent(currentState) !== 'coder' && (
              <Text wrap="wrap">{executionStateMachine.getSummary('coder') || 'Generating summary...'}</Text>
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
            <Box marginTop={1}>
              <Text dimColor>{getAgentStatusText('reviewer', currentState)}</Text>
            </Box>
            {getActiveAgent(currentState) !== 'reviewer' && (
              <Text wrap="wrap">{executionStateMachine.getSummary('reviewer') || 'Generating summary...'}</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Status Panel */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="blue"
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
        <Text dimColor>State: {currentState}</Text>

        {/* Human Review Menu */}
        {executionStateMachine.getNeedsHumanReview() && humanReviewResolver && (
          <Box flexDirection="column" marginTop={1}>
            <Text color="yellow" bold>⚠ Human Review Required</Text>
            <Text>{executionStateMachine.getHumanReviewContext()}</Text>
            <Box marginTop={1}>
              <SelectInput
                items={[
                  { label: 'Approve - Continue with implementation', value: 'approve' },
                  { label: 'Retry - Provide feedback for revision', value: 'retry' },
                  { label: 'Reject - Skip this chunk', value: 'reject' }
                ]}
                onSelect={(item) => {
                  if (item.value === 'approve') {
                    humanReviewResolver({ decision: 'approve' });
                    executionStateMachine.clearHumanReview();
                    setHumanReviewResolver(null);
                  } else if (item.value === 'retry') {
                    setShowRetryModal(true);
                  } else if (item.value === 'reject') {
                    humanReviewResolver({ decision: 'reject' });
                    executionStateMachine.clearHumanReview();
                    setHumanReviewResolver(null);
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
          onSubmit={(feedbackText) => {
            if (humanReviewResolver) {
              humanReviewResolver({ decision: 'retry', feedback: feedbackText });
              setHumanReviewResolver(null);
              executionStateMachine?.clearHumanReview();
            }
            setShowRetryModal(false);
            setRetryFeedback("");
          }}
          onCancel={() => {
            setShowRetryModal(false);
            setRetryFeedback("");
          }}
        />
      )}
    </Box>
  );
};

export default ExecutionLayout;
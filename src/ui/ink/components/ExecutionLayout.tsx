import React from 'react';
import { Text, Box, useStdout } from 'ink';
import { TaskStateMachine } from '../../../task-state-machine.js';
import { State } from '../../../state-machine.js';

// TypeScript interface for ExecutionLayout props
interface ExecutionLayoutProps {
  taskStateMachine: TaskStateMachine;
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
export const ExecutionLayout: React.FC<ExecutionLayoutProps> = ({ taskStateMachine }) => {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 120;
  const terminalHeight = stdout?.rows || 40;

  // Get execution state machine
  const executionStateMachine = taskStateMachine.getExecutionStateMachine();

  // Blinking animation state for status indicators
  const [blinkOn, setBlinkOn] = React.useState(true);

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      setBlinkOn((prev) => !prev);
    }, 750);

    return () => clearInterval(intervalId);
  }, []);

  if (!executionStateMachine) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
        <Box marginBottom={1}>
          <Text color="yellow" bold>⚡ Execution Phase</Text>
        </Box>
        <Text dimColor>Initializing execution state machine...</Text>
      </Box>
    );
  }

  const currentState = executionStateMachine.getCurrentState();
  const beanCounterOutput = executionStateMachine.getAgentOutput('bean');
  const coderOutput = executionStateMachine.getAgentOutput('coder');
  const reviewerOutput = executionStateMachine.getAgentOutput('reviewer');

  // Helper function to get status indicator with animation and color
  const getStatusIndicator = (agent: 'coder' | 'reviewer'): React.ReactElement => {
    const activeAgent = getActiveAgent(currentState);
    const isActive = activeAgent === agent;

    // Determine color based on agent type and active state
    let color: string;
    if (isActive) {
      color = agent === 'coder' ? 'green' : 'yellow';
    } else {
      color = 'gray';
    }

    // Blink between filled and empty circle when active
    const symbol = isActive && blinkOn ? '● ' : '○ ';

    return <Text color={color}>{symbol}</Text>;
  };

  // Calculate pane dimensions
  const isWideTerminal = terminalWidth > 120;
  const panelWidth = Math.floor(terminalWidth * 0.4);
  const paneContentHeight = Math.floor((terminalHeight * 0.6) / 2) - 4;

  // Determine left and right pane content based on current state
  let leftTitle = '';
  let leftContent = '';
  let leftColor = 'gray';
  let rightTitle = '';
  let rightContent = '';
  let rightColor = 'gray';
  let statusMessage = '';

  switch (currentState) {
    case State.BEAN_COUNTING:
      leftTitle = '📋 Previous Review';
      leftContent = reviewerOutput || 'No previous review yet';
      leftColor = 'magenta';
      rightTitle = '🧮 Bean Counter';
      rightContent = beanCounterOutput || 'Determining work chunk...';
      rightColor = 'cyan';
      statusMessage = 'Bean Counter is breaking down work into implementable chunks';
      break;

    case State.PLANNING:
      leftTitle = '🧮 Bean Counter Chunk';
      leftContent = beanCounterOutput || 'Work chunk defined';
      leftColor = 'cyan';
      rightTitle = '🤖 Coder Proposal';
      rightContent = coderOutput || 'Planning implementation...';
      rightColor = 'green';
      statusMessage = 'Coder is proposing implementation approach';
      break;

    case State.PLAN_REVIEW:
      leftTitle = '🤖 Coder Proposal';
      leftContent = coderOutput || 'Implementation proposed';
      leftColor = 'green';
      rightTitle = '👀 Reviewer Feedback';
      rightContent = 'Reviewing proposed approach...';
      rightColor = 'yellow';
      statusMessage = 'Reviewer is evaluating the proposed approach';
      break;

    case State.IMPLEMENTING:
      leftTitle = '🤖 Coder Proposal';
      leftContent = coderOutput || 'Implementation plan';
      leftColor = 'green';
      rightTitle = '⚙️ Implementation';
      rightContent = 'Applying changes to codebase...';
      rightColor = 'blue';
      statusMessage = 'Coder is implementing the approved plan';
      break;

    case State.CODE_REVIEW:
      leftTitle = '🤖 Coder Changes';
      leftContent = coderOutput || 'Changes implemented';
      leftColor = 'green';
      rightTitle = '👀 Reviewer Verdict';
      rightContent = reviewerOutput || 'Reviewing code changes...';
      rightColor = 'yellow';
      statusMessage = 'Reviewer is validating the implementation';
      break;

    case State.TASK_COMPLETE:
      leftTitle = '✅ Final Review';
      leftContent = reviewerOutput || 'All work approved';
      leftColor = 'green';
      rightTitle = '🎉 Complete';
      rightContent = 'Task execution completed successfully!';
      rightColor = 'green';
      statusMessage = 'All chunks implemented and approved';
      break;

    default:
      leftTitle = 'Status';
      leftContent = 'Execution in progress...';
      leftColor = 'gray';
      rightTitle = 'Progress';
      rightContent = `Current state: ${currentState}`;
      rightColor = 'gray';
      statusMessage = 'Processing...';
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Box marginBottom={1}>
        <Text color="yellow" bold>⚡ Execution Phase</Text>
      </Box>

      {/* Two-pane layout */}
      <Box
        flexDirection={isWideTerminal ? "row" : "column"}
        marginBottom={1}
      >
        {/* Left Panel */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={leftColor}
          padding={1}
          width={isWideTerminal ? panelWidth : undefined}
          marginRight={isWideTerminal ? 1 : 0}
          marginBottom={isWideTerminal ? 0 : 1}
        >
          <Text color={leftColor} bold>{leftTitle}</Text>
          <Box marginTop={1}>
            <Text wrap="wrap">{truncateContent(leftContent, paneContentHeight).display}</Text>
          </Box>
        </Box>

        {/* Right Panel - Split into Coder (top) and Reviewer (bottom) */}
        <Box
          flexDirection="column"
          width={isWideTerminal ? panelWidth : undefined}
        >
          {/* Coder Section (Top 50%) */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={getActiveAgent(currentState) === 'coder' ? 'green' : 'gray'}
            padding={1}
            height="50%"
            marginBottom={1}
          >
            <Box marginBottom={1}>
              {getStatusIndicator('coder')}
              <Text color={getActiveAgent(currentState) === 'coder' ? 'green' : 'gray'} bold>
                🤖 Coder
              </Text>
            </Box>
            <Box marginBottom={1}>
              <Text dimColor>{getAgentStatusText('coder', currentState)}</Text>
            </Box>
            <Box>
              <Text wrap="wrap">{executionStateMachine.getSummary('coder') || 'Generating summary...'}</Text>
            </Box>
          </Box>

          {/* Reviewer Section (Bottom 50%) */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={getActiveAgent(currentState) === 'reviewer' ? 'yellow' : 'gray'}
            padding={1}
            height="50%"
          >
            <Box marginBottom={1}>
              {getStatusIndicator('reviewer')}
              <Text color={getActiveAgent(currentState) === 'reviewer' ? 'yellow' : 'gray'} bold>
                👀 Reviewer
              </Text>
            </Box>
            <Box marginBottom={1}>
              <Text dimColor>{getAgentStatusText('reviewer', currentState)}</Text>
            </Box>
            <Box>
              <Text wrap="wrap">{executionStateMachine.getSummary('reviewer') || 'Generating summary...'}</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Status Panel */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="blue"
        padding={1}
      >
        <Text color="blue" bold>⚡ Live Activity</Text>
        <Box marginTop={1}>
          <Text>{statusMessage}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>State: {currentState}</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default ExecutionLayout;
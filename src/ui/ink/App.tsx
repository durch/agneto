import React, { useState } from 'react';
import { Text, Box, useStdout, useInput } from 'ink';
import { TaskStateMachine, TaskState } from '../../task-state-machine.js';
import { PlanningLayout } from './components/PlanningLayout.js';
import { ExecutionLayout } from './components/ExecutionLayout.js';
import { FullscreenModal } from './components/FullscreenModal.js';
import { TaskView } from './components/TaskView.js';
import type { PlanFeedback } from '../planning-interface.js';
import type { RefinementFeedback } from '../refinement-interface.js';
import type { SuperReviewerDecision, HumanInteractionResult, MergeApprovalDecision } from '../../types.js';

// TypeScript interface for component props
interface AppProps {
  taskStateMachine: TaskStateMachine;
  onPlanFeedback?: (feedback: PlanFeedback) => void;
  onRefinementFeedback?: (feedback: RefinementFeedback) => void;
  onAnswerCallback?: (answer: string) => void;
  onSuperReviewerDecision?: (decision: SuperReviewerDecision) => void;
  onHumanReviewDecision?: (decision: Promise<HumanInteractionResult>) => void;
  onMergeApprovalCallback?: (decision: Promise<MergeApprovalDecision>) => void;
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
    case TaskState.TASK_GARDENING:
      return 'Updating Documentation';
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
    case TaskState.TASK_GARDENING:
      return 'cyan';
    case TaskState.TASK_COMPLETE:
      return 'green';
    case TaskState.TASK_ABANDONED:
      return 'red';
    default:
      return 'gray';
  }
};

// Main App component
export const App: React.FC<AppProps> = ({ taskStateMachine, onPlanFeedback, onRefinementFeedback, onAnswerCallback, onSuperReviewerDecision, onHumanReviewDecision, onMergeApprovalCallback }) => {
  // Get terminal dimensions for responsive layout
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows || 40; // Default to 40 if unavailable
  const terminalWidth = stdout?.columns || 120; // Default to 120 if unavailable

  // Global modal state for plan viewer
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // Global modal state for task description viewer
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Modal state for execution phase agent outputs
  const [viewMode, setViewMode] = useState<'split' | 'fullscreen'>('split');
  const [fullscreenContent, setFullscreenContent] = useState<{title: string, text: string} | null>(null);

  // Force re-render trigger for state propagation to child components
  const [, forceUpdate] = useState({});

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

    // Handle Ctrl+P to toggle plan modal
    if (key.ctrl && (input === 'p' || input === 'P')) {
      const planMd = taskStateMachine.getPlanMd();
      if (planMd) {
        setIsPlanModalOpen(true);
      }
      return;
    }

    // Handle Ctrl+I to trigger dynamic prompt injection pause
    // This sets a pause flag that allows user to inject additional context mid-execution
    if (key.ctrl && (input === 'i' || input === 'I')) {
      // Check if there's already a pending injection
      if (taskStateMachine.hasPendingInjection()) {
        // Override pattern: user wants to replace the pending injection
        if (process.env.DEBUG) {
          console.log('Injection override: replacing pending injection');
        }
        // Clear and re-trigger the pause flag to immediately show modal in layouts
        taskStateMachine.clearInjectionPause();
        taskStateMachine.requestInjectionPause();
      } else {
        // Normal case: first injection request
        taskStateMachine.requestInjectionPause();
      }
      forceUpdate({}); // Trigger re-render to propagate state to child components
      return;
    }

    // Handle pane fullscreen shortcuts (Ctrl+Q/W/E)
    if (key.ctrl && (input === 'q' || input === 'Q' || input === 'w' || input === 'W' || input === 'e' || input === 'E')) {
      const paneMap: { [key: string]: number } = { q: 1, Q: 1, w: 2, W: 2, e: 3, E: 3 };
      handleFullscreen(paneMap[input]);
      return;
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

  // Get pane content by number based on current state
  const getPaneContent = (paneNum: number): { title: string; content: string } | null => {
    const currentState = taskStateMachine.getCurrentState();

    // Execution phase: 3 numbered panes
    if (currentState === TaskState.TASK_EXECUTING) {
      const executionStateMachine = taskStateMachine.getExecutionStateMachine();
      switch (paneNum) {
        case 1:
          return {
            title: '🧮 Bean Counter Chunk',
            content: executionStateMachine?.getAgentOutput('bean') || 'Determining work chunk...'
          };
        case 2:
          return {
            title: '🤖 Coder',
            content: executionStateMachine?.getAgentOutput('coder') || 'Processing...'
          };
        case 3:
          return {
            title: '👀 Reviewer',
            content: executionStateMachine?.getAgentOutput('reviewer') || 'Processing...'
          };
        default:
          return null;
      }
    }

    // Planning phases: 2 numbered panes
    if (
      currentState === TaskState.TASK_REFINING ||
      currentState === TaskState.TASK_PLANNING ||
      currentState === TaskState.TASK_CURMUDGEONING ||
      currentState === TaskState.TASK_SUPER_REVIEWING
    ) {
      const context = taskStateMachine.getContext();
      const planMd = taskStateMachine.getPlanMd();
      const pendingRefinement = taskStateMachine.getPendingRefinement();
      const curmudgeonFeedback = taskStateMachine.getCurmudgeonFeedback();
      const superReviewResult = taskStateMachine.getSuperReviewResult();
      const previousCurmudgeonFeedback = currentState === TaskState.TASK_PLANNING && curmudgeonFeedback;

      if (paneNum === 1) {
        // Left pane - dynamic based on state
        if (currentState === TaskState.TASK_SUPER_REVIEWING) {
          return { title: '📋 Original Plan', content: planMd || 'No plan available' };
        } else if (currentState === TaskState.TASK_CURMUDGEONING) {
          return { title: '📋 Current Plan', content: planMd || 'No plan available' };
        } else if (previousCurmudgeonFeedback) {
          return { title: '🧐 Previous Feedback', content: curmudgeonFeedback || '' };
        } else if (currentState === TaskState.TASK_REFINING && pendingRefinement) {
          return { title: '📝 Refined Task', content: pendingRefinement.raw || pendingRefinement.goal || '' };
        } else {
          return { title: '📝 Refined Task', content: context.taskToUse || context.humanTask || 'No task description' };
        }
      } else if (paneNum === 2) {
        // Right pane - dynamic based on state
        if (currentState === TaskState.TASK_SUPER_REVIEWING) {
          const summary = superReviewResult?.summary || 'Performing final quality check...';
          const issues = superReviewResult?.issues?.map((issue, idx) => `• ${issue}`).join('\n') || '';
          const verdict = superReviewResult?.verdict === 'approve' ? '✅ Approved' : '⚠️ Needs Human Review';
          return {
            title: '🔍 Quality Check Results',
            content: `${summary}\n\n${issues ? `Issues Found:\n${issues}\n\n` : ''}Verdict: ${verdict}`
          };
        } else if (currentState === TaskState.TASK_CURMUDGEONING) {
          return { title: '🧐 Curmudgeon Feedback', content: curmudgeonFeedback || 'Reviewing plan for over-engineering...' };
        } else if (previousCurmudgeonFeedback) {
          return { title: '📋 New Plan', content: planMd || 'Creating simplified plan...' };
        } else {
          return { title: '📋 Plan Content', content: planMd || 'Creating strategic plan...' };
        }
      }
    }

    return null;
  };

  // Fullscreen handler for pane numbers - can be called from child components
  const handleFullscreen = (paneNum: number) => {
    const paneContent = getPaneContent(paneNum);
    if (paneContent) {
      setFullscreenContent({
        title: paneContent.title,
        text: paneContent.content
      });
      setViewMode('fullscreen');
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

  // Render task description modal if open
  if (isTaskModalOpen) {
    const taskInfo = getTaskInfo();

    return (
      <TaskView
        taskDescription={taskInfo.description}
        onClose={() => setIsTaskModalOpen(false)}
        terminalHeight={terminalHeight}
        terminalWidth={terminalWidth}
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
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1} height={terminalHeight}>
      {/* Header Section */}
      <Box marginBottom={1}>
        <Text bold>🧲 Agneto</Text>
        <Text dimColor> | Task ID: </Text>
        <Text>{taskInfo.taskId}</Text>
        <Text dimColor> | Phase: </Text>
        <Text color={phase.color} bold>{phase.displayName}</Text>
      </Box>

      {/* Status Section - Ready for future phase-based content */}
      {(phase.state === TaskState.TASK_REFINING ||
        phase.state === TaskState.TASK_PLANNING ||
        phase.state === TaskState.TASK_CURMUDGEONING ||
        phase.state === TaskState.TASK_SUPER_REVIEWING ||
        phase.state === TaskState.TASK_GARDENING ||
        phase.state === TaskState.TASK_FINALIZING) ? (
        <PlanningLayout
          currentState={phase.state}
          taskStateMachine={taskStateMachine}
          onPlanFeedback={onPlanFeedback}
          onRefinementFeedback={onRefinementFeedback}
          onAnswerCallback={onAnswerCallback}
          onSuperReviewerDecision={onSuperReviewerDecision}
          onMergeApprovalCallback={onMergeApprovalCallback}
          onFullscreen={handleFullscreen}
          terminalHeight={terminalHeight}
          terminalWidth={terminalWidth}
          availableContentHeight={availableContentHeight}
          gardenerResult={taskStateMachine.getGardenerResult()}
        />
      ) : phase.state === TaskState.TASK_EXECUTING ? (
        <ExecutionLayout
          taskStateMachine={taskStateMachine}
          onHumanReviewDecision={onHumanReviewDecision}
          onFullscreen={handleFullscreen}
        />
      ) : (
        <Text dimColor italic>
          Phase-specific content will be displayed here...
        </Text>
      )}

      {/* Keyboard Shortcuts Footer */}
      <Box marginTop={1} paddingX={1}>
        <Text dimColor>
          [Ctrl+P] Plan  [Ctrl+T] Task  [Ctrl+I] Inject  [Ctrl+Q/W/E] Fullscreen  [Esc] Close
        </Text>
      </Box>
    </Box>
  );
};

export default App;
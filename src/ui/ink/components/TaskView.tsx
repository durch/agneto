import React from 'react';
import { Box, Text, useInput } from 'ink';
import { MarkdownText } from './MarkdownText.js';

export interface TaskViewProps {
  taskDescription: string;
  onClose: () => void;
  terminalHeight: number;
  terminalWidth: number;
}

/**
 * TaskView Component
 *
 * Displays the task description in a fullscreen modal view that takes up the entire terminal.
 * User can press Esc to close and return to the previous view.
 */
export const TaskView: React.FC<TaskViewProps> = ({
  taskDescription,
  onClose,
  terminalHeight,
  terminalWidth
}) => {
  // Handle keyboard input for closing
  useInput((input, key) => {
    if (key.escape) {
      onClose();
    }
  });

  // Calculate modal sizing
  // Use full terminal dimensions to match main Agneto TUI
  const modalWidth = terminalWidth;

  // Calculate content line count
  const contentLines = taskDescription.split('\n').length;
  const overhead = 6; // Title bar (2) + margins (2) + borders (2)

  // Use larger of: content height OR full terminal height
  const minModalHeight = terminalHeight;
  const contentBasedHeight = contentLines + overhead;
  const modalHeight = Math.max(contentBasedHeight, minModalHeight);

  const contentHeight = modalHeight - overhead;

  return (
    <Box
      flexDirection="column"
      width={modalWidth}
      height={modalHeight}
      borderStyle="double"
      borderColor="cyan"
      padding={1}
    >
      {/* Title Bar */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">📝 Task Description</Text>
        <Text dimColor>[Esc to close ✕]</Text>
      </Box>

      {/* Content Area - Rendered with markdown formatting */}
      <Box
        flexDirection="column"
        flexGrow={1}
        height={contentHeight}
      >
        <MarkdownText maxHeight={0}>{taskDescription}</MarkdownText>
      </Box>
    </Box>
  );
};

export default TaskView;

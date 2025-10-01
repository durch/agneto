import React from 'react';
import { Box, Text, useInput } from 'ink';
import { MarkdownText } from './MarkdownText.js';

export interface FullscreenModalProps {
  title: string;
  content: string;
  terminalHeight: number;
  terminalWidth: number;
  onClose: () => void;
}

/**
 * FullscreenModal Component
 *
 * Displays content in a fullscreen modal view that takes up the entire terminal.
 * User can press Esc to close and return to the previous view.
 */
export const FullscreenModal: React.FC<FullscreenModalProps> = ({
  title,
  content,
  terminalHeight,
  terminalWidth,
  onClose
}) => {
  // Handle keyboard input for closing
  useInput((input, key) => {
    if (key.escape) {
      onClose();
    }
  });

  // Calculate modal sizing
  // Width: 80% of terminal (feels spacious)
  // Height: Grow to fit content, or use 90% of terminal (whichever is larger)
  const modalWidth = Math.min(Math.floor(terminalWidth * 0.80));

  // Calculate content line count
  const contentLines = content.split('\n').length;
  const overhead = 6; // Title bar (2) + margins (2) + borders (2)

  // Use larger of: content height OR terminal height
  const minModalHeight = Math.floor(terminalHeight * 0.90);
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
        <Text bold color="cyan">{title}</Text>
        {/* <Text dimColor>{`Terminal Size: ${terminalWidth} x ${terminalHeight}`}</Text> */}
        <Text dimColor>[Esc to close ✕]</Text>

      </Box>

      {/* Content Area - Rendered with markdown formatting */}
      <Box
        flexDirection="column"
        flexGrow={1}
        height={contentHeight}
      >
        <MarkdownText>{content}</MarkdownText>
      </Box>
    </Box>
  );
};

export default FullscreenModal;
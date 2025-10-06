import React from 'react';
import { Text, Box } from 'ink';
import { prettyPrint } from '../../pretty.js';

/**
 * Ink-native markdown renderer using prettyPrint
 * Renders markdown using chalk ANSI codes via prettyPrint, which Ink automatically displays
 */

interface MarkdownTextProps {
  children: string;
  maxLines?: number;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ children, maxLines }) => {
  // Use prettyPrint to format markdown with chalk ANSI codes
  const formatted = prettyPrint(children, { width: 120 });
  const lines = formatted.split('\n');
  const displayLines = maxLines ? lines.slice(0, maxLines) : lines;
  const isTruncated = maxLines && lines.length > maxLines;
  const content = displayLines.join('\n');

  return (
    <Box flexDirection="column">
      <Text>{content}</Text>
      {isTruncated && (
        <Box marginTop={1}>
          <Text dimColor>...</Text>
        </Box>
      )}
    </Box>
  );
};

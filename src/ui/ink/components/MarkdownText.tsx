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
  maxHeight?: number;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({ children, maxLines, maxHeight }) => {
  const formatted = prettyPrint(children, { width: 120 });
  const lines = formatted.split('\n');

  const normalizedMaxHeight = typeof maxHeight === 'number' && maxHeight > 0 ? Math.floor(maxHeight) : undefined;
  const limit = maxLines ?? normalizedMaxHeight;

  const displayLines = limit ? lines.slice(0, limit) : lines;
  const isTruncated = typeof limit === 'number' && lines.length > limit;
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

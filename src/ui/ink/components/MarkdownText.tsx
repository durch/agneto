import React from "react";
import { Text, Box } from "ink";
import { prettyPrint } from "../../pretty.js";

/**
 * Ink-native markdown renderer using prettyPrint
 * Renders markdown using chalk ANSI codes via prettyPrint, which Ink automatically displays
 */

interface MarkdownTextProps {
  children: string;
  maxHeight: number;
}

export const MarkdownText: React.FC<MarkdownTextProps> = ({
  children,
  maxHeight,
}) => {
  const formatted = prettyPrint(children, { width: 100 });
  const lines = formatted.split("\n");

  let displayLines = lines;
  let isTruncated = false;

  if (maxHeight !== 0) {
    const limit = Math.round(maxHeight * 0.75);
    displayLines = lines.slice(0, limit);
    isTruncated = typeof limit === "number" && lines.length > limit;
  }

  const content = displayLines.join("\n");

  return (
    <Box flexDirection="column">
      <Text>{content}</Text>
      {isTruncated && (
        <Box marginTop={1}>
          <Text dimColor>
            Lines: {displayLines.length}/{lines.length} ...
          </Text>
        </Box>
      )}
    </Box>
  );
};

import React, { useMemo } from "react";
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

const MarkdownTextComponent: React.FC<MarkdownTextProps> = ({
  children,
  maxHeight,
}) => {
  console.log('[MarkdownText] Render:', { childrenLength: children.length, maxHeight });

  const lines = useMemo(
    () => prettyPrint(children, { width: 100 }).split("\n"),
    [children]
  );

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

export const MarkdownText = React.memo(MarkdownTextComponent);

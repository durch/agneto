import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

export interface TextInputModalProps {
  title: string;
  placeholder: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  width?: number;  // Optional width for responsive sizing
  height?: number; // Optional height for responsive sizing
  content?: string; // Optional content to show above the input
}

/**
 * TextInputModal Component
 *
 * A modal for text input using ink-text-input.
 *
 * Keyboard shortcuts:
 * - Enter: Submit text
 * - Escape: Cancel input
 */
export const TextInputModal: React.FC<TextInputModalProps> = ({
  title,
  placeholder,
  onSubmit,
  onCancel,
  width,
  height,
  content
}) => {
  const [text, setText] = useState<string>('');

  // Handle cancellation only - let TextInput handle submission
  useInput((input, key) => {
    // Escape: Cancel
    if (key.escape) {
      onCancel();
      return;
    }
  });

  // Calculate modal sizing - use provided dimensions or defaults
  const modalWidth = width || 80; // Use provided width or default
  const modalHeight = height || 24; // Use provided height or default

  const contentHeight = modalHeight - 6; // Subtract title, footer, borders, padding

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
        <Text dimColor>[Esc to cancel ✕]</Text>
      </Box>

      {/* Content Area with Question and Input */}
      <Box
        flexDirection="column"
        flexGrow={1}
        height={contentHeight}
        borderStyle="single"
        borderColor="gray"
        padding={1}
      >
        {/* Show content/question if provided */}
        {content && (
          <Box marginBottom={1} flexShrink={0}>
            <Text wrap="wrap">{content}</Text>
          </Box>
        )}

        {/* Text Input */}
        <Box marginTop={content ? 1 : 0}>
          <TextInput
            value={text}
            onChange={setText}
            placeholder={placeholder}
            onSubmit={() => onSubmit(text)}
            focus={true}
          />
        </Box>
      </Box>

      {/* Footer with character count and keyboard hints */}
      <Box justifyContent="space-between" marginTop={1}>
        <Text dimColor>
          [Enter] Submit  |  [Esc] Cancel
        </Text>
        <Text dimColor>{text.length} chars</Text>
      </Box>
    </Box>
  );
};

export default TextInputModal;

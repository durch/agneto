import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

export interface TextInputModalProps {
  title: string;
  placeholder: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

/**
 * TextInputModal Component
 *
 * A fullscreen modal for multi-line text input using ink-text-input.
 *
 * Keyboard shortcuts:
 * - Enter: New line (handled by TextInput)
 * - Escape: Cancel input
 * - Ctrl+Enter or Cmd+Enter: Submit text
 */
export const TextInputModal: React.FC<TextInputModalProps> = ({
  title,
  placeholder,
  onSubmit,
  onCancel
}) => {
  const [text, setText] = useState<string>('');

  // Handle submission and cancellation
  useInput((input, key) => {
    // Ctrl+Enter or Meta+Enter (Cmd on Mac): Submit
    if (key.return && (key.ctrl || key.meta)) {
      onSubmit(text);
      return;
    }

    // Escape: Cancel
    if (key.escape) {
      onCancel();
      return;
    }
  });

  // Calculate modal sizing (similar to FullscreenModal)
  // We'll use a fixed large size since we don't have terminal dimensions
  const modalWidth = 80; // Characters wide
  const modalHeight = 24; // Lines tall

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

      {/* Text Input Area */}
      <Box
        flexDirection="column"
        flexGrow={1}
        height={contentHeight}
        borderStyle="single"
        borderColor="gray"
        padding={1}
      >
        <TextInput
          value={text}
          onChange={setText}
          placeholder={placeholder}
        />
      </Box>

      {/* Footer with character count and keyboard hints */}
      <Box justifyContent="space-between" marginTop={1}>
        <Text dimColor>
          [Enter] New line  |  [Ctrl+Enter/⌘+Enter] Submit
        </Text>
        <Text dimColor>{text.length} chars</Text>
      </Box>
    </Box>
  );
};

export default TextInputModal;

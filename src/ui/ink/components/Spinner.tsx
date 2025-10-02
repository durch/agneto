import React from 'react';
import { Text } from 'ink';
import { useSpinner } from '../hooks/useSpinner.js';

interface SpinnerProps {
  isActive: boolean;
  color?: string;
}

/**
 * Spinner component that displays an animated spinner character
 *
 * Uses React.memo to prevent parent component re-renders when spinner animates.
 * Only this component re-renders every 150ms, not the entire layout.
 *
 * @param isActive - Whether the spinner should animate
 * @param color - Text color for the spinner (default: cyan)
 */
export const Spinner = React.memo<SpinnerProps>(({ isActive, color = 'cyan' }) => {
  const spinner = useSpinner(isActive);
  return <Text color={color}>{spinner}</Text>;
});

Spinner.displayName = 'Spinner';

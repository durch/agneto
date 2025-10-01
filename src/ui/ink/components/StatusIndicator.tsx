import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

interface StatusIndicatorProps {
  agent: 'bean' | 'coder' | 'reviewer';
  isActive: boolean;
}

/**
 * StatusIndicator - Self-contained animated status indicator
 *
 * Memoized component that manages its own animation state.
 * Only this component re-renders during animation, preventing
 * parent component flickering.
 */
export const StatusIndicator = React.memo<StatusIndicatorProps>(({ agent, isActive }) => {
  const [blinkOn, setBlinkOn] = useState(true);

  // Animation effect - only runs when component is active
  useEffect(() => {
    if (!isActive) {
      return; // No animation when inactive
    }

    const intervalId = setInterval(() => {
      setBlinkOn((prev) => !prev);
    }, 750);

    return () => clearInterval(intervalId);
  }, [isActive]);

  // Determine color based on agent type
  const getColor = (): string => {
    if (!isActive) return 'gray';

    switch (agent) {
      case 'bean':
        return 'cyan';
      case 'coder':
        return 'green';
      case 'reviewer':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  // Determine symbol - blink between filled and empty when active
  const symbol = isActive && blinkOn ? '● ' : '○ ';
  const color = getColor();

  return <Text color={color}>{symbol}</Text>;
});

StatusIndicator.displayName = 'StatusIndicator';

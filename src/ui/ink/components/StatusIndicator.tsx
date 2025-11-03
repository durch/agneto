import React from 'react';
import { Text } from 'ink';

interface StatusIndicatorProps {
  agent: 'bean' | 'coder' | 'reviewer';
  isActive: boolean;
}

/**
 * StatusIndicator - Static status indicator
 *
 * Memoized component that shows active/inactive state with different symbols.
 * Active: filled circle (●), Inactive: hollow circle (○)
 */
export const StatusIndicator = React.memo<StatusIndicatorProps>(({ agent, isActive }) => {
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

  // Determine symbol - filled when active, hollow when inactive
  const symbol = isActive ? '● ' : '○ ';
  const color = getColor();

  return <Text color={color}>{symbol}</Text>;
});

StatusIndicator.displayName = 'StatusIndicator';

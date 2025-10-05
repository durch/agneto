import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { TaskStateMachine } from '../../../task-state-machine.js';
import { CommandBus, type Command } from '../../command-bus.js';

interface DebugEvent {
  timestamp: string;
  type: 'EVENT' | 'COMMAND' | 'EXEC_EVENT' | 'EXEC_STATE';
  name: string;
  details?: string;
}

interface DebugOverlayProps {
  taskStateMachine: TaskStateMachine;
  commandBus: CommandBus;
  visible: boolean;
  terminalHeight: number;
  terminalWidth: number;
}

const formatTime = (): string => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const MAX_EVENTS = 20;

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  taskStateMachine,
  commandBus,
  visible,
  terminalHeight,
  terminalWidth
}) => {
  const [events, setEvents] = useState<DebugEvent[]>([]);

  useEffect(() => {
    const addEvent = (type: 'EVENT' | 'COMMAND' | 'EXEC_EVENT' | 'EXEC_STATE', name: string, details?: string) => {
      setEvents(prev => {
        const newEvent: DebugEvent = {
          timestamp: formatTime(),
          type,
          name,
          details
        };
        const updated = [...prev, newEvent];
        // Keep only last MAX_EVENTS
        return updated.slice(-MAX_EVENTS);
      });
    };

    // TaskStateMachine event listeners
    const handleStateChange = (data: any) => {
      addEvent('EVENT', 'state:changed', `${data.oldState} → ${data.newState}`);
    };

    const handlePlanReady = () => {
      addEvent('EVENT', 'plan:ready');
    };

    const handleRefinementReady = () => {
      addEvent('EVENT', 'refinement:ready');
    };

    const handleQuestionAsked = (data: any) => {
      addEvent('EVENT', 'question:asked', data.question?.substring(0, 30) + '...');
    };

    const handleQuestionAnswering = (data: any) => {
      addEvent('EVENT', 'question:answering', `isAnswering: ${data.isAnswering}`);
    };

    const handleSuperReviewComplete = (data: any) => {
      addEvent('EVENT', 'superreview:complete', `verdict: ${data.result?.verdict}`);
    };

    const handleGardenerComplete = () => {
      addEvent('EVENT', 'gardener:complete');
    };

    // CommandBus command listener
    const handleCommand = (command: Command) => {
      const details = 'details' in command ? command.details :
                     'answer' in command ? command.answer?.substring(0, 30) :
                     'feedback' in command ? command.feedback?.substring(0, 30) : '';
      addEvent('COMMAND', command.type, details);
    };

    // Execution state machine listeners
    const executionStateMachine = taskStateMachine.getExecutionStateMachine();

    const handleExecutionStateChange = (data: any) => {
      addEvent('EXEC_STATE', 'state:changed', `${data.oldState} → ${data.newState}`);
    };

    const handleExecutionEvent = (data: any) => {
      addEvent('EXEC_EVENT', 'event', `${data.event}`);
    };

    // Subscribe to TaskStateMachine events
    taskStateMachine.on('state:changed', handleStateChange);
    taskStateMachine.on('plan:ready', handlePlanReady);
    taskStateMachine.on('refinement:ready', handleRefinementReady);
    taskStateMachine.on('question:asked', handleQuestionAsked);
    taskStateMachine.on('question:answering', handleQuestionAnswering);
    taskStateMachine.on('superreview:complete', handleSuperReviewComplete);
    taskStateMachine.on('gardener:complete', handleGardenerComplete);

    // Subscribe to CommandBus events
    commandBus.on('command', handleCommand);

    // Subscribe to execution state machine events if available
    if (executionStateMachine) {
      executionStateMachine.on('execution:state:changed', handleExecutionStateChange);
      executionStateMachine.on('execution:event', handleExecutionEvent);
    }

    // Cleanup on unmount
    return () => {
      taskStateMachine.off('state:changed', handleStateChange);
      taskStateMachine.off('plan:ready', handlePlanReady);
      taskStateMachine.off('refinement:ready', handleRefinementReady);
      taskStateMachine.off('question:asked', handleQuestionAsked);
      taskStateMachine.off('question:answering', handleQuestionAnswering);
      taskStateMachine.off('superreview:complete', handleSuperReviewComplete);
      taskStateMachine.off('gardener:complete', handleGardenerComplete);
      commandBus.off('command', handleCommand);

      // Cleanup execution state machine listeners
      if (executionStateMachine) {
        executionStateMachine.off('execution:state:changed', handleExecutionStateChange);
        executionStateMachine.off('execution:event', handleExecutionEvent);
      }
    };
  }, [taskStateMachine, commandBus]);

  if (!visible) {
    return null;
  }

  return (
    <Box
      position="absolute"
      width={terminalWidth}
      height={terminalHeight}
      flexDirection="column"
      justifyContent="flex-end"
      alignItems="flex-end"
      paddingRight={1}
      paddingBottom={1}
    >
      <Box
        width={56}
        borderStyle="round"
        borderColor="magenta"
        flexDirection="column"
        paddingX={1}
      >
        <Box marginBottom={0}>
          <Text bold color="magenta">🐛 Debug (Last {events.length})</Text>
        </Box>
        <Box flexDirection="column">
          {events.slice(-8).map((event, idx) => (
            <Box key={idx} flexDirection="column">
              <Box>
                <Text dimColor>{event.timestamp}</Text>
                <Text> </Text>
                <Text
                  bold
                  color={
                    event.type === 'COMMAND' ? 'yellow' :
                    event.type === 'EXEC_EVENT' || event.type === 'EXEC_STATE' ? 'magenta' :
                    event.name === 'state:changed' ? 'cyan' :
                    'blue'
                  }
                >
                  {event.type}
                </Text>
              </Box>
              <Box paddingLeft={2}>
                <Text color="white">{event.name}</Text>
              </Box>
              {event.details && (
                <Box paddingLeft={2}>
                  <Text dimColor>{event.details}</Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

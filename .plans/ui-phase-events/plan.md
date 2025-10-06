# Minimal Event-Driven UI Synchronization

## Context
Previous attempt over-scoped by inventing new events. After codebase verification:
- TaskStateMachine already emits `phase:changed` (line 448) ✅
- CoderReviewerStateMachine already emits `execution:state:changed` (line 297) ✅
- PhaseLayout currently uses synchronous `getCurrentState()` (line 124) ❌
- ExecutionLayout uses timer-based polling (lines 120-147) ❌

**Root cause**: UI components don't subscribe to existing events. No new events needed.

## Acceptance Criteria
- [ ] PhaseLayout derives current phase from `phase:changed` event subscription (no `getCurrentState()`)
- [ ] ExecutionLayout injection modal visibility driven by `execution:state:changed` events (no timer polling)
- [ ] All UI event subscriptions have proper cleanup (`.off()` in useEffect return)
- [ ] TypeScript builds successfully
- [ ] No new events invented - only use existing `phase:changed` and `execution:state:changed`

## Steps

### 1. Refactor PhaseLayout to subscribe to phase:changed event
**Intent**: Replace synchronous `getCurrentState()` call with event-driven state tracking

**Files**: `src/ui/ink/components/PhaseLayout.tsx`

**Changes**:
```typescript
// Add at top of component (after props destructure):
const [currentPhase, setCurrentPhase] = React.useState(taskStateMachine.getCurrentState());

React.useEffect(() => {
  const handlePhaseChange = (data: { to: TaskState }) => setCurrentPhase(data.to);
  taskStateMachine.on('phase:changed', handlePhaseChange);
  return () => taskStateMachine.off('phase:changed', handlePhaseChange);
}, [taskStateMachine]);

// Replace line 124:
const currentState = currentPhase; // NOT getCurrentState()
```

**Verify**: Run `npm run build`, check line 124 no longer calls `getCurrentState()`, grep for `phase:changed` subscription in PhaseLayout.tsx

---

### 2. Refactor ExecutionLayout injection modal to use execution:state:changed event
**Intent**: Eliminate timer-based polling (lines 120-147) by subscribing to existing execution state events

**Files**: `src/ui/ink/components/ExecutionLayout.tsx`

**Changes**:
```typescript
// Replace lines 120-147 with event subscription:
const [operationComplete, setOperationComplete] = React.useState(false);

React.useEffect(() => {
  const handleStateChange = (data: { newState: State }) => {
    // Operation is complete when agent has produced output for current state
    const complete = 
      (data.newState === State.PLANNING && executionStateMachine.getAgentOutput('bean')) ||
      (data.newState === State.CODE_REVIEW && executionStateMachine.getAgentOutput('coder')) ||
      (data.newState === State.BEAN_COUNTING && executionStateMachine.getAgentOutput('reviewer'));
    setOperationComplete(complete);
  };
  
  executionStateMachine.on('execution:state:changed', handleStateChange);
  return () => executionStateMachine.off('execution:state:changed', handleStateChange);
}, [executionStateMachine]);

// Modal condition (around line 170) uses operationComplete
```

**Verify**: Grep for `execution:state:changed` in ExecutionLayout.tsx, confirm lines 120-147 removed, check modal visibility tied to `operationComplete` state

---

### 3. Verify event cleanup and build
**Intent**: Ensure no memory leaks from event listeners and TypeScript compiles

**Files**: `src/ui/ink/components/PhaseLayout.tsx`, `src/ui/ink/components/ExecutionLayout.tsx`

**Actions**:
- Run `npm run build` and verify zero TypeScript errors
- Grep for all `.on(` calls in both files and confirm matching `.off(` in useEffect cleanup
- Check useEffect dependency arrays include state machine instances

**Verify**: `npm run build` succeeds, grep output shows paired `.on()` / `.off()` calls

## Risks & Rollback
- **Risk**: Event not fired at expected times → Add debug logging to event handlers
- **Risk**: React re-render loops if dependencies wrong → Review useEffect dependency arrays
- **Rollback**: Revert ExecutionLayout.tsx lines 120-147 to timer polling, revert PhaseLayout.tsx line 124 to `getCurrentState()`

## Notes
- Existing test failures (TASK_FINALIZING → TASK_GARDENING) are **out of scope** - pre-existing from master branch changes
- No new events needed - this plan only wires existing event infrastructure
- Total changes: ~30 lines across 2 files

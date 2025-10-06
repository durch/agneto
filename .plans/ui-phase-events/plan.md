# Synchronize UI Phase Transitions with State Machine Events

## Context

The task requires making UI components event-driven by subscribing to orchestrator state machine events rather than polling state synchronously. 

**Current State:**
- TaskStateMachine emits `state:changed` event (src/task-state-machine.ts:446) on every transition
- CoderReviewerStateMachine emits `execution:state:changed` (src/state-machine.ts:297) 
- PhaseLayout calls `getCurrentState()` synchronously (line 124)
- ExecutionLayout already refactored to event-driven pattern (lines 142-146)

**Root Cause of Previous Failure:**
The previous plan incorrectly claimed `phase:changed` event existed when only `state:changed` exists. The implementation then invented a new event, violating the "reuse existing events" principle. Additionally, PhaseLayout was never actually refactored - only a single case statement was added.

**Key Insight:**
The event `state:changed` **already exists and carries all necessary data** (`{ from, to }` payload). We just need to subscribe to it. No new events required.

## Acceptance Criteria

- [ ] PhaseLayout subscribes to `state:changed` event via `useEffect` hook
- [ ] PhaseLayout tracks current phase in local state updated by event handler
- [ ] PhaseLayout no longer calls `getCurrentState()` directly for rendering decisions
- [ ] Event subscription cleanup properly implemented (`.off()` in useEffect return)
- [ ] TASK_GARDENING state displays in correct PhaseGroup (REVIEW, not PLANNING)
- [ ] TypeScript compiles with zero errors (`npm run build`)
- [ ] No memory leaks (event listeners cleaned up on unmount)

## Steps

### 1. Refactor PhaseLayout to event-driven phase tracking

**Intent:** Replace synchronous `getCurrentState()` polling with event subscription to existing `state:changed` event

**Files:** `src/ui/ink/components/PhaseLayout.tsx`

**Changes:**
```typescript
// Add state tracking (after imports, ~line 20)
const [currentPhase, setCurrentPhase] = React.useState(taskStateMachine.getCurrentState());

// Add event subscription (after state declaration, ~line 22)
React.useEffect(() => {
  const handleStateChange = (data: { from: TaskState; to: TaskState }) => {
    setCurrentPhase(data.to);
  };
  
  taskStateMachine.on('state:changed', handleStateChange);
  
  return () => {
    taskStateMachine.off('state:changed', handleStateChange);
  };
}, [taskStateMachine]);

// Replace getCurrentState() call (line 124)
- const currentState = taskStateMachine.getCurrentState();
+ const currentState = currentPhase;
```

**Verification:**
- Read PhaseLayout.tsx after edit - confirm no `getCurrentState()` calls remain except in `useState` initialization
- Grep for "getCurrentState()" in PhaseLayout.tsx - should only appear once (in useState)

### 2. Ensure TASK_GARDENING displays in correct phase group

**Intent:** Fix PhaseLayout phase grouping so TASK_GARDENING shows in REVIEW phase, not PLANNING

**Files:** `src/ui/ink/components/PhaseLayout.tsx`

**Changes:**
```typescript
// Already done in previous implementation (line 30)
case TaskState.TASK_SUPER_REVIEWING:
case TaskState.TASK_GARDENING:  // ✅ This line already exists
  return PhaseGroup.REVIEW;
```

**Verification:**
- Read PhaseLayout.tsx lines 25-35 - confirm TASK_GARDENING is in PhaseGroup.REVIEW switch case
- No changes needed if already present from previous implementation

### 3. Build verification

**Intent:** Ensure TypeScript compiles with zero errors after refactoring

**Files:** None (verification only)

**Command:** `npm run build`

**Verification:**
- Exit code 0 (success)
- No TypeScript compilation errors
- No new warnings introduced

## Risks & Rollbacks

**Risk:** Event listener memory leak if cleanup not implemented
- **Mitigation:** Step 1 includes explicit `.off()` cleanup in useEffect return
- **Rollback:** Revert PhaseLayout.tsx to use synchronous `getCurrentState()` pattern

**Risk:** Race condition if `state:changed` event fires before component mounts
- **Mitigation:** `useState` initialization uses `getCurrentState()` to capture initial state
- **Rollback:** None needed - this is standard React event subscription pattern

**Risk:** TypeScript compilation failure due to incorrect event payload typing
- **Mitigation:** Event payload `{ from: TaskState; to: TaskState }` matches existing TaskStateMachine.transition() emission
- **Rollback:** Revert changes, verify event payload structure in task-state-machine.ts:446

## Confidence Level

**High (85%)** - This is the simplest possible solution:
- Only 1 file modified (PhaseLayout.tsx)
- ~15 lines of code changes
- Uses existing `state:changed` event (verified in codebase)
- Follows exact pattern already proven in ExecutionLayout.tsx (lines 142-146)
- No new events, no new abstractions, no scope creep

**Uncertainty:** None - the implementation is a direct application of React event subscription patterns already used successfully in App.tsx (lines 98-124) and ExecutionLayout.tsx.

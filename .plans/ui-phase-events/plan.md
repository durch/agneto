# Plan: Event-Driven UI Phase Synchronization

## Context
The TaskStateMachine and CoderReviewerStateMachine already extend EventEmitter and emit state change events, but UI components (PhaseLayout, ExecutionLayout) use synchronous state reads and timer-based polling instead of pure event subscriptions. This creates timing issues with injection modals and phase display. We'll wire the existing event infrastructure to eliminate local state guessing.

## Acceptance Criteria
- PhaseLayout determines current phase exclusively via event subscriptions (no `getCurrentState()` in render path)
- ExecutionLayout injection modal visibility driven by events, not timers/local polling
- TaskStateMachine emits dedicated `phase:changed` event on all `transition()` calls
- TASK_GARDENING state maps to PhaseGroup.REVIEW in PhaseLayout (not PLANNING)
- Existing CommandBus approval flows (plan/refinement/question) remain unaffected
- Event subscriptions use proper cleanup (`.off()` in useEffect return)

## Steps

1. **Add `phase:changed` event emission to TaskStateMachine transitions**
   - **Intent**: Provide explicit phase event when orchestrator calls `transition()`
   - **Files**: `src/task-state-machine.ts`
   - **Changes**: In `transition()` method (line ~90), emit `this.emit('phase:changed', { from: currentState, to: newState })` after state update
   - **Verify**: `DEBUG=true npm start` shows "phase:changed" events in orchestrator log; grep for `emit.*phase:changed` confirms emission

2. **Fix TASK_GARDENING phase mapping in PhaseLayout**
   - **Intent**: Display Gardener results correctly in review phase group
   - **Files**: `src/ui/ink/components/PhaseLayout.tsx`
   - **Changes**: Move `TaskState.TASK_GARDENING` from PLANNING group (line 21) to REVIEW group (line 30)
   - **Verify**: After SuperReviewer completes, UI displays "Review" phase header (not "Planning")

3. **Refactor PhaseLayout to use event-driven phase detection**
   - **Intent**: Eliminate synchronous `getCurrentState()` calls in render logic
   - **Files**: `src/ui/ink/components/PhaseLayout.tsx`
   - **Changes**: 
     - Add `const [currentPhase, setCurrentPhase] = useState(taskStateMachine.getCurrentState())` at component start
     - Add `useEffect` subscribing to `phase:changed` event: `taskStateMachine.on('phase:changed', ({to}) => setCurrentPhase(to))`
     - Replace `taskStateMachine.getCurrentState()` calls with `currentPhase` state variable
     - Add cleanup: `return () => taskStateMachine.off('phase:changed', handler)`
   - **Verify**: ReadFile component after changes confirms no `getCurrentState()` in return statement; UI still switches phases correctly

4. **Add execution phase event to CoderReviewerStateMachine**
   - **Intent**: ExecutionLayout can react to execution state changes (BEAN_COUNTING → PLANNING → CODE_REVIEW)
   - **Files**: `src/state-machine.ts`
   - **Changes**: In `transition()` method, add `this.emit('execution:phase:changed', { from: currentState, to: newState })` after state update
   - **Verify**: Grep for `emit.*execution:phase:changed` confirms emission; DEBUG output shows event during chunk execution

5. **Refactor ExecutionLayout injection modal to use execution phase events**
   - **Intent**: Replace timer-based polling (lines 120-147) with event-driven modal visibility
   - **Files**: `src/ui/ink/components/ExecutionLayout.tsx`
   - **Changes**:
     - Remove `React.useEffect` with `operationComplete` local state (lines 120-147)
     - Add `useEffect` subscribing to `execution:phase:changed` event
     - Show injection modal when event indicates phase transition AND `taskStateMachine.getPendingInjection()` exists
     - Keep `isAnswering` flag subscription (lines 150-170) unchanged
   - **Verify**: ReadFile confirms no `operationComplete` state; Ctrl+I modal appears immediately after chunk completion (no delay)

6. **Add event subscription cleanup audit**
   - **Intent**: Ensure no memory leaks from event listeners
   - **Files**: `src/ui/ink/components/PhaseLayout.tsx`, `src/ui/ink/components/ExecutionLayout.tsx`
   - **Changes**: Verify all `taskStateMachine.on()` and `coderReviewerStateMachine.on()` calls have matching `.off()` in useEffect cleanup
   - **Verify**: Grep for `\.on\(` and `\.off\(` shows paired subscriptions; no warnings in console during UI unmount

## Risks & Rollbacks
- **Risk**: Event emission order might cause render flicker (phase changes before data ready)
  - **Mitigation**: Events already emitted after state updates (src/task-state-machine.ts:446 pattern)
  - **Rollback**: Revert PhaseLayout to synchronous `getCurrentState()` calls
- **Risk**: Execution phase events might fire too frequently (every sub-state transition)
  - **Mitigation**: Filter events in ExecutionLayout to only react to meaningful transitions
  - **Rollback**: Keep timer-based polling as fallback mechanism
- **Risk**: TASK_GARDENING phase group change might break existing layout logic
  - **Verification**: Test full task flow (Planning → Execution → SuperReview → Gardening) before committing
  - **Rollback**: Keep TASK_GARDENING in PLANNING group if split-pane logic depends on current grouping

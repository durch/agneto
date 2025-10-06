# Phase-Driven UI Updates in ExecutionLayout

## Context
ExecutionLayout currently updates only when agent output changes, not when execution phases transition. The execution state machine already emits `execution:phase:changed` events (verified at `src/state-machine.ts:300`), but these are only used by the injection modal. We need to wire this existing event to trigger UI re-renders.

## Acceptance Criteria
- Progress tracker updates immediately when Bean Counter/Coder/Reviewer phases change
- Output panes refresh when phases transition, even before agent output appears
- Existing agent output updates continue working
- No conflicts with injection modal's subscription to the same event
- No memory leaks from event listeners

## Steps

### 1. Wire existing phase event to ExecutionLayout re-renders
**Intent**: Make ExecutionLayout respond to execution phase changes using the existing `execution:phase:changed` event

**Files**: `src/ui/ink/components/ExecutionLayout.tsx`

**Changes**: In the existing `useEffect` hook (around line 150-171), add subscription to `execution:phase:changed` event that calls the same `handleUpdate` function used by output events

**Verify**: 
- Read `ExecutionLayout.tsx:150-171` - confirm `handleUpdate` triggers `forceUpdate({})`
- Confirm new subscription added to existing useEffect with proper cleanup
- Grep for `execution:phase:changed` - verify no duplicate subscriptions created

### 2. Test phase transition updates
**Intent**: Verify UI updates occur on phase changes independent of output

**Files**: Manual testing in running application

**Changes**: Start a task and observe:
- Progress tracker updates when transitioning BEAN_COUNTING → PLANNING → CODE_REVIEW
- Output panes switch before agent messages appear
- Injection modal still works (verifies no event conflicts)

**Verify**:
- UI shows correct phase immediately after state machine transitions
- Both injection modal AND general UI updates work simultaneously
- No console errors about duplicate event handlers

## Risks & Rollbacks

**Risk**: Multiple subscribers to `execution:phase:changed` could cause performance issues
- **Mitigation**: Event pattern already proven with injection modal; adding one more subscriber is minimal overhead
- **Rollback**: Remove the single line subscription if issues occur

**Risk**: Frequent re-renders could cause UI flicker
- **Mitigation**: React's reconciliation handles this; existing output events already trigger frequent re-renders
- **Rollback**: Remove subscription and revert to output-only updates

## Implementation Confidence

**High confidence** - This is a one-line change using existing infrastructure. The event already fires, the UI pattern already exists, we're just connecting them. No new complexity introduced.

# Complete CommandBus Migration for ExecutionLayout

## Context

The ExecutionLayout phase is the last remaining component using manual rerenders instead of the event-driven architecture. CoderReviewerStateMachine already emits `execution:state:changed` on state transitions, but doesn't emit events when agent output or summary data changes. This causes 24+ manual `inkInstance.rerender()` calls scattered throughout the orchestrator, which should be eliminated by following the same event-driven pattern successfully used in planning, refinement, and gardening phases.

## Acceptance Criteria

- CoderReviewerStateMachine emits `execution:output:updated` event when `setAgentOutput()` is called
- CoderReviewerStateMachine emits `execution:summary:updated` event when `setSummary()` is called
- ExecutionLayout subscribes to both new events with proper cleanup
- All manual `inkInstance.rerender()` calls removed from orchestrator.ts
- UI automatically updates when Bean Counter, Coder, or Reviewer complete work
- Build succeeds with zero TypeScript errors
- No regression in existing event-driven features

## Steps

### 1. Add event emissions to CoderReviewerStateMachine

**Intent**: Emit events when agent output or summary data changes, following the existing `transition()` pattern

**Files**: `src/state-machine.ts`

**Actions**:
- In `setAgentOutput()` (line 163-171), add after line 170: `this.emit('execution:output:updated', { agent, output });`
- In `setSummary()` (line 185-191), add after line 190: `this.emit('execution:summary:updated', { agent, summary });`

**Verification**: 
- Grep for `this.emit('execution:` to confirm both new events exist
- Verify event emission follows same pattern as `transition()` method (line 295)
- Build with `npm run build` to ensure TypeScript compiles

### 2. Add event subscriptions to ExecutionLayout

**Intent**: Subscribe to execution data events so UI auto-updates when agent output changes

**Files**: `src/ui/ink/components/ExecutionLayout.tsx`

**Actions**:
- Read ExecutionLayout to understand current structure and find where useEffect hooks are
- Add new useEffect hook following App.tsx pattern (lines 102-128):
  - Subscribe to `execution:output:updated` event
  - Subscribe to `execution:summary:updated` event  
  - Both handlers call `forceUpdate({})`
  - Return cleanup function calling `.off()` for both events
- Ensure dependencies array includes `[stateMachine]`

**Verification**:
- Grep for `execution:output:updated` and `execution:summary:updated` in ExecutionLayout
- Confirm cleanup handlers exist in return statement
- Build with `npm run build`

### 3. Remove all manual rerender calls from orchestrator

**Intent**: Eliminate manual UI updates now that events drive automatic rerenders

**Files**: `src/orchestrator.ts`

**Actions**:
- Read orchestrator.ts around lines 1713, 1803, 1867, 2007, 2067 (known rerender locations)
- Use Grep to find ALL instances of `inkInstance.rerender` in orchestrator.ts
- Remove all `inkInstance.rerender()` calls and their "Trigger UI update if Ink is active" comments
- Remove the conditional `if (inkInstance)` blocks that wrap these calls if they contain only rerender logic

**Verification**:
- Grep for `inkInstance.rerender` in orchestrator.ts returns zero results
- Grep for "Trigger UI update" comment returns zero results
- Build with `npm run build` succeeds

### 4. Verify complete integration

**Intent**: Confirm event-driven architecture works end-to-end without manual rerenders

**Files**: Multiple files for verification

**Actions**:
- Grep for `inkInstance.rerender` across entire codebase to ensure no orphaned calls
- Read state-machine.ts to verify both new events exist in `setAgentOutput()` and `setSummary()`
- Read ExecutionLayout.tsx to verify event subscriptions with cleanup
- Read orchestrator.ts to confirm zero manual rerender calls remain
- Run `npm run build` for final compilation check

**Verification**:
- Zero `inkInstance.rerender` calls exist in any file
- CoderReviewerStateMachine has exactly 3 event emissions: `execution:state:changed`, `execution:output:updated`, `execution:summary:updated`
- ExecutionLayout subscribes to execution events with proper cleanup
- TypeScript build succeeds with no errors

## Risks & Rollbacks

**Risk**: Event emission timing could cause UI updates before data is fully set in context
- **Mitigation**: Events are emitted AFTER context data is set (same pattern as `transition()`)
- **Rollback**: Revert event emissions, restore manual rerender calls

**Risk**: Missing event subscription cleanup could cause memory leaks
- **Mitigation**: Follow App.tsx pattern exactly - all subscriptions have `.off()` cleanup in return function
- **Rollback**: Add missing cleanup handlers

**Risk**: Removing wrong rerender calls could break UI updates in edge cases
- **Mitigation**: Only remove calls in orchestrator.ts, leave any in UI components intact; grep confirms complete removal
- **Rollback**: Restore specific rerender calls if UI stops updating (unlikely given event coverage)

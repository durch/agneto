# Strategic Intent

Restore human review menu visibility after fullscreen modal closes by dispatching a re-render event instead of adding global state.

# Fix Human Review State Loss on Modal Close

## Context

The human review menu disappears after closing fullscreen modals because `ExecutionLayout` unmounts when `viewMode` switches, losing local state. The orchestrator remains correctly paused waiting for `commandBus.waitForAnyCommand()`, but the UI shows no prompt. Instead of lifting state globally, we can solve this by dispatching an event on modal close to trigger re-synchronization of the UI with the orchestrator's waiting state.

## Acceptance Criteria

- Human review menu reappears when fullscreen modal closes and orchestrator is waiting for human input
- No new global state introduced in TaskStateMachine or ExecutionStateMachine
- Solution uses event-driven pattern (emit event → UI reacts)
- User can approve/revise/reject after modal closes
- Orchestrator receives decision and proceeds normally
- No regression in other approval flows
- Code compiles via `npm run build`

## Steps

1. **Add modal close event emission**
   - **Intent**: Notify UI components that fullscreen modal has closed and they should sync state
   - **File**: `src/ui/ink/App.tsx` (in `handleModalClose` function around line 120)
   - **Change**: Add `taskStateMachine.emit('modal:closed')` after setting `viewMode` to `'normal'`
   - **Verify**: Check with Grep that event name doesn't conflict with existing events; confirm emission happens before layout remount

2. **Subscribe to modal:closed in ExecutionLayout**
   - **Intent**: Trigger state synchronization when modal closes to restore pending human review prompts
   - **File**: `src/ui/ink/components/ExecutionLayout.tsx` (in `syncState` useEffect around line 60)
   - **Change**: Add event listener `taskStateMachine.on('modal:closed', syncStateFromMachine)` alongside existing listeners; add to cleanup return function
   - **Verify**: Confirm `syncStateFromMachine` function is called on modal close; check that human review state is correctly read from orchestrator's waiting state

3. **Ensure CommandBus pending commands are accessible**
   - **Intent**: Allow UI to detect when orchestrator is waiting for human review command
   - **File**: `src/ui/command-bus.ts` (around line 30-50 where `waitForAnyCommand` is implemented)
   - **Change**: If not already exposed, add public method `getPendingCommandTypes(): string[]` that returns array of command types currently being waited on
   - **Verify**: Read file to check if method exists; test that it returns correct command types when orchestrator is paused

4. **Update syncState to query CommandBus for pending review**
   - **Intent**: Detect if orchestrator is waiting for human review decision when modal closes
   - **File**: `src/ui/ink/components/ExecutionLayout.tsx` (in `syncStateFromMachine` function around line 80)
   - **Change**: Add check `if (commandBus.getPendingCommandTypes().some(t => ['human:approve', 'human:revise', 'human:reject'].includes(t)))` then set `needsHumanReview: true` and restore context from last known state
   - **Verify**: Open modal during human review → close → menu should reappear; check with manual test scenario

5. **Preserve human review context across unmount**
   - **Intent**: Ensure review context (feedback, current decision) is not lost when ExecutionLayout unmounts
   - **File**: `src/ui/ink/components/ExecutionLayout.tsx` (around line 50 where state is initialized)
   - **Change**: Store `lastHumanReviewContext` in a ref (`useRef`) instead of state; update ref when human review starts; read from ref in `syncStateFromMachine`
   - **Verify**: Grep for existing ref patterns in file; confirm context persists across unmount/remount cycles

6. **Compile and verify**
   - **Intent**: Ensure TypeScript compilation succeeds and no runtime errors
   - **File**: Project root
   - **Command**: `npm run build`
   - **Verify**: Build succeeds with no errors; manually test fullscreen modal flow with human review pending

## Risks & Rollback

**Risks:**
- Event timing issues if `modal:closed` fires before layout remount completes
- CommandBus method `getPendingCommandTypes()` may not exist, requiring implementation
- Ref persistence pattern may cause stale context if orchestrator moves to next chunk

**Rollback:**
- Revert event emission in `App.tsx`
- Remove event listener in `ExecutionLayout.tsx`
- Restore original `syncState` logic without CommandBus query

**Mitigation:**
- Step 3 includes verification that CommandBus method exists before proceeding
- Step 5 uses React ref pattern (proven stable across unmount cycles)
- Each step is independently verifiable with concrete success criteria

# Refactor: Add Event Emissions for Live Activity and Tool Status Updates

## Context

The codebase has a hybrid architecture where state transitions use events properly, but real-time UI updates (live activity messages and tool status) rely on direct getter calls without event emissions. This creates inconsistent UI updates. The solution is to add event emissions to existing setters while preserving the getters for rendering.

## Acceptance Criteria

- `TaskStateMachine.setLiveActivityMessage()` emits `activity:updated` event
- `TaskStateMachine.setToolStatus()` emits `tool:status` event  
- `CoderReviewerStateMachine.setToolStatus()` emits `tool:status` event
- `PlanningLayout.tsx` subscribes to `activity:updated` and `tool:status` events
- `ExecutionLayout.tsx` subscribes to both state machines' `tool:status` and `activity:updated` events
- All existing getters remain unchanged (UI needs them for rendering)
- Event listeners properly cleaned up in useEffect returns
- TypeScript compiles successfully (`npm run build`)

## Steps

1. **Add event emission to TaskStateMachine.setLiveActivityMessage()**
   - **Intent:** Emit `activity:updated` event when agents report live activity
   - **Files:** `src/task-state-machine.ts` (line ~389)
   - **Change:** Add `this.emit('activity:updated', { agent, message });` after property assignment
   - **Verify:** Grep for `setLiveActivityMessage` calls in agents to confirm they'll trigger events

2. **Add event emission to TaskStateMachine.setToolStatus()**
   - **Intent:** Emit `tool:status` event when agents use tools
   - **Files:** `src/task-state-machine.ts` (line ~400)
   - **Change:** Add `this.emit('tool:status', { agent, tool, summary });` after property assignment
   - **Verify:** Grep for `setToolStatus` calls to confirm coverage

3. **Add event emission to CoderReviewerStateMachine.setToolStatus()**
   - **Intent:** Emit `tool:status` event for execution phase tool usage
   - **Files:** `src/state-machine.ts` (line ~302)
   - **Change:** Add `this.emit('tool:status', { agent, tool, summary });` after property assignment
   - **Verify:** Read CoderReviewerStateMachine class to confirm EventEmitter inheritance

4. **Subscribe to events in PlanningLayout.tsx**
   - **Intent:** Auto-update UI when TaskStateMachine emits activity/tool events
   - **Files:** `src/ui/ink/components/PlanningLayout.tsx` (existing useEffect around line 35)
   - **Change:** Add event subscriptions in existing useEffect: `taskStateMachine.on('activity:updated', handleDataUpdate)` and `taskStateMachine.on('tool:status', handleDataUpdate)`, plus cleanup in return function
   - **Verify:** Confirm existing `handleDataUpdate` function triggers re-render

5. **Subscribe to events in ExecutionLayout.tsx**
   - **Intent:** Auto-update UI for execution phase activity/tool updates
   - **Files:** `src/ui/ink/components/ExecutionLayout.tsx` (existing useEffect around line 40)
   - **Change:** Add subscriptions for both `taskStateMachine` and `stateMachine` (CoderReviewerStateMachine) events: `activity:updated` and `tool:status`, with proper cleanup
   - **Verify:** Read component to confirm it has access to both state machine instances

6. **Verify TypeScript compilation**
   - **Intent:** Ensure no type errors introduced
   - **Command:** `npm run build`
   - **Success:** Clean build with no errors

7. **Verify event subscription cleanup**
   - **Intent:** Prevent memory leaks
   - **Files:** Review `PlanningLayout.tsx` and `ExecutionLayout.tsx` useEffect return functions
   - **Success:** All `.on()` calls have matching `.off()` calls in cleanup

## Risks & Rollbacks

**Risk:** Event emissions trigger unnecessary re-renders during rapid updates (e.g., tool status changing quickly)

**Mitigation:** React's reconciliation handles this efficiently; existing patterns (e.g., `plan:ready`) show no performance issues

**Rollback:** Remove `this.emit()` calls from setter methods; UI falls back to polling behavior (current state)

## Confidence

**High confidence** this approach is correct - it follows the exact pattern used successfully for `setPlan()`, `setRefinedTask()`, and other event-driven methods. Only 4 files modified, minimal risk, preserves encapsulation.

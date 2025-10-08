# Immediate Ctrl+I Modal Display

**Strategic Intent:** Make the Ctrl+I prompt injection modal appear immediately upon keypress by introducing an event-driven notification pattern that aligns with existing UI patterns.

## Context

Currently, the Ctrl+I shortcut sets a flag (`injectionPauseRequested`) but doesn't notify the UI, so the modal only appears when other events trigger a re-render. This makes the feature feel unresponsive. The fix requires emitting an event from `TaskStateMachine` when the injection pause is requested, and updating `ExecutionLayout` and `PlanningLayout` to listen for this event.

## Acceptance Criteria

- Pressing Ctrl+I immediately displays the injection modal without waiting for phase transitions
- The solution follows the existing event-driven pattern (EventEmitter-based)
- Both `ExecutionLayout` and `PlanningLayout` respond to the new event
- No regressions in existing Ctrl+I functionality (modal content, injection behavior, auto-clear)
- Code compiles successfully with `npm run build`

## Steps

### 1. Add event emission to TaskStateMachine
**Intent:** Emit a new event when `requestInjectionPause()` is called, making the state change immediately observable to UI components.

**Files:**
- `src/task-state-machine.ts`

**Verification:** Review the code to confirm `this.emit('injection:pause:requested')` is called in `requestInjectionPause()` method.

### 2. Subscribe to injection pause event in ExecutionLayout
**Intent:** Listen for the `injection:pause:requested` event and immediately check whether to display the modal, triggering a re-render.

**Files:**
- `src/ui/execution-layout.tsx`

**Verification:** Review the code to confirm:
- Event listener is registered in `useEffect`
- Cleanup function removes the listener
- Event handler forces modal visibility check (likely via state update)

### 3. Subscribe to injection pause event in PlanningLayout
**Intent:** Apply the same event-driven pattern to the planning phase so Ctrl+I works consistently across all phases.

**Files:**
- `src/ui/planning-layout.tsx`

**Verification:** Review the code to confirm:
- Event listener is registered in `useEffect`
- Cleanup function removes the listener
- Event handler forces modal visibility check (likely via state update)

### 4. Verify compilation and integration
**Intent:** Ensure TypeScript compiles and the event flows through the existing architecture without breaking other features.

**Files:** (none modified, verification step)

**Verification:** Run `npm run build` and confirm zero compilation errors.

## Risks & Rollbacks

**Risks:**
- Event listener cleanup might be missed, causing memory leaks (mitigated by following existing useEffect patterns)
- Modal might show at inappropriate times if event is emitted incorrectly (mitigated by emitting only in `requestInjectionPause()`)

**Rollback:**
- Remove the event emission from `TaskStateMachine`
- Remove event listeners from both layout components
- System returns to previous behavior (delayed modal display)

---

**Confidence:** Confident. This follows the established event-driven pattern used for `question:asked`, `plan:ready`, etc. The change is localized to three files and aligns with the architectural principles documented in CLAUDE.md.

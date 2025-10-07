# Strategic Intent

Ensure menu restoration logic runs on component mount initialization, not just event-driven updates.

# Fix Menu Restoration After Fullscreen Modal Close

## Context

The approval menu disappears after closing fullscreen modals because `handleDataUpdate()` only runs when TaskStateMachine emits events, not during component remount. When PlanningLayout remounts after fullscreen close, the event listeners are re-registered but `handleDataUpdate()` never executes unless a new event fires. Since the orchestrator is already waiting (no state change), menus remain hidden.

## Acceptance Criteria

- Approval menus (refinement/plan/superreview) automatically reappear when closing fullscreen modal if orchestrator is waiting
- No duplicate renders or race conditions
- Event-driven architecture maintained (no callback props added)
- Minimal code changes following existing React patterns

## Steps

**1. Add initialization call to useEffect in PlanningLayout**

- **Intent:** Trigger menu restoration logic immediately on component mount
- **File:** `src/ui/ink/components/PlanningLayout.tsx` (lines ~189-198, existing useEffect hook)
- **Change:** Call `handleDataUpdate()` once after event listener registration
- **Verification:** Read file, confirm useEffect structure, identify insertion point after listeners

```typescript
// After registering all event listeners, call once for initialization
handleDataUpdate(); // Restore menus if commands pending during mount
```

**2. Verify handleDataUpdate is idempotent**

- **Intent:** Ensure calling handleDataUpdate multiple times doesn't cause issues
- **File:** `src/ui/ink/components/PlanningLayout.tsx` (line 139)
- **Action:** Read the function implementation to confirm it uses setState safely
- **Verification:** Check that all `setShowXApproval()` calls are conditional or safe to call multiple times

**3. Build and verify TypeScript compilation**

- **Intent:** Confirm no syntax errors or type issues
- **File:** N/A
- **Action:** Run `npm run build`
- **Verification:** Build completes successfully with no errors

**4. Manual verification scenario**

- **Intent:** Test actual behavior matches expected outcome
- **File:** N/A (runtime verification)
- **Action:** Document expected test scenario:
  1. Start task that reaches plan approval state
  2. Press Ctrl+Q to open fullscreen plan modal
  3. Press Esc to close modal
  4. Observe approval menu reappears immediately
- **Verification:** Menu is visible without requiring new events to fire

## Risks & Rollbacks

**Risk:** Calling `handleDataUpdate()` on mount might cause brief double-render or flicker
- **Mitigation:** React batches setState calls, should be imperceptible
- **Rollback:** Remove initialization call if render issues occur

**Risk:** Race condition if event fires during mount initialization
- **Mitigation:** Event listeners registered before initialization call, React handles concurrent updates
- **Rollback:** Revert to event-only triggering

**Risk:** Assumption that `handleDataUpdate()` is safe to call without event payload
- **Verification needed:** Confirm function doesn't rely on event object parameters
- **Rollback:** If function expects event data, refactor to separate restoration logic

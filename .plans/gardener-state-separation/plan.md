# Separate SuperReviewer and Gardener States

## Context

Currently, Gardener documentation updates execute within the `TASK_SUPER_REVIEWING` state, causing immediate transition to `TASK_FINALIZING` before users can see the results displayed in the UI's right pane. This plan introduces a new `TASK_GARDENING` state to ensure proper UI visibility and clean separation of concerns.

## Acceptance Criteria

- Users see SuperReviewer results (left pane) during `TASK_SUPER_REVIEWING`
- SuperReviewer approval transitions to new `TASK_GARDENING` state
- Users see Gardener documentation results (right pane) during `TASK_GARDENING`
- Gardener completion transitions to `TASK_FINALIZING`
- Checkpoint restoration handles new state correctly
- All existing approval flows (approve/needs-human) continue working
- UI phase indicators update appropriately for each state

## Steps

### 1. Add TASK_GARDENING state and GARDENING_COMPLETE event to state machine
**Intent:** Extend state machine with new state/event for Gardener execution phase

**Files:** `src/task-state-machine.ts`

**Changes:**
- Add `TASK_GARDENING = 'TASK_GARDENING'` to `TaskState` enum (line ~12, after `TASK_SUPER_REVIEWING`)
- Add `GARDENING_COMPLETE = 'GARDENING_COMPLETE'` to `TaskEvent` enum (line ~26, after `SUPER_REVIEW_PASSED`)

**Verify:** `npm run build` succeeds, TypeScript recognizes new state/event in IDE

---

### 2. Update state transition logic for SuperReviewer → Gardening flow
**Intent:** Route SuperReviewer completion to TASK_GARDENING instead of TASK_FINALIZING

**Files:** `src/task-state-machine.ts`

**Changes:**
- Locate `handleTransition` method (line ~494)
- Find `SUPER_REVIEW_PASSED` case (line ~496)
- Change transition from `TASK_FINALIZING` to `TASK_GARDENING`
- Find `HUMAN_APPROVED` case handling post-SuperReviewer (line ~500)
- Change transition from `TASK_FINALIZING` to `TASK_GARDENING` (only for the branch after `TASK_SUPER_REVIEWING`)

**Verify:** Read modified code, confirm both approval paths lead to `TASK_GARDENING`

---

### 3. Add GARDENING_COMPLETE transition from TASK_GARDENING to TASK_FINALIZING
**Intent:** Complete state transition chain with Gardening → Finalizing

**Files:** `src/task-state-machine.ts`

**Changes:**
- Add new case in `handleTransition` for `GARDENING_COMPLETE` event
- Transition from `TASK_GARDENING` to `TASK_FINALIZING`
- Follow existing pattern (lines 496-502) for structure

**Verify:** Read code, confirm transition logic matches existing patterns

---

### 4. Extract Gardener execution from TASK_SUPER_REVIEWING orchestrator case
**Intent:** Remove Gardener invocation from SuperReviewer state to prepare for new state

**Files:** `src/orchestrator.ts`

**Changes:**
- Locate `TASK_SUPER_REVIEWING` case (line ~1024)
- Remove Gardener execution from "approve" path (lines ~1111-1134)
- Remove Gardener execution from "needs-human then approved" path (lines ~1152-1175)
- Replace removed Gardener calls with immediate transition: `taskStateMachine.transition(TaskEvent.SUPER_REVIEW_PASSED)` or `taskStateMachine.transition(TaskEvent.HUMAN_APPROVED)`
- Keep UI rerender calls before transitions

**Verify:** Read modified code, confirm no Gardener invocation remains in `TASK_SUPER_REVIEWING` case

---

### 5. Create new TASK_GARDENING orchestrator case with Gardener execution
**Intent:** Implement dedicated state handler for Gardener documentation updates

**Files:** `src/orchestrator.ts`

**Changes:**
- Add new `case TaskState.TASK_GARDENING:` after `TASK_SUPER_REVIEWING` case (after line ~1180)
- Copy Gardener execution logic from removed sections (one of lines 1111-1134 or 1152-1175)
- Include: Gardener agent call, result storage (`taskStateMachine.setGardenerResult`), UI rerender
- End with `taskStateMachine.transition(TaskEvent.GARDENING_COMPLETE)` and UI rerender
- Use same error handling pattern as SuperReviewer case

**Verify:** Read code, confirm Gardener execution matches previous implementation, transitions correctly

---

### 6. Update PlanningLayout UI to recognize TASK_GARDENING state
**Intent:** Ensure UI displays SuperReviewer + Gardener results during Gardening phase

**Files:** `src/ui/ink/components/PlanningLayout.tsx`

**Changes:**
- Locate state checks for split-pane rendering (around line ~387)
- Add `currentState === TaskState.TASK_GARDENING` to conditions showing SuperReviewer left pane
- Add `currentState === TaskState.TASK_GARDENING` to conditions showing Gardener right pane (line ~503)
- Update phase title logic (around lines ~277-279) to show "📚 Documentation Update Phase" or similar for `TASK_GARDENING`

**Verify:** Read code, confirm both panes render during `TASK_GARDENING`, phase title updates appropriately

---

### 7. Verify checkpoint serialization includes new state
**Intent:** Ensure audit/recovery system handles new state without code changes

**Files:** (Read-only verification)
- `src/audit/checkpoint-service.ts`
- `src/audit/restoration-service.ts`

**Verify:** 
- Read checkpoint creation code (checkpoint-service.ts ~line 60-120), confirm it serializes `taskStateMachine.getCurrentState()` generically
- Read restoration code (restoration-service.ts ~line 80-150), confirm it restores state without hardcoded checks
- If state is just stored/restored generically, no changes needed

---

### 8. Test state machine transitions end-to-end
**Intent:** Validate complete flow works correctly

**Files:** (Testing only, no changes)

**Verify:**
- `npm run build` succeeds
- Read through orchestrator flow: `TASK_SUPER_REVIEWING` → transition → `TASK_GARDENING` → Gardener runs → transition → `TASK_FINALIZING`
- Check PlanningLayout renders correctly for each state
- Manually trace promise-based approval pattern for both SuperReviewer verdicts (approve, needs-human)

## Risks & Rollback

**Risk:** State transition breaks existing checkpoint restoration  
**Mitigation:** Step 7 verifies checkpoint system is state-agnostic  
**Rollback:** Revert task-state-machine.ts and orchestrator.ts changes

**Risk:** UI doesn't update properly during new state  
**Mitigation:** Step 6 explicitly adds state checks to both panes  
**Rollback:** Revert PlanningLayout.tsx changes, Gardener results still stored (just not visible)

**Risk:** Promise resolver pattern breaks between states  
**Mitigation:** New state doesn't add new approval points, just moves execution  
**Rollback:** Move Gardener back into TASK_SUPER_REVIEWING case

**Concerns:**
- Need to verify that UI rerender timing is correct (after storing Gardener result but before transition)
- May need to check if any other UI components (e.g., status indicators) hardcode state checks
- Should confirm no other orchestrator helper functions assume TASK_SUPER_REVIEWING → TASK_FINALIZING directly

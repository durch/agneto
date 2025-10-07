# Plan: Preserve Bean Counter Output Until SuperReviewer Completes

**Strategic Intent:** Maintain execution context visibility by showing Bean Counter output during SuperReviewer analysis, transitioning to results display only after completion.

## Context

The PlanningLayout currently displays SuperReviewer results immediately when entering the `TASK_SUPER_REVIEWING` state, even though SuperReviewer hasn't completed its analysis yet. This creates a jarring context switch from execution. The fix requires tracking SuperReviewer completion via the `superreview:complete` event and conditionally rendering Bean Counter output until that event fires.

## Acceptance Criteria

- Bean Counter chunk output remains visible in left pane during `TASK_SUPER_REVIEWING` state until SuperReviewer completes
- SuperReviewer results appear in left pane only after `superreview:complete` event fires
- Right pane shows status message during analysis, then Gardener status after completion
- Transition is smooth without flickering or layout shifts
- Existing fullscreen shortcuts (Ctrl+Q/W) continue working
- Event subscriptions properly cleaned up on unmount

## Steps

1. **Add local state to track SuperReviewer completion**
   - **Intent:** Store completion flag to conditionally render Bean Counter vs SuperReviewer output
   - **File:** `src/ui/ink/components/PlanningLayout.tsx` (lines 197-207, existing useEffect with event subscriptions)
   - **Action:** Add `const [superReviewComplete, setSuperReviewComplete] = useState(false)` after existing state declarations
   - **Verify:** TypeScript compiles; new state variable available in component scope

2. **Update superreview:complete event handler to set completion flag**
   - **Intent:** Trigger UI transition when SuperReviewer finishes analysis
   - **File:** `src/ui/ink/components/PlanningLayout.tsx` (line 198, existing event subscription)
   - **Action:** Modify handler from `handleDataUpdate` to `() => { setSuperReviewComplete(true); handleDataUpdate(); }`
   - **Verify:** Handler sets completion flag and triggers re-render; TypeScript compiles without errors

3. **Create conditional rendering logic for left pane content**
   - **Intent:** Show Bean Counter output until SuperReviewer completes, then show results
   - **File:** `src/ui/ink/components/PlanningLayout.tsx` (lines 439-476, existing SuperReviewer/Gardener display logic)
   - **Action:** Replace current logic with:
     - If `currentState === TASK_SUPER_REVIEWING && !superReviewComplete`: render Bean Counter output (`agentOutputs.get('bean')`)
     - If `currentState === TASK_SUPER_REVIEWING && superReviewComplete` OR `currentState === TASK_GARDENING`: render SuperReviewer results
   - **Verify:** Read the modified file; confirm conditional branches cover all states correctly

4. **Update right pane status message during SuperReviewer analysis**
   - **Intent:** Provide clear feedback during analysis phase before completion
   - **File:** `src/ui/ink/components/PlanningLayout.tsx` (right pane rendering logic, adjacent to left pane changes)
   - **Action:** When `!superReviewComplete`, display "⏳ Performing final quality check..." instead of Gardener status
   - **Verify:** Right pane shows appropriate message during analysis; switches to Gardener status after completion

5. **Reset completion flag when entering TASK_SUPER_REVIEWING state**
   - **Intent:** Ensure flag is cleared if SuperReviewer runs multiple times (e.g., retry scenario)
   - **File:** `src/ui/ink/components/PlanningLayout.tsx` (state:changed event handler)
   - **Action:** Add logic to `handleStateChange` callback: if new state is `TASK_SUPER_REVIEWING`, call `setSuperReviewComplete(false)`
   - **Verify:** Flag resets on state transition; TypeScript compiles; no infinite render loops

6. **Verify Bean Counter output accessibility**
   - **Intent:** Confirm Bean Counter output is actually stored and retrievable during SuperReviewer phase
   - **File:** `src/ui/ink/components/PlanningLayout.tsx` (line 377, Bean Counter output retrieval)
   - **Action:** Read code to verify `agentOutputs.get('bean')` returns valid content; check if execution state machine preserves this data during state transitions
   - **Verify:** Bean Counter output exists in agentOutputs map; no null/undefined handling needed

7. **Build and verify TypeScript compilation**
   - **Intent:** Ensure no type errors or compilation failures
   - **File:** N/A (build step)
   - **Action:** Run `npm run build` in project root
   - **Verify:** Build completes successfully without errors; dist/ directory updated with new compiled code

## Risks & Rollbacks

**Risk:** Bean Counter output might not be preserved in `agentOutputs` map during state transitions  
**Mitigation:** Verify in Step 6; if missing, modify execution state machine to persist output  
**Rollback:** Revert conditional rendering logic; restore original immediate SuperReviewer results display

**Risk:** Completion flag might not reset properly in retry scenarios  
**Mitigation:** Step 5 ensures flag resets on state entry; test retry flow if SuperReviewer implementation supports it  
**Rollback:** Remove flag reset logic; accept one-time transition behavior

**Risk:** Event subscriptions might leak memory if cleanup not updated  
**Mitigation:** Verify existing cleanup in useEffect return function handles new state updates  
**Rollback:** Add explicit cleanup for setSuperReviewComplete if memory issues detected

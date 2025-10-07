# Strategic Intent

Restore planning-phase approval menus after fullscreen modal exit by querying CommandBus pending commands on component mount.

# Fix Planning-Phase Menu Restoration After Fullscreen Exit

## Context

Planning-phase approval menus in `PlanningLayout.tsx` are currently broken after closing the fullscreen modal because they use local component state (`showPlanApproval`, `showRefinementApproval`, `showSuperReviewApproval`) that resets to `false` on unmount. The execution-phase fix (commit 28320a4) already solved this pattern by querying `commandBus.getPendingCommandTypes()` on mount. We need to apply the identical pattern to planning-phase menus.

## Acceptance Criteria

- [ ] `PlanningLayout.tsx` queries `commandBus.getPendingCommandTypes()` on mount
- [ ] `showPlanApproval` restores if `plan:approve` or `plan:reject` pending
- [ ] `showRefinementApproval` restores if `refinement:approve` or `refinement:reject` pending
- [ ] `showSuperReviewApproval` restores if `superreview:approve`, `superreview:retry`, or `superreview:abandon` pending
- [ ] TypeScript compiles without errors
- [ ] Manual verification: approval menus reappear after fullscreen exit

## Steps

### 1. Read execution-phase restoration pattern
**Intent**: Understand the existing solution pattern implemented in `ExecutionLayout.tsx`.

**Files**: `src/ui/ink/components/ExecutionLayout.tsx`

**Verify**: Locate the `useEffect` hook that calls `commandBus.getPendingCommandTypes()` and restores `showHumanReview` state. Confirm the pattern of checking for specific command types.

### 2. Read current PlanningLayout implementation
**Intent**: Identify where approval menu state flags are declared and how they're currently managed.

**Files**: `src/ui/ink/components/PlanningLayout.tsx`

**Verify**: Locate `showPlanApproval`, `showRefinementApproval`, `showSuperReviewApproval` state declarations. Confirm existing `useEffect` hooks that set these flags based on state transitions.

### 3. Add restoration useEffect hook in PlanningLayout
**Intent**: Implement CommandBus query on mount to restore menu state flags.

**Files**: `src/ui/ink/components/PlanningLayout.tsx`

**Implementation**:
- Add `useEffect` hook that runs once on mount (empty dependency array)
- Call `commandBus.getPendingCommandTypes()`
- Check if `plan:approve` or `plan:reject` exists → set `showPlanApproval(true)`
- Check if `refinement:approve` or `refinement:reject` exists → set `showRefinementApproval(true)`
- Check if `superreview:approve`, `superreview:retry`, or `superreview:abandon` exists → set `showSuperReviewApproval(true)`

**Verify**: Code mirrors the execution-phase restoration pattern from step 1. All three planning-phase approval menus are covered.

### 4. Verify TypeScript compilation
**Intent**: Ensure changes compile without errors.

**Command**: `npm run build`

**Verify**: Build succeeds with exit code 0. No TypeScript errors related to `PlanningLayout.tsx`.

### 5. Manual verification plan (documentation only)
**Intent**: Document manual testing steps for verification.

**Test Procedure**:
1. Start task: `npm start -- "test task"`
2. Wait for plan approval prompt to appear
3. Press Ctrl+Q to open fullscreen modal
4. Press Escape to exit fullscreen
5. Verify plan approval menu still renders
6. Repeat for refinement approval and super-review approval phases

**Verify**: Approval menus persist after fullscreen exit in all three planning phases.

## Risks & Rollbacks

**Risk**: Menu state restoration conflicts with existing state management logic.  
**Mitigation**: Follow exact pattern from execution-phase fix. The restoration runs once on mount before other effects.  
**Rollback**: Remove the added `useEffect` hook; revert to pre-change behavior.

**Risk**: Wrong command types checked, menus don't restore correctly.  
**Mitigation**: Reference existing `commandBus.waitForCommand()` calls in orchestrator to confirm exact command type strings.  
**Rollback**: Correct command type strings in the restoration logic.

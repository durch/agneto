# Reorganize SuperReviewer and Gardener Display in UI Layout

## Context
The current UI shows "Original Plan" in the left pane during SuperReviewer phase. We need to swap this to show SuperReviewer results on the left and add Gardener documentation status on the right. This requires architectural changes because Gardener currently runs *after* the `TASK_SUPER_REVIEWING` state ends (post-approval), but the requirements ask for Gardener status display *during* this state. We'll extend the SuperReviewer phase to include Gardener execution and results.

## Acceptance Criteria
- Left pane shows SuperReviewer output (summary, issues, verdict) during `TASK_SUPER_REVIEWING` state
- Right pane shows Gardener status: "Processing documentation updates..." while running, then success/failure summary with sections updated
- Fullscreen functionality preserved for both panes (Ctrl+Q, Ctrl+W)
- TaskStateMachine stores and exposes Gardener result
- Orchestrator stores Gardener result after `documentTaskCompletion()` execution
- UI gracefully handles missing/null Gardener result (before execution)
- UI gracefully handles Gardener failures (success === false)

## Steps

### 1. Add Gardener result state to TaskStateMachine
**Intent**: Store Gardener execution results for UI access  
**Files**: `src/task-state-machine.ts`  
**Changes**:
- Add `gardenerResult: GardenerResult | null = null` to class properties
- Add `setGardenerResult(result: GardenerResult): void` method
- Add `getGardenerResult(): GardenerResult | null` getter method
- Import `GardenerResult` type from `src/agents/gardener.ts`

**Verify**: `npm run build` succeeds with no TypeScript errors

### 2. Update orchestrator to store Gardener results
**Intent**: Persist Gardener execution outcome in state machine for UI access  
**Files**: `src/orchestrator.ts`  
**Changes**:
- After `documentTaskCompletion()` call at line ~860 (auto-approve case), add: `taskStateMachine.setGardenerResult(gardenerResult)`
- After `documentTaskCompletion()` call at line ~891 (human-approved case), add: `taskStateMachine.setGardenerResult(gardenerResult)`
- Add `inkInstance?.rerender(<App taskStateMachine={taskStateMachine} />)` after each `setGardenerResult()` call

**Verify**: 
- `npm run build` succeeds
- `grep -n "setGardenerResult" src/orchestrator.ts` shows two usages

### 3. Update PlanningLayout to accept Gardener result prop
**Intent**: Pass Gardener data to layout component for right pane display  
**Files**: `src/ui/ink/components/PlanningLayout.tsx`  
**Changes**:
- Add `gardenerResult?: GardenerResult | null` to `PlanningLayoutProps` interface
- Import `GardenerResult` type from `src/agents/gardener.ts`

**Verify**: `npm run build` succeeds with no TypeScript errors

### 4. Update App.tsx to pass Gardener result to PlanningLayout
**Intent**: Wire Gardener data from state machine to UI component  
**Files**: `src/ui/ink/App.tsx`  
**Changes**:
- In `TASK_SUPER_REVIEWING` case (around line where `PlanningLayout` is rendered for SuperReviewer), add `gardenerResult={taskStateMachine.getGardenerResult()}` prop
- Import `GardenerResult` type if needed for type checking

**Verify**: `npm run build` succeeds

### 5. Modify PlanningLayout left pane content for SuperReviewer phase
**Intent**: Display SuperReviewer results instead of original plan in left pane  
**Files**: `src/ui/ink/components/PlanningLayout.tsx`  
**Changes**:
- Locate the conditional rendering logic that determines left pane content during SuperReviewer phase
- Change from showing `plan` (original plan) to showing `pane1Content` (SuperReviewer results)
- Ensure `pane1Title` is set to "Quality Check Results" or similar

**Verify**: 
- Read `src/ui/ink/components/PlanningLayout.tsx` to confirm logic change
- `npm run build` succeeds

### 6. Implement Gardener status display in right pane
**Intent**: Show Gardener processing status and results in right pane  
**Files**: `src/ui/ink/components/PlanningLayout.tsx`  
**Changes**:
- Add conditional rendering logic for `pane2Content` when `gardenerResult` prop exists:
  - If `gardenerResult === null`: Show "Processing documentation updates..." with spinner
  - If `gardenerResult.success === true`: Show success message, `gardenerResult.message`, and list of `sectionsUpdated`
  - If `gardenerResult.success === false`: Show failure message and `gardenerResult.error` if present
- Set `pane2Title` to "Documentation Update Status" or similar

**Verify**: 
- Read `src/ui/ink/components/PlanningLayout.tsx` to confirm rendering logic
- `npm run build` succeeds

### 7. Test fullscreen functionality preservation
**Intent**: Ensure existing keyboard shortcuts still work for both panes  
**Files**: N/A (verification only)  
**Changes**: None  
**Verify**: 
- `grep -n "onFullscreen" src/ui/ink/components/PlanningLayout.tsx` shows prop still exists
- `grep -n "Ctrl+Q\|Ctrl+W" src/ui/ink/components/PlanningLayout.tsx` confirms shortcuts documented
- Read `useInput` hook in PlanningLayout to confirm Ctrl+Q/W/E handling intact

## Risks & Rollbacks

**Risk 1**: Gardener execution timing might change state too quickly for UI to show "Processing..." status  
- **Mitigation**: Gardener execution typically takes time (file writes, git operations), giving UI time to render
- **Rollback**: Revert orchestrator changes to remove `setGardenerResult()` calls

**Risk 2**: GardenerResult type might not be exported from gardener.ts  
- **Mitigation**: Check export before implementation (Step 1)
- **Rollback**: Export the type or create duplicate interface in state machine file

**Risk 3**: Re-render timing in orchestrator might cause UI flicker  
- **Mitigation**: Place re-render immediately after state update for atomic UI refresh
- **Rollback**: Remove explicit re-render calls if default state change detection works

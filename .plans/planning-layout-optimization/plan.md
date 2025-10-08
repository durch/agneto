# Eliminate Tool Status Update Flicker in PlanningLayout

**Strategic Intent:** Prevent expensive markdown re-formatting by isolating tool status state updates and memoizing computed values.

## Context

PlanningLayout subscribes to high-frequency `tool:status` events via `handleDataUpdate` (line 196), which updates 10+ state variables and triggers full re-renders. The inline IIFE (lines 725-766) and unmemoized MarkdownText components re-compute expensive formatting on every render, even when only the bottom status line changed.

## Acceptance Criteria

- MarkdownText components for plan/task panes do not re-run `prettyPrint()` when tool status changes
- Tool status updates still display in real-time at bottom of layout  
- PlanningLayout does not re-render when only `tool:status` event fires
- TypeScript compilation succeeds with `npm run build`
- All other event subscriptions (plan:ready, refinement:ready, etc.) continue triggering updates as before
- No visual regressions in status line formatting, spinner animation, or markdown rendering

## Steps

### 1. Memoize MarkdownText component
**Intent:** Prevent re-formatting when parent re-renders but `children` prop unchanged  
**Files:** `src/ui/ink/components/MarkdownText.tsx`  
**Changes:**
- Line 16: Wrap component export with `React.memo(MarkdownText)`
- Line 19: Wrap `prettyPrint(props.children || '')` in `React.useMemo(() => prettyPrint(props.children || ''), [props.children])`

**Verification:** Add `console.log('MarkdownText render')` at line 19; confirm it only logs when markdown content changes, not on tool status updates

### 2. Isolate tool:status subscription  
**Intent:** Update only `taskToolStatus` state on tool events, not all 10+ handleDataUpdate variables  
**Files:** `src/ui/ink/components/PlanningLayout.tsx`  
**Changes:**
- After line 84 (existing useEffect hooks), add new isolated subscription:
  ```typescript
  React.useEffect(() => {
    const handler = () => setTaskToolStatus(taskStateMachine.getToolStatus());
    taskStateMachine.on('tool:status', handler);
    return () => taskStateMachine.off('tool:status', handler);
  }, [taskStateMachine]);
  ```
- Line 196: Remove `taskStateMachine.on('tool:status', handleDataUpdate);` from listener registration
- Line 143: Remove `setTaskToolStatus(taskStateMachine.getToolStatus());` from `handleDataUpdate` body

**Verification:** Add `console.log('PlanningLayout render')` at component top; confirm full render does NOT occur on tool:status events (only isolated state update)

### 3. Memoize status line computation
**Intent:** Prevent IIFE re-execution when dependencies haven't changed  
**Files:** `src/ui/ink/components/PlanningLayout.tsx`  
**Changes:**
- Before line 725, extract IIFE logic into `useMemo`:
  ```typescript
  const statusLine = React.useMemo(() => {
    const executionStateMachine = taskStateMachine.getExecutionStateMachine();
    const toolStatus = executionStateMachine?.getToolStatus() || taskToolStatus;
    
    // Lines 730-754 logic: determine statusMessage and showSpinner based on currentState/executionState
    // ... (copy existing IIFE implementation)
    
    return { statusMessage, showSpinner, toolStatus };
  }, [taskToolStatus, currentState, executionState, isQueryInProgress, taskStateMachine]);
  ```
- Lines 725-766: Replace entire IIFE block with:
  ```tsx
  <Text color={statusLine.toolStatus ? "cyan" : undefined} dimColor={!statusLine.toolStatus}>
    {statusLine.showSpinner && <Spinner isActive={true} />}
    {statusLine.showSpinner && " "}
    {statusLine.statusMessage}
  </Text>
  ```

**Verification:** Confirm spinner and status text still update correctly; verify with DEBUG logging that memoized value only recomputes when dependencies change

### 4. Validate integration
**Intent:** Ensure all event flows still work correctly  
**Files:** None (testing step)  
**Changes:** Run task in interactive mode; observe:
- Tool status updates appear during planning/curmudgeon phases
- Plan approval/rejection still works (plan:ready event)  
- Refinement flow intact (refinement:ready event)
- No console errors or TypeScript warnings

**Verification:** `npm run build` succeeds; manually test planning phase with `DEBUG=true` to observe reduced re-render frequency

## Risks & Rollbacks

**Risk:** MarkdownText memoization breaks if props include non-primitive values (objects/functions)  
**Mitigation:** Component only receives `children` (string) prop; safe to memoize on that alone

**Risk:** Dependency array in step 3 `useMemo` incomplete → stale status line  
**Mitigation:** Include all state variables read in computation (taskToolStatus, currentState, executionState, isQueryInProgress, taskStateMachine)

**Rollback:** Revert changes to PlanningLayout.tsx line 196 and MarkdownText.tsx memoization if unexpected behavior occurs

---

**Confidence:** Confident. Curmudgeon feedback correctly identified handleDataUpdate parameter flaw and over-engineering. Revised approach uses existing React patterns (isolated useEffect + useMemo) without new component files. Code delta: ~25 lines vs. original ~120 LOC approach.

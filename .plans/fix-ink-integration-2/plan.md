Based on my analysis of the codebase, I can see the existing Ink UI framework, the orchestrator integration points, and the current planning workflow. I'm confident this integration can work well with the existing architecture.

# Integrate Ink UI Components with Orchestrator Planning Workflow

## Context

The codebase has a complete Ink UI framework with App.tsx and PlanningLayout.tsx components. The orchestrator currently uses terminal-based planning interaction via `getPlanFeedback()` in the `TASK_PLANNING` state. The integration needs to conditionally render the Ink UI when `options.uiMode === 'ink'` while preserving the existing terminal workflow.

## Acceptance Criteria

- When `options.uiMode === 'ink'`, the Ink App component renders with task status display
- In `TASK_PLANNING` state with ink mode, UI callback replaces `getPlanFeedback()`  
- User can approve/revise plans through the Ink interface keyboard controls (A/R keys)
- Plan feedback flows correctly back to orchestrator through Promise-based callback
- Terminal-based workflow remains unchanged when not using ink mode
- The UI displays real-time task state and planning progress visually

## Steps

### 1. Modify runPlanner function signature to accept UI callback
**Intent:** Add optional callback parameter for Ink UI integration  
**Files:** `src/agents/planner.ts:14-22`  
**Verify:** Function signature includes optional `uiCallback?: (feedback: Promise<PlanFeedback>) => void` parameter

### 2. Replace getPlanFeedback call with conditional UI callback usage  
**Intent:** Use UI callback when provided, otherwise fallback to terminal interface  
**Files:** `src/agents/planner.ts:184`  
**Verify:** Code conditionally calls `uiCallback` or `getPlanFeedback()` based on parameter presence

### 3. Add Ink UI imports to orchestrator
**Intent:** Import required Ink components and React rendering functionality  
**Files:** `src/orchestrator.ts:1-20` (imports section)  
**Verify:** Imports include `{ App }`, `{ render }`, `{ PlanFeedback }` and React

### 4. Integrate Ink UI rendering conditionally in orchestrator
**Intent:** Render Ink App component when `options.uiMode === 'ink'` after taskStateMachine creation  
**Files:** `src/orchestrator.ts:192-202` (after taskStateMachine creation)  
**Verify:** Conditional rendering block exists that creates Ink instance and UI callback when ink mode is enabled

### 5. Create Promise-based callback mechanism for plan feedback  
**Intent:** Bridge Ink UI interactions to planner's async workflow  
**Files:** `src/orchestrator.ts:192-202` (within integration block)  
**Verify:** Callback creates Promise that resolves with PlanFeedback when user interacts with Ink UI

### 6. Update App component props to include onPlanFeedback callback  
**Intent:** Pass the callback through to PlanningLayout component  
**Files:** `src/ui/ink/App.tsx:7-9` (AppProps interface)  
**Verify:** AppProps interface includes optional `onPlanFeedback` prop, passed to PlanningLayout

### 7. Ensure proper cleanup and state management  
**Intent:** Handle Ink UI lifecycle and prevent conflicts with terminal output  
**Files:** `src/orchestrator.ts:192-202` (integration block)  
**Verify:** Ink instance is properly unmounted after planning phase completes

### 8. Update runPlanner calls to pass UI callback in ink mode  
**Intent:** Pass the UI callback to runPlanner when ink mode is active  
**Files:** `src/orchestrator.ts` (TASK_PLANNING case blocks)  
**Verify:** Both `runPlanner` calls in orchestrator pass the UI callback parameter when `options.uiMode === 'ink'`

## Risks & Rollbacks

**Risks:**
- Ink UI rendering might conflict with existing terminal output streams
- Promise-based callback timing could disrupt state machine transitions  
- UI lifecycle management complexity could cause memory leaks

**Rollbacks:**
- All changes are conditional on `options.uiMode === 'ink'`
- Terminal workflow is preserved as default fallback
- Can disable ink mode via CLI if issues arise
- Integration is isolated to specific orchestrator section

## Confidence Level

I'm confident this approach will work well because:
- The PlanningLayout already has the `onPlanFeedback` callback infrastructure
- The integration point at line 192 is ideal for conditional UI setup
- The Promise-based callback pattern aligns with existing async planning workflow
- The existing terminal workflow is completely preserved through conditional logic

The main concern is ensuring proper Ink UI lifecycle management to avoid output conflicts, but this can be addressed through careful rendering/unmounting timing.

---
_Plan created after 1 iteration(s) with human feedback_

# Fix Interactive Planning Integration

## Context
The current Ink UI has a PlanningLayout component with approve/reject buttons, but the feedback doesn't flow back to the orchestrator workflow. Plan content is also truncated to 200 characters, preventing proper review. App.tsx doesn't use PlanningLayout, so the three-panel interface isn't accessible during planning.

## Acceptance Criteria
- Plan approval/rejection in PlanningLayout triggers orchestrator workflow continuation
- Full plan content visible (no truncation) for proper review
- PlanningLayout renders in App.tsx during planning states
- Existing CLI planning flow remains functional as fallback

## Steps

1. **Remove plan truncation in PlanningLayout**
   - File: `src/ui/ink/components/PlanningLayout.tsx:130`
   - Intent: Show full plan content instead of `planMd.substring(0, 200)...`
   - Verify: Plan displays completely in UI without truncation

2. **Add feedback callback prop to PlanningLayout**
   - File: `src/ui/ink/components/PlanningLayout.tsx:7-10`
   - Intent: Accept `onPlanFeedback?: (feedback: PlanFeedback) => void` prop
   - Verify: TypeScript compiles without errors

3. **Wire approve/reject handlers to callback**
   - File: `src/ui/ink/components/PlanningLayout.tsx:38-67`
   - Intent: Call `onPlanFeedback?.({type: 'approve'})` in handleApprove, remove getPlanFeedback call in handleReject and use callback instead
   - Verify: Buttons trigger callback with correct feedback type

4. **Integrate PlanningLayout in App.tsx**
   - File: `src/ui/ink/App.tsx:140-152`
   - Intent: Replace placeholder content with `<PlanningLayout>` during planning states (TASK_REFINING, TASK_PLANNING, TASK_CURMUDGEONING)
   - Verify: PlanningLayout renders during planning phases

5. **Connect feedback callback to orchestrator**
   - File: Location where Ink UI is instantiated (likely orchestrator or main entry)
   - Intent: Pass callback that triggers existing planning workflow continuation
   - Verify: Plan approval/rejection actually continues task execution

## Risks & Rollbacks
- **Risk**: Breaking existing CLI planning flow
- **Mitigation**: Keep getPlanFeedback() calls as fallback when UI not active
- **Rollback**: Revert callback integration and restore original CLI-only flow

## Confidence Level
High confidence this approach will work - it's a straightforward callback integration between existing components that already have the necessary functionality.

---
_Plan created after 1 iteration(s) with human feedback_

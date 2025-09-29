# Build Three-Panel Planning Phase Layout

## Context
Replace the placeholder PlanningLayout.tsx with a functional three-panel display showing refined task, plan content, and live activity with interactive action buttons. The TaskStateMachine already provides all needed data through `getContext()` and existing planning handlers are available in `planning-interface.ts`.

## Acceptance Criteria
- Three-panel layout using Ink Box components (40%/40%/full width)
- Real-time display of refined task and plan data from TaskStateMachine
- Interactive action buttons (Approve/Reject) connecting to existing `getPlanFeedback()` handlers
- Proper fallback handling for undefined task/plan data
- Layout responsive to terminal width changes

## Steps

1. **Replace PlanningLayout component with three-panel structure**
   - Intent: Build the core layout with useStdout() for width calculation and Box components for panels
   - Files: `src/ui/ink/components/PlanningLayout.tsx`
   - Verify: Component renders three distinct panels with proper proportions

2. **Wire TaskStateMachine data to display panels**
   - Intent: Connect refined task (`context.taskToUse`), plan content (`context.planMd`), and current state to UI panels
   - Files: `src/ui/ink/components/PlanningLayout.tsx`
   - Verify: Panels show actual task/plan data with proper fallbacks for undefined values

3. **Add action buttons using existing feedback handlers**
   - Intent: Create Approve/Reject buttons that trigger `getPlanFeedback()` from planning-interface.ts
   - Files: `src/ui/ink/components/PlanningLayout.tsx`
   - Verify: Buttons appear and connect to existing planning feedback system

4. **Test layout renders correctly with sample data**
   - Intent: Ensure all panels display properly and buttons work with TaskStateMachine integration
   - Files: Component testing via App.tsx integration
   - Verify: Three-panel layout displays correctly, handles missing data gracefully, buttons function

## Risks & Rollbacks
- **Risk**: Existing planning-interface.ts might not work well with Ink UI integration
- **Rollback**: Revert to placeholder component and keep CLI-based planning interface
- **Confidence**: High - this is essentially boxes with text and basic button integration

---
_Plan created after 1 iteration(s) with human feedback_

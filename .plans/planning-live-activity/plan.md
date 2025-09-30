# Display Live Agent Activity in PlanningLayout

## Context
Add a simple live activity display to PlanningLayout that reads from `taskStateMachine.getLiveActivityMessage()` and shows what agents are currently doing. This is a straightforward UI update - render a method's return value with a spinner.

## Acceptance Criteria
- Live activity message displays in format `{agent}: {message}` when present
- Spinner indicates ongoing activity
- No display when activity is null/undefined
- Existing PlanningLayout functionality remains intact

## Steps

1. **Examine the activity data structure**
   - **Intent**: Understand what `getLiveActivityMessage()` returns
   - **Files**: `src/task-state-machine.ts` (read the method), `src/ui/ink/components/PlanningLayout.tsx` (read current structure)
   - **Verify**: Confirm the method exists and returns `{agent: string, message: string}` or similar
   - **Uncertainty**: If the return format is different than expected, adjust the rendering logic accordingly

2. **Add activity display to PlanningLayout**
   - **Intent**: Render live activity with spinner when data exists
   - **Files**: `src/ui/ink/components/PlanningLayout.tsx`
   - **Changes**: Import spinner component (likely `ink-spinner` or Ink's built-in), call `getLiveActivityMessage()`, conditionally render `<Spinner /> {agent}: {message}`
   - **Verify**: Code compiles without TypeScript errors

3. **Test with a simple task**
   - **Intent**: Confirm activity displays during planning phase
   - **Action**: Run `npm start -- "add a comment to code"`
   - **Verify**: See agent activity messages with spinner during planning; no crashes or missing UI elements

## Risks & Rollbacks
- **If method returns unexpected format**: Adjust rendering logic to match actual structure
- **If no spinner component available**: Use static text indicator (e.g., `"⋯"` or `"•"`)
- **Rollback**: Revert changes to PlanningLayout.tsx if display breaks existing UI

## Confidence
High confidence this will work - it's a simple read-and-render pattern. Only uncertainty is the exact return type of `getLiveActivityMessage()`, which we'll verify in step 1.

# Migrate Plan Approval to Event-Driven CommandBus Pattern

## Context
Currently plan approval uses callback props while refinement approval uses the event-driven CommandBus pattern. This creates architectural inconsistency. We'll standardize on CommandBus by migrating plan approval to match the refinement approval implementation pattern.

## Acceptance Criteria
- orchestrator.ts uses `commandBus.waitForCommand<PlanFeedback>('plan:approve')` instead of creating callback resolvers
- PlanningLayout.tsx sends commands via `commandBus.sendCommand({ type: 'plan:approve' })` instead of calling callback props
- App.tsx no longer passes `onPlanFeedback` callback prop to PlanningLayout
- Plan approval/rejection flow produces identical behavior from user perspective
- Code pattern structurally matches refinement approval implementation

## Steps

1. **Read existing refinement approval implementation for reference pattern**
   - Intent: Understand the exact CommandBus pattern used for refinement approval
   - Files: `src/orchestrator.ts`, `src/ui/ink/App.tsx`, `src/ui/ink/components/PlanningLayout.tsx`
   - Verify: Identify refinement approval command types, waitForCommand usage, and sendCommand invocations

2. **Read plan approval callback implementation**
   - Intent: Identify current callback-based approval logic to be replaced
   - Files: `src/orchestrator.ts` (search for plan feedback resolver), `src/ui/ink/App.tsx` (onPlanFeedback prop), `src/ui/ink/components/PlanningLayout.tsx` (callback invocation)
   - Verify: Locate all three integration points for plan approval callbacks

3. **Update orchestrator.ts to use CommandBus for plan approval**
   - Intent: Replace promise resolver callback with CommandBus.waitForCommand pattern
   - File: `src/orchestrator.ts`
   - Change: Replace plan feedback resolver creation with `const feedback = await commandBus.waitForCommand<PlanFeedback>('plan:approve')`
   - Verify: No more `let planFeedbackResolver` or `new Promise` for plan approval; grep confirms removal

4. **Update PlanningLayout.tsx to send commands instead of calling callbacks**
   - Intent: Replace callback prop invocations with CommandBus.sendCommand calls
   - File: `src/ui/ink/components/PlanningLayout.tsx`
   - Changes:
     - Remove `onPlanFeedback` from component props interface
     - Replace `onPlanFeedback({ approved: true })` with `await commandBus.sendCommand({ type: 'plan:approve', approved: true })`
     - Replace `onPlanFeedback({ approved: false, feedback })` with `await commandBus.sendCommand({ type: 'plan:approve', approved: false, feedback })`
   - Verify: No references to `onPlanFeedback` prop remain; `commandBus` is properly used

5. **Update App.tsx to remove callback prop passing**
   - Intent: Remove now-unused callback prop from PlanningLayout instantiation
   - File: `src/ui/ink/App.tsx`
   - Change: Remove `onPlanFeedback={...}` prop from `<PlanningLayout />` component
   - Verify: No `onPlanFeedback` references in App.tsx; PlanningLayout receives only necessary props

6. **Build verification**
   - Intent: Ensure TypeScript compilation succeeds with all changes
   - Command: `npm run build`
   - Verify: Clean build with no type errors related to plan approval

## Risks & Rollbacks

**Risks:**
- Command type mismatch between sender and receiver causing approval to hang
- Missing CommandBus dependency in PlanningLayout causing runtime errors
- TypeScript prop type errors if interfaces aren't updated correctly

**Rollback:**
- Git revert changes to restore callback-based pattern
- All changes isolated to three files, making rollback straightforward

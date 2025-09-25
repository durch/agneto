# Simplify Plan Approval to Approve/Reject Binary Choice

## Context
The current planning interface presents 6 different modification options which overwhelms users. A simple approve/reject flow with direct feedback would be more intuitive while maintaining the ability to iteratively refine plans.

## Acceptance Criteria
- Plan approval shows exactly 2 options: "Approve" or "Reject (with feedback)"
- Rejecting prompts for free-form text feedback
- Planner receives and incorporates rejection feedback directly
- Interface remains clear and user-friendly
- Non-interactive mode remains unaffected
- Existing plan refinement loop continues working

## Steps

1. **Update planning interface prompt options**
   - Intent: Replace 6 modification options with binary approve/reject choice
   - Files: `src/ui/planning-interface.ts`
   - Verify: Run with DEBUG=true, confirm only 2 options appear in prompt

2. **Modify getUserPlanFeedback to handle binary response**
   - Intent: Process approve/reject selection and collect feedback text on rejection
   - Files: `src/ui/planning-interface.ts` (getUserPlanFeedback function)
   - Verify: Test rejection flow prompts for feedback text, approval proceeds directly

3. **Update FeedbackType enum and related types**
   - Intent: Simplify type system to match new binary interface
   - Files: `src/ui/planning-interface.ts` (FeedbackType enum, related interfaces)
   - Verify: TypeScript compiles without errors (`npm run build`)

4. **Adjust orchestrator's plan refinement handling**
   - Intent: Pass rejection feedback directly to planner without intermediate processing
   - Files: `src/orchestrator.ts` (interactive planning section)
   - Verify: Rejection feedback reaches planner unchanged in DEBUG output

5. **Update planner prompt to handle direct feedback**
   - Intent: Ensure planner interprets free-form feedback correctly
   - Files: `src/prompts/planner.md` (feedback handling section)
   - Verify: Rejected plan gets revised based on specific feedback provided

6. **Test full refinement loop**
   - Intent: Validate complete approve/reject cycle works end-to-end
   - Files: None (testing only)
   - Verify: Create test task, reject with specific feedback, confirm plan updates accordingly

## Risks & Rollbacks
- **Risk**: Users lose granular control over plan modifications
  - Mitigation: Free-form feedback actually provides more flexibility
- **Risk**: Planner misinterprets vague feedback
  - Rollback: Revert planning-interface.ts and orchestrator.ts changes
- **Risk**: Breaking change for users accustomed to current interface
  - Mitigation: Clear terminal output explains new flow

---
_Plan created after 1 iteration(s) with human feedback_

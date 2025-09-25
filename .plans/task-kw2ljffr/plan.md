Excellent! Now let me create the plan to simplify the refinement options:

## Simplify Refinement Approval Options

### Context
The task refinement interface currently has six complicated options for feedback (approve, clarify-goal, add-context, specify-constraints, define-success, start-over). This is unnecessarily complex compared to the planning interface which already uses a simple two-option approach (Approve or Reject with feedback).

### Acceptance Criteria
- Users only see two options: "Approve" or "Reject with feedback"
- When rejecting, users can provide free-form feedback about what needs to change
- The refiner agent receives the feedback as a single instruction for improvement
- The interface remains consistent with the planning interface pattern
- All existing functionality is preserved through the unified feedback mechanism

### Steps

1. **Update refinement feedback type definitions**
   - Intent: Simplify the feedback type to match planning interface pattern
   - Files: `src/ui/refinement-interface.ts` (lines 6-17)
   - Verify: TypeScript compiles without errors for type changes

2. **Simplify the getRefinementFeedback function**
   - Intent: Present only Approve/Reject options and collect free-form feedback
   - Files: `src/ui/refinement-interface.ts` (lines 45-92)
   - Verify: Function returns simplified feedback structure matching new types

3. **Update formatFeedbackForRefiner function**
   - Intent: Handle the new unified reject feedback format
   - Files: `src/ui/refinement-interface.ts` (lines 139-162)
   - Verify: Function properly formats reject feedback into refiner instructions

4. **Adjust interactiveRefinement logic**
   - Intent: Handle simplified feedback flow in the refinement loop
   - Files: `src/ui/refinement-interface.ts` (lines 94-137)
   - Verify: Refinement loop processes approve/reject correctly

5. **Test the simplified interface**
   - Intent: Ensure the new two-option interface works end-to-end
   - Files: Run `test-refiner.ts` if it exists
   - Verify: Interface displays two options, accepts feedback, and refiner responds appropriately

### Risks & Rollbacks
- **Risk**: Users might miss the granular feedback options
- **Mitigation**: Free-form feedback allows users to be as specific as needed
- **Rollback**: Git revert to restore the six-option system if needed

---
_Plan created after 1 iteration(s) with human feedback_

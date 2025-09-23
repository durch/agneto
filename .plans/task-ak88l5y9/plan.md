# Fix SuperReviewer Menu Options for Terminal State Clarity

## Context
The SuperReviewer runs after all execution steps are complete, but its current menu options ('Approve/Retry/Reject') misleadingly suggest automated work will continue. Since the execution loop has finished, these options only affect the final disposition of already-completed work.

## Acceptance Criteria
- Menu shows 'Start New Cycle', 'Accept Incomplete', and 'Abandon' options
- Each option has descriptive explanatory text
- No text suggests automated execution will continue
- Options clearly indicate they affect disposition of completed work
- All "continuing work" references removed from SuperReviewer flow

## Steps

1. **Update menu option labels in human-review.ts**
   - Intent: Replace misleading option names with terminal-state-aware labels
   - Files: `src/ui/human-review.ts`
   - Verify: Check that `promptForSuperReviewerDecision` function uses new option names

2. **Modify menu option descriptions in human-review.ts**
   - Intent: Add clear explanatory text for each option's actual effect
   - Files: `src/ui/human-review.ts`
   - Verify: Each option explains: 'Start New Cycle' = new task with feedback, 'Accept Incomplete' = merge despite issues, 'Abandon' = leave in worktree

3. **Update orchestrator's SuperReviewer decision handling**
   - Intent: Ensure orchestrator correctly maps new option values to existing behavior
   - Files: `src/orchestrator.ts`
   - Verify: 'Start New Cycle' maps to retry logic, 'Accept Incomplete' to approve, 'Abandon' to reject

4. **Remove "continuing work" language from SuperReviewer messages**
   - Intent: Eliminate any text suggesting automated execution will resume
   - Files: `src/orchestrator.ts`
   - Verify: Search for "continu" in SuperReviewer-related code blocks returns no misleading results

5. **Test the updated flow end-to-end**
   - Intent: Confirm new menu appears correctly and options behave as described
   - Files: None (testing step)
   - Verify: Run a task that triggers SuperReviewer issues, confirm menu shows new options with clear text

## Risks & Rollbacks
- Risk: Existing workflows may expect old option values
- Rollback: Git revert the commits if integration issues arise
- Mitigation: Map new values to existing behavior patterns to maintain compatibility

---
_Plan created after 1 iteration(s) with human feedback_

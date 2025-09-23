# Add Human Interaction for 'needs-human' Verdict

## Context
When the Reviewer returns a 'needs-human' verdict, execution currently stops. We need to add an interactive prompt that allows humans to review the proposal and decide whether to approve, reject, or retry with feedback.

## Acceptance Criteria
- When Reviewer returns 'needs-human', system shows the proposal to human
- Human can choose: approve (apply), reject (skip), or retry (with feedback)
- Approved proposals are applied like normal approvals
- Rejected proposals skip the step and continue
- Retry allows human to provide feedback for another attempt
- Uses existing inquirer package for prompts

## Steps

1. **Add human interaction types and interface**
   - Intent: Define the structure for human interaction choices
   - Files: `src/types.ts`
   - Verify: New types for HumanDecision ('approve' | 'reject' | 'retry') and HumanInteractionResult interface exist

2. **Create human review UI component**
   - Intent: Build the interactive prompt for reviewing proposals
   - Files: `src/ui/human-review.ts` (new file)
   - Verify: Exports `promptHumanReview` function that takes proposal and returns HumanInteractionResult

3. **Integrate human review into orchestrator flow**
   - Intent: Call human review when verdict is 'needs-human'
   - Files: `src/orchestrator.ts`
   - Verify: In executeStep, 'needs-human' case calls promptHumanReview and handles all three decision types

4. **Handle retry with human feedback**
   - Intent: Pass human feedback to Coder for retry attempt
   - Files: `src/agents/coder.ts`
   - Verify: Coder accepts optional feedback parameter and includes it in prompt when retrying

5. **Test human interaction flow**
   - Intent: Verify all paths work correctly
   - Files: Create test file with ambiguous change to trigger 'needs-human'
   - Verify: Running task shows prompt, all three options work as expected

## Risks & Rollbacks
- Risk: Breaking existing auto-approve flow - mitigated by only changing 'needs-human' path
- Risk: Inquirer prompt issues in non-TTY environments - existing non-interactive mode handles this
- Rollback: Revert orchestrator.ts changes to restore original behavior

---
_Plan created after 1 iteration(s) with human feedback_

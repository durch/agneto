**Strategic Intent:** Fix the plan rejection flow so rejected plans undergo the full Planner ↔ Curmudgeon simplification loop instead of bypassing Curmudgeon review.

# Fix Plan Rejection to Re-enable Curmudgeon Review

**Context:**

The `userHasReviewedPlan` flag currently persists across plan iterations, causing subsequent plans to skip Curmudgeon review after the first user rejection. This is incorrect—a rejected plan with user feedback produces a substantially different plan that deserves independent Curmudgeon evaluation. The flag should only suppress Curmudgeon when we're showing the *same* plan again after Curmudgeon has already reviewed it.

**Acceptance Criteria:**

- When user rejects a plan with feedback, the resulting new plan from Planner undergoes Curmudgeon review (automatic simplification up to 4 cycles)
- When user approves a plan, execution begins immediately (no change to current behavior)
- Non-interactive mode continues to skip user approval but runs Curmudgeon (no change)
- SuperReviewer retry flow works correctly (flag reset on entering execution remains)
- `npm run build` compiles successfully
- No TypeScript errors introduced

**Steps:**

### 1. Reset flag on plan rejection

*Intent:* Clear the `userHasReviewedPlan` flag when user rejects a plan, so the new plan will go through Curmudgeon review.

*Files:*
- `src/orchestrator.ts` (lines 694-701, rejection handling)

*Changes:*
- In the `TASK_CURMUDGEONING` state block, find where `decision === "reject"` is handled
- After calling `taskStateMachine.setPlan(updatedPlan)`, add `taskStateMachine.setUserHasReviewedPlan(false)`
- This signals that the new plan has not been reviewed yet and should undergo Curmudgeon evaluation

*Verification:*
- Read orchestrator.ts:694-701 to confirm the exact location
- Check that the flag is reset before `continue` statement
- Verify the change is inside the rejection branch only (not the approval branch)

### 2. Verify flag handling for approval path

*Intent:* Confirm approval path continues to set `userHasReviewedPlan = true` and proceeds to execution (no changes needed, verification only).

*Files:*
- `src/orchestrator.ts` (lines 752-781, approval handling)

*Changes:* None (verification only)

*Verification:*
- Read orchestrator.ts:752-781 to confirm approval sets flag to `true`
- Confirm approval transitions to `TASK_EXECUTING` state
- Confirm flag reset at execution entry (lines 825, 1271) remains unchanged

### 3. Review Curmudgeon skip logic

*Intent:* Confirm the skip logic at line 583 will now correctly allow Curmudgeon review after plan rejection.

*Files:*
- `src/orchestrator.ts` (line 583, `getUserHasReviewedPlan()` check)

*Changes:* None (verification only)

*Verification:*
- Read orchestrator.ts:583-628 to understand the skip logic
- Confirm that when `userHasReviewedPlan === false`, Curmudgeon review executes
- Confirm max simplification limit (4 cycles) logic remains intact
- Trace through the flow: rejection sets flag to false → next iteration enters CURMUDGEONING → flag is false → Curmudgeon runs

### 4. Compile and verify type safety

*Intent:* Ensure changes introduce no TypeScript errors or compilation failures.

*Files:*
- All TypeScript files (compilation check)

*Changes:* None (verification only)

*Verification:*
```bash
npm run build
```
- Command must exit with code 0
- No TypeScript errors reported
- Build artifacts generated successfully

**Risks & Rollbacks:**

*Risks:*
- Setting flag to `false` in wrong branch (approval instead of rejection) would break approval flow → Mitigated by careful placement in rejection branch only
- Forgetting to handle non-interactive mode → Mitigated by verification that non-interactive check happens *after* Curmudgeon review
- Race conditions if state machine is accessed concurrently → Low risk; orchestrator.ts appears single-threaded based on async/await patterns

*Rollback:*
- Remove the single line `taskStateMachine.setUserHasReviewedPlan(false)` from rejection handler
- Run `npm run build` to restore previous behavior

**Confidence:** Confident. The root cause is clear (flag not reset on rejection), the fix is minimal (one line), and the integration points are well-understood. The verification steps confirm the change won't affect other flows.

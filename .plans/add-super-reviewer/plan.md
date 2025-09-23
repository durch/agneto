# Add SuperReviewer Final Quality Gate

## Context
Agneto currently has Planner, Coder, and Reviewer personas but lacks a final quality check before merging. A SuperReviewer persona will validate the entire implementation against acceptance criteria and quality standards, providing a final safety gate with human-in-the-loop feedback when issues are detected.

## Acceptance Criteria
- SuperReviewer runs after all plan steps complete, before merge
- Checks: implementation quality, acceptance criteria met, no unnecessary files, tests pass, TypeScript compiles
- Provides verdict: `approve` (ready to merge) or `needs-human` (requires human review)
- In needs-human: presents issues to human who can accept (triggers new cycle) or reject (ends session)
- Integrates seamlessly with existing orchestrator flow

## Steps

1. **Create SuperReviewer agent module**
   - Intent: Define the SuperReviewer agent with review logic
   - Files: Create `src/agents/super-reviewer.ts`
   - Verify: File exists with `runSuperReviewer` function exported, follows pattern from reviewer.ts

2. **Create SuperReviewer prompt**
   - Intent: Define SuperReviewer's review criteria and response format
   - Files: Create `src/prompts/super-reviewer.md`
   - Verify: Prompt includes quality checks, verdict format (`approve`/`needs-human`), clear instructions

3. **Add SuperReviewer types**
   - Intent: Define TypeScript types for SuperReviewer verdicts and feedback
   - Files: Edit `src/types.ts`
   - Verify: `SuperReviewerVerdict` type added with 'approve' | 'needs-human', `SuperReviewerResult` interface defined

4. **Integrate SuperReviewer into orchestrator**
   - Intent: Add SuperReviewer execution after all steps complete
   - Files: Edit `src/orchestrator.ts`
   - Verify: SuperReviewer runs after step loop, before merge decision

5. **Handle needs-human verdict with UI**
   - Intent: Present SuperReviewer feedback to human and handle response
   - Files: Edit `src/ui/planning-interface.ts`, `src/orchestrator.ts`
   - Verify: Human can accept (triggers new cycle) or reject (ends session) when needs-human

6. **Add SuperReviewer to provider configuration**
   - Intent: Ensure provider can handle SuperReviewer persona
   - Files: Edit `src/providers/anthropic.ts` if needed
   - Verify: SuperReviewer can access necessary tools (ReadFile, Grep, Bash for tests)

7. **Test SuperReviewer integration**
   - Intent: Verify SuperReviewer works end-to-end
   - Files: Run `npm run build` then test with simple task
   - Verify: TypeScript compiles, SuperReviewer runs after steps, verdicts handled correctly

## Risks & Rollbacks
- Risk: SuperReviewer too conservative, blocks valid changes → Rollback: Adjust prompt criteria
- Risk: Infinite loops with needs-human → accept → new cycle → Rollback: Add cycle limit
- Risk: Breaking existing flow → Rollback: Git revert changes in worktree

---
_Plan created after 1 iteration(s) with human feedback_

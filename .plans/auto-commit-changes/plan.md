# Plan: Commit Gardener's CLAUDE.md Updates in Worktrees

## Context
Gardener successfully updates CLAUDE.md files in worktrees but changes remain uncommitted. When tasks complete, the merge script only captures committed changes, so Gardener's documentation updates are lost. We need to commit Gardener's changes automatically after `documentTaskCompletion()` returns successfully, using the existing `commitChanges()` helper.

## Acceptance Criteria
- [ ] Gardener's CLAUDE.md modifications are automatically committed in worktrees
- [ ] Commit only happens when Gardener reports success (`success: true` in result)
- [ ] Commit message describes the documentation update
- [ ] If Gardener fails or makes no changes, no commit is attempted
- [ ] Existing chunk-based commit flow remains unchanged
- [ ] All 4 orchestrator call sites handle the result consistently

## Steps

1. **Modify `documentTaskCompletion()` to return `GardenerResult | null`**
   - Intent: Surface Gardener's result to the orchestrator for commit decision
   - File: `src/orchestrator-helpers.ts` (line 133-145)
   - Change: Replace `Promise<void>` with `Promise<GardenerResult | null>` in signature
   - Change: Return `result` instead of void when Gardener succeeds
   - Change: Return `null` from catch block when Gardener fails
   - Verification: TypeScript compiles, function returns `GardenerResult` on success and `null` on failure

2. **Update all 4 orchestrator call sites to capture Gardener's result**
   - Intent: Get Gardener's result at every invocation point for conditional commit
   - File: `src/orchestrator.ts`
   - Lines: 726 (incomplete acceptance, Ink UI), 750 (success, Ink UI), 1139 (incomplete acceptance, non-Ink), 1163 (success, non-Ink)
   - Change: Replace `await documentTaskCompletion(...)` with `const gardenerResult = await documentTaskCompletion(...)`
   - Verification: `grep "gardenerResult = await documentTaskCompletion" src/orchestrator.ts` shows 4 matches, no orphaned void calls remain

3. **Add conditional commit immediately after each `documentTaskCompletion()` call**
   - Intent: Commit Gardener's changes when successful, skip when failed/no-op
   - File: `src/orchestrator.ts` (after lines 726, 750, 1139, 1163)
   - Change: Insert after each `documentTaskCompletion()` call:
     ```typescript
     if (gardenerResult?.success) {
       await commitChanges(
         taskId,
         `docs: Update CLAUDE.md documentation\n\nSections updated:\n${gardenerResult.sectionsUpdated.map(s => `- ${s}`).join('\n')}`
       );
     }
     ```
   - Verification: `grep -A 5 "gardenerResult = await" src/orchestrator.ts` shows conditional commit block after each call

4. **Verify end-to-end flow with test task**
   - Intent: Confirm Gardener's changes are committed and merged
   - Command: `npm start -- "add a comment to README" --non-interactive`
   - Expected: After completion, `cd .worktrees/<task-id> && git log --oneline -3` shows commit with "Update CLAUDE.md documentation"
   - Expected: `git diff master -- CLAUDE.md` in worktree shows no uncommitted documentation changes
   - Verification: Gardener's commit exists in worktree history before merge

5. **Test merge script captures documentation updates**
   - Intent: Ensure squash merge includes Gardener's commit
   - Command: `npm run merge-task <task-id>` for test task from step 4
   - Expected: `git log master --oneline -1` shows squash commit containing both task changes and documentation updates
   - Expected: `git show master -- CLAUDE.md` reflects Gardener's changes
   - Verification: Master branch contains documentation updates after merge

## Risks & Rollbacks

**Risk**: Commit might fail if worktree is in unexpected state (e.g., detached HEAD, conflicts)
- Mitigation: `commitChanges()` already handles git errors gracefully (used for chunk commits)
- Rollback: Revert signature change in `orchestrator-helpers.ts` and remove conditional commit blocks

**Risk**: Multiple commits might clutter worktree history
- Mitigation: Squash merge consolidates all commits (chunk + Gardener) into single master commit
- Impact: Minimal - worktrees are ephemeral and cleaned up after merge

**Confidence**: High. Uses existing tested infrastructure (`commitChanges()`, `GardenerResult`), minimal new code (~20 lines), preserves non-blocking design.

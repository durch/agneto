**Strategic Intent:** Ensure Gardener's CLAUDE.md modifications are committed to the git worktree after successful documentation updates.

# Plan: Commit Gardener Changes to Git Worktree

## Context
The Gardener agent updates CLAUDE.md documentation but its changes are not committed to the git worktree in the new state machine architecture. This issue was introduced when refactoring from direct function calls (which included `commitChanges()`) to the state machine pattern. The fix requires adding a commit step after successful Gardener execution, matching the pattern used by the Coder agent.

## Acceptance Criteria
- [ ] Gardener changes are committed when `gardenerResult.success === true`
- [ ] Commit message follows convention: `"docs: Update CLAUDE.md documentation"`
- [ ] Failed commits do not block task completion
- [ ] Implementation matches Coder's commit pattern
- [ ] TypeScript compiles without errors (`npm run build`)

## Steps

### 1. Add commit step after successful Gardener execution
**Intent:** Commit Gardener's CLAUDE.md changes using the existing `commitChanges()` helper, following the same pattern as Coder

**Files:** `src/orchestrator.ts` (lines 960-999, within `TASK_GARDENING` state handler)

**Implementation:**
- After the `if (gardenerResult.success)` block (around line 993), add commit logic
- Use try-catch to wrap `commitChanges()` call (non-blocking on failure)
- Pass `cwd` and commit message `"docs: Update CLAUDE.md documentation"`
- Match the pattern from Coder's commit calls (lines 1880, 1906, 1951)

**Verification:**
```bash
# Read the TASK_GARDENING handler to confirm commit code added
grep -A 5 "if (gardenerResult.success)" src/orchestrator.ts

# Verify commitChanges is imported and used correctly
grep "commitChanges" src/orchestrator.ts
```

### 2. Verify TypeScript compilation
**Intent:** Ensure the code changes compile without errors

**Files:** All modified TypeScript files

**Verification:**
```bash
npm run build
# Expected: Clean compilation with no TypeScript errors
```

### 3. Review commit pattern consistency
**Intent:** Confirm implementation matches existing patterns in the codebase

**Files:** `src/orchestrator.ts`

**Verification:**
- Compare new commit code structure with Coder's commit calls (lines 1880, 1906, 1951)
- Verify error handling is non-blocking (catches exceptions, logs warnings)
- Confirm commit message matches old implementation convention

## Risks & Rollbacks

**Risks:**
- Commit failures could introduce noise if Gardener runs frequently (mitigated by try-catch with warning log)
- Git state conflicts if worktree is in unexpected state (unlikely, same risk exists for Coder commits)

**Rollbacks:**
- Remove the added commit code block from `TASK_GARDENING` handler
- Gardener will return to previous behavior (updates without commits)

**Confidence:** High - this is a straightforward integration following an established pattern with clear verification steps.

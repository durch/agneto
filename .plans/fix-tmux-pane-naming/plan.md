# Remove TMUX Environment Check to Enforce Pane Title Setting

**Strategic Intent:** Remove the early-return guard that prevents pane title setting in non-tmux environments, allowing the try-catch to handle tmux unavailability gracefully.

## Context

The current implementation in `src/utils/tmux.ts` contains a guard clause (`if (!process.env.TMUX) { return; }`) that prevents the pane title setting logic from executing when not in a tmux session. This guard is redundant because the existing try-catch block already handles errors gracefully. The SuperReviewer confirmed that **no code changes were made** in the previous attempt—the file remains unmodified and no commits exist for this task.

## Acceptance Criteria

- [ ] Lines 4-7 in `src/utils/tmux.ts` are deleted (the `if (!process.env.TMUX) { return; }` block)
- [ ] The function body begins directly with the comment `// Escape double quotes...`
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] Git history shows a commit for this change (not at baseline dcaad9f)
- [ ] Function signature and try-catch logic remain unchanged

## Steps

### 1. Delete the TMUX environment guard clause
**Intent:** Remove lines 4-7 to allow the function to attempt pane title setting regardless of environment, relying on try-catch for error handling.

**Files:**
- `src/utils/tmux.ts` (lines 4-7)

**Verification:**
```bash
# Confirm lines 4-7 no longer contain the environment check
grep -n "process.env.TMUX" src/utils/tmux.ts
# Expected: no output (pattern not found)

# Verify function starts with the escape comment
head -n 10 src/utils/tmux.ts | grep "Escape double quotes"
# Expected: line containing comment is present
```

### 2. Compile and verify syntax
**Intent:** Ensure the TypeScript compiler accepts the change and no type errors exist.

**Files:**
- All TypeScript files (via build process)

**Verification:**
```bash
npm run build
# Expected: exit code 0, no errors in output
```

### 3. Verify git commit exists
**Intent:** Confirm changes were committed and HEAD moved from baseline.

**Files:**
- Git history

**Verification:**
```bash
git log --oneline -1
# Expected: commit SHA different from dcaad9f, commit message describes removal
```

## Risks & Rollbacks

**Risk:** Accidentally removing more than lines 4-7 (e.g., deleting the entire function body).
**Mitigation:** Use precise line-based deletion; verify with `git diff` before committing.

**Rollback:** `git reset --hard dcaad9f` restores baseline state if changes are incorrect.

---

**Confidence:** Confident—this is a straightforward 4-line deletion with clear verification steps. The previous failure was due to non-execution, not incorrect approach.

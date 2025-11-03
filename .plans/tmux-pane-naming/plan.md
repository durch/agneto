# Set tmux Pane Title to Task ID

**Strategic Intent:** Display Agneto task IDs in tmux pane titles to enable visual task tracking across concurrent sessions.

## Context

Agneto executes tasks in isolated worktrees (`.worktrees/<task-id>`). Users running multiple concurrent tasks in tmux panes have no visual indication of which pane corresponds to which task. The task ID is determined in `src/cli.ts` through three paths (explicit, auto-generated, file-based) before calling `runTask()`. We'll add a utility to set the tmux pane title immediately after ID determination, providing visual context for the entire task lifecycle.

## Acceptance Criteria

- Pane title shows task ID (e.g., `auth-fix-1`) when running in tmux
- No errors/exceptions in non-tmux environments
- Works for all three ID determination paths
- Title persists until pane closes or user changes it
- `npm run build` succeeds with zero TypeScript errors
- Zero new dependencies added
- Command injection prevented via proper escaping
- Silent failure if tmux command fails

## Steps

### 1. Create tmux utility module

**Intent:** Encapsulate tmux pane title logic with safe escaping and error handling.

**Files:**
- `src/utils/tmux.ts` (create new)

**Implementation:**
```typescript
import { execSync } from 'child_process';

/**
 * Sets the tmux pane title if running inside a tmux session.
 * Silently fails if not in tmux or if the command fails.
 */
export function setTmuxPaneTitle(title: string): void {
  if (!process.env.TMUX) {
    return; // Not in tmux, do nothing
  }

  try {
    // Escape double quotes to prevent command injection
    const escapedTitle = title.replace(/"/g, '\\"');
    execSync(`tmux select-pane -T "${escapedTitle}"`, { stdio: 'ignore' });
  } catch {
    // Silent failure - tmux command may fail if socket unavailable or pane context changed
  }
}
```

**Verification:**
- TypeScript compiles: `npm run build`
- Manual inspection: file exports single function with correct signature
- Logic review: checks `$TMUX`, escapes quotes, uses try-catch

### 2. Integrate into CLI after task ID determination

**Intent:** Call `setTmuxPaneTitle()` immediately after `taskId` is determined, before `runTask()` invocation.

**Files:**
- `src/cli.ts` (modify)

**Changes:**
- Add import: `import { setTmuxPaneTitle } from './utils/tmux.js';` (after existing imports, ~line 15)
- Insert call after line 209 (after all `taskId` determination logic), before line 232 (`runTask()` call):
  ```typescript
  // Set tmux pane title for visibility across concurrent tasks
  setTmuxPaneTitle(taskId);
  ```

**Verification:**
- TypeScript compiles: `npm run build`
- Manual inspection: call site is after all three ID determination branches (explicit, auto-gen, file-based)
- Manual inspection: call site is before `runTask()` invocation

### 3. Final compilation verification

**Intent:** Ensure zero TypeScript errors and correct module resolution.

**Files:**
- All modified files

**Verification:**
```bash
npm run build
```
Expected: Clean build with exit code 0, no errors/warnings.

## Risks & Rollbacks

**Risks:**
1. **Command injection:** Mitigated by double-quote escaping in utility function
2. **Tmux socket unavailable:** Mitigated by try-catch with silent failure
3. **Module resolution issues:** Using `.js` extension in import per existing codebase ESM patterns
4. **Title not visible:** User responsibility to configure `pane-border-format`; not a blocker

**Rollback:**
If issues arise:
1. Remove import and call site from `src/cli.ts`
2. Delete `src/utils/tmux.ts`
3. `npm run build` to verify clean state

**Confidence:** Confident. Pattern follows existing codebase conventions (execSync usage similar to git commands), integration point is correct (after ID determination, before task execution), and failure modes are handled gracefully.

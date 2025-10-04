# Display Merge Instructions in Ink UI

## Context

After task completion, merge instructions (worktree path, git commands, cleanup commands) must be displayed persistently in the terminal UI and copied to clipboard. The existing `PlanningLayout.tsx` already handles similar "display results + await user confirmation" patterns for `TASK_SUPER_REVIEWING` and `TASK_GARDENING` states. We'll extend this proven pattern to `TASK_FINALIZING`.

## Acceptance Criteria

- Merge instructions displayed in `PlanningLayout` when task reaches `TASK_FINALIZING` state
- Instructions automatically copied to clipboard via `clipboardy` package
- Clipboard status (success/failure) shown to user
- UI waits for Enter key before proceeding to `TASK_COMPLETE`
- Auto-merge flow (`options?.autoMerge`) bypasses new UI and works unchanged
- Works cross-platform (macOS, Linux, Windows)
- Follows existing promise-based approval pattern from SuperReviewer/Gardener

## Steps

### 1. Add clipboardy dependency
**Intent:** Install cross-platform clipboard package  
**Files:** `package.json`  
**Action:** `npm install clipboardy`  
**Verify:** Check `package.json` lists `clipboardy` in dependencies; `npm run build` succeeds

### 2. Add merge instructions storage to TaskStateMachine
**Intent:** Store merge instructions text and clipboard status for UI display  
**Files:** `src/task-state-machine.ts`  
**Action:**
- Add private fields: `mergeInstructions: string | null`, `clipboardStatus: 'success' | 'failed' | null`
- Add methods: `setMergeInstructions(instructions: string, status: 'success' | 'failed')`, `getMergeInstructions()`, `getClipboardStatus()`
- Add to checkpoint serialization (existing `toJSON()` method)

**Verify:** TypeScript compiles; methods return expected values when called

### 3. Copy to clipboard and store in orchestrator
**Intent:** Write merge instructions to clipboard before rendering UI  
**Files:** `src/orchestrator.ts`  
**Action:** In `TASK_FINALIZING` case (around line 1193):
- Import `clipboardy` at top of file
- Build instructions string (lines 1202-1211 already do this)
- Wrap clipboard write in try/catch: `await clipboardy.write(instructions)`
- Call `taskStateMachine.setMergeInstructions(instructions, status)`
- If `options?.autoMerge`, skip UI (existing behavior at line 1217-1220)
- Otherwise: create promise with resolver, pass callback to `inkInstance.rerender()`, await promise (same pattern as line 1145-1165)

**Verify:** 
- Clipboard contains instructions after task completion
- Console shows no clipboard errors
- Auto-merge flow still works (test with `--auto-merge` flag)

### 4. Extend PlanningLayout to handle TASK_FINALIZING
**Intent:** Display merge instructions using existing split-pane pattern  
**Files:** `src/ui/ink/components/PlanningLayout.tsx`  
**Action:**
- In render logic, add case for `currentState === TaskState.TASK_FINALIZING`
- Retrieve instructions via `taskStateMachine.getMergeInstructions()`
- Retrieve clipboard status via `taskStateMachine.getClipboardStatus()`
- Left pane: Display instructions in `<Box>` with `<Text>` (match SuperReviewer pattern around line 180-200)
- Right pane: Show clipboard status message + SelectInput menu with single option "Continue" (match Gardener approval pattern around line 250-270)
- Wire SelectInput `onSelect` to resolver callback (same as existing approval handlers)

**Verify:**
- Instructions visible in terminal after task completes
- Clipboard status message shows ("✅ Copied to clipboard" or "⚠️ Clipboard copy failed")
- Pressing Enter resolves promise and proceeds to `TASK_COMPLETE`
- UI remains on screen until Enter pressed

### 5. Verify end-to-end flow
**Intent:** Ensure complete workflow works  
**Files:** All modified files  
**Action:**
- Run full task: `npm start -- "test task" --task-id test-merge-ui`
- Verify clipboard contains instructions after completion
- Verify UI shows instructions + clipboard status
- Verify pressing Enter proceeds to exit
- Test auto-merge: `npm start -- "test task" --auto-merge --task-id test-auto`
- Verify auto-merge skips new UI screen

**Verify:**
- Manual flow: instructions displayed, clipboard works, Enter exits
- Auto-merge flow: no UI pause, merges automatically
- No TypeScript errors, no runtime crashes

## Risks & Rollback

**Risks:**
- Clipboard API might fail on headless/SSH environments → Handled with try/catch, displays warning
- Promise resolver pattern mismatch between orchestrator and UI → Use exact same pattern as SuperReviewer (lines 1145-1165 in orchestrator, lines 250-270 in PlanningLayout)

**Rollback:**
- Revert orchestrator.ts TASK_FINALIZING changes (clipboard write + promise setup)
- Revert PlanningLayout.tsx TASK_FINALIZING case
- Revert TaskStateMachine methods and fields
- Remove clipboardy dependency

**Confidence:** High - reusing proven SuperReviewer/Gardener patterns, minimal new code (~40 lines total), existing architecture handles this exact use case.

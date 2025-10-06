# Fix Merge Instructions Display After UI Exit

## Context

Git merge instructions are currently logged inside the `TASK_GARDENING` state handler before the Ink UI exits. This creates a race condition where the instructions are written while Ink still controls stdout, causing them to be suppressed or not flushed to the terminal. The fix moves instruction logging to after `inkInstance.waitUntilExit()` resolves, ensuring the terminal is fully released before outputting merge commands.

## Acceptance Criteria

- Merge instructions appear in terminal **after** Ink UI fully exits
- Instructions are visible for both `TASK_COMPLETE` and abandonment paths
- Output includes copy-pasteable commands for reviewing and merging worktree
- Works for both `runTask()` and `runRestoredTask()` execution flows
- No suppression or race conditions with Ink's stdout control

## Steps

### 1. Remove merge instruction logging from TASK_GARDENING state handler
**Intent**: Stop logging instructions prematurely while Ink UI is active  
**Files**: `src/orchestrator.ts:922-930`  
**Action**: Delete the `log.setSilent(false)` and `log.info()` calls for merge instructions  
**Verify**: Build succeeds; instructions no longer appear during TASK_GARDENING phase

### 2. Add merge instruction logging after waitUntilExit() in runTask()
**Intent**: Log instructions after UI has completely released terminal control  
**Files**: `src/orchestrator.ts:287` (after `await inkInstance.waitUntilExit()`)  
**Action**: 
- Check if final state is `TASK_COMPLETE` or `TASK_ABANDONED`
- If `TASK_COMPLETE`, call `log.setSilent(false)` then log merge instructions with task ID
- Instructions should match original format: review commands and merge/cleanup options

**Verify**: Instructions appear **after** UI exit when running `npm start -- "test task"`

### 3. Add merge instruction logging after waitUntilExit() in runRestoredTask()
**Intent**: Ensure instructions appear for restored task executions  
**Files**: `src/orchestrator.ts` (find the restored task's `waitUntilExit()` call, likely around line 370-380 based on structure)  
**Action**: Mirror step 2's logic after restored task's `waitUntilExit()`  
**Verify**: Instructions appear when resuming a checkpoint

### 4. Verify instructions are NOT logged for TASK_ABANDONED state
**Intent**: Ensure instructions only appear on successful completion  
**Files**: Logic from steps 2-3  
**Action**: Add conditional check: only log if final state is `TASK_COMPLETE`, not `TASK_ABANDONED`  
**Verify**: Abandoning a task does **not** show merge instructions

### 5. Extract instruction formatting to helper function
**Intent**: DRY principle - avoid duplicating log format in multiple places  
**Files**: Create helper in `src/orchestrator-helpers.ts`  
**Action**: 
- Add `logMergeInstructions(taskId: string): void` function
- Consolidate the log.setSilent(false) + log.info() calls
- Call from both runTask() and runRestoredTask() paths

**Verify**: Build succeeds; instructions still display correctly in both paths

## Risks & Rollbacks

**Risk**: If waitUntilExit() never resolves (UI hangs), instructions won't appear  
**Mitigation**: Existing timeout/error handling should prevent indefinite hangs

**Risk**: Restored tasks may have different execution paths not covered  
**Mitigation**: Test with checkpoint restoration; add logging to verify state transitions

**Rollback**: Revert to logging in TASK_GARDENING state (current behavior, though flawed)

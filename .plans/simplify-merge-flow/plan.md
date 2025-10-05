# Remove Interactive Merge Flow

## Context

The current Agneto flow includes an interactive merge approval step after Gardener completes. This adds unnecessary complexity. Instead, users should manually execute merge commands after reviewing the worktree. This change simplifies the flow: task completes → UI exits → user reviews → user merges manually.

## Acceptance Criteria

- [ ] Ink UI exits cleanly after Gardener phase completes
- [ ] Terminal outputs clear merge/cleanup commands for manual execution
- [ ] No interactive merge prompts or approval flows remain
- [ ] Commands are copy-pasteable and include both merge and cleanup
- [ ] Worktree remains intact for user review before merge
- [ ] Task completion state is COMPLETE (not waiting for merge approval)

## Steps

### 1. Remove merge approval from TaskStateMachine
**Intent**: Eliminate the TASK_MERGE_APPROVAL state and transition directly to COMPLETE after Gardener  
**Files**: `src/task-state-machine.ts`  
**Action**: 
- Remove `TASK_MERGE_APPROVAL` from TaskState enum
- Remove `MERGE_APPROVED` and `MERGE_SKIPPED` from TaskEvent enum
- Update state transition map to go from `TASK_GARDENING` → `TASK_COMPLETE` directly
- Remove any merge approval handler logic  
**Verify**: `npm run build` succeeds; grep for `TASK_MERGE_APPROVAL` returns no results

### 2. Remove merge approval UI components
**Intent**: Delete the merge approval interface from PlanningLayout  
**Files**: `src/ui/ink/components/PlanningLayout.tsx`  
**Action**:
- Remove any conditional rendering for merge approval state
- Remove merge approval menu/SelectInput components
- Remove merge-related callback props and handlers  
**Verify**: `npm run build` succeeds; component no longer references merge approval

### 3. Update orchestrator to log merge commands instead of prompting
**Intent**: After Gardener completes, log merge commands to terminal and exit  
**Files**: `src/orchestrator.ts`  
**Action**:
- After Gardener phase completes successfully, generate merge command strings
- Use `logUI.info()` to output clear instructions with commands:
  ```
  Task complete! Review changes in worktree, then merge:
  
  cd .worktrees/<task-id> && git log --oneline -5  # Review commits
  npm run merge-task <task-id>                     # Merge and cleanup
  
  Or cleanup without merging:
  npm run cleanup-task <task-id>
  ```
- Transition to TASK_COMPLETE
- No await for user input  
**Verify**: Run a task end-to-end; after Gardener, terminal shows commands and exits

### 4. Remove CommandBus merge approval commands
**Intent**: Clean up unused merge approval command types  
**Files**: `src/ui/command-bus.ts`  
**Action**:
- Remove `merge:approve` and `merge:skip` command type definitions
- Remove any merge-related command interfaces  
**Verify**: `npm run build` succeeds; grep for `merge:approve` returns no usage

### 5. Update App.tsx to exit after COMPLETE state
**Intent**: Ensure Ink UI exits cleanly when task reaches COMPLETE  
**Files**: `src/ui/ink/App.tsx`  
**Action**:
- Verify that `TASK_COMPLETE` state triggers `app.exit()` in useEffect
- Ensure no merge approval blocking occurs  
**Verify**: Run task; UI exits after Gardener completes without hanging

### 6. Verify end-to-end flow
**Intent**: Confirm full task lifecycle works without merge approval  
**Files**: N/A  
**Action**:
- Run: `make quick DESC="test merge removal"`
- Observe: UI exits after Gardener, terminal shows merge commands
- Verify: Worktree exists and can be reviewed
- Execute: Logged merge command manually
- Confirm: Merge succeeds and cleanup works  
**Verify**: Task completes cleanly; merge commands work as documented

## Risks & Rollbacks

**Risk**: Users forget to merge/cleanup worktrees  
**Mitigation**: Clear terminal instructions; existing `make list` shows worktrees

**Risk**: Breaking existing merge tooling (merge-task script)  
**Mitigation**: Step 3 uses existing npm scripts, no changes to merge logic

**Rollback**: Revert commits in this worktree; existing master branch has interactive merge flow intact

## Concerns

- **Confident**: Removing interactive flow simplifies architecture
- **Need verification**: Ensure logUI output is visible after Ink UI exits (may need flush/delay)
- **Question**: Should we add a final summary message about what was accomplished before showing merge commands?

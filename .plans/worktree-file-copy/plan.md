# Simple File Copy Configuration for Worktrees

## Context
When Agneto creates new worktrees, users sometimes need access to untracked files like environment configs or development tools. Currently, only version-controlled files are available in new worktrees.

## Acceptance Criteria
- `.agneto.json` config file with simple `{ "copyToWorktree": ["path1", "path2"] }` format
- Automatic copying of specified files/directories when worktree is created
- Graceful handling of missing config or files (skip and continue)
- Integration with existing `ensureWorktree()` function

## Steps

1. **Add file copying function to worktrees.ts**
   - Intent: Read `.agneto.json` and copy specified untracked files to worktree
   - Files: `src/git/worktrees.ts` 
   - Implementation: Simple function that reads JSON config, iterates file list, uses existing `copyDirectoryRecursive()` for directories and `fs.copyFileSync()` for files
   - Verify: Function compiles and handles missing config gracefully

2. **Import required dependencies in worktrees.ts**
   - Intent: Add filesystem access for JSON reading and file operations
   - Files: `src/git/worktrees.ts`
   - Implementation: Add `import * as fs` and `import * as path` imports, plus import for `copyDirectoryRecursive` from `./sandbox`
   - Verify: TypeScript compiles without errors

3. **Integrate copying into ensureWorktree()**
   - Intent: Automatically copy configured files after worktree creation
   - Files: `src/git/worktrees.ts` (around line 82, after worktree add command)
   - Implementation: Add single line calling the copy function with taskId and worktree dir
   - Verify: Existing worktree creation still works when no config exists

4. **Create example .agneto.json config**
   - Intent: Show users how to configure file copying 
   - Files: `.agneto.json` in project root
   - Implementation: Simple JSON with `copyToWorktree` array containing common examples like `.env.local`, `.vscode/`, `local-config/`
   - Verify: JSON is valid and demonstrates both files and directories

5. **Test the integration**
   - Intent: Verify files are copied correctly and system handles edge cases
   - Files: Test by creating a worktree with config present
   - Implementation: Use Bash to create test scenario with dummy files to copy
   - Verify: Files appear in worktree, missing sources don't break process, malformed JSON is ignored

## Risks & Rollbacks
- **Risk**: Copying large directories slows worktree creation
  - **Rollback**: Simple to disable by removing config or commenting one line
- **Risk**: Permission issues when copying files
  - **Rollback**: Function has try-catch to skip problematic files and continue

## Confidence Level
I'm confident this simplified approach will work. The existing `copyDirectoryRecursive()` function handles the heavy lifting, and the integration point in `ensureWorktree()` is clear and safe.

---
_Plan created after 1 iteration(s) with human feedback_

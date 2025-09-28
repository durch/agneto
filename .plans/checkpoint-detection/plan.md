# Integrate Checkpoint Detection into CLI

## Context
The CLI currently calls `runTask()` directly without checking for existing checkpoints. The RecoveryService provides all necessary detection methods (`hasCheckpoints()`, `getCheckpointSummary()`, `getAvailableCheckpoints()`). Adding checkpoint detection directly to the CLI action function with existing prompt utilities will enable users to choose recovery options before task execution.

## Acceptance Criteria
- CLI detects existing checkpoints before calling `runTask()`
- Users see clear information about available checkpoints with options to proceed with recovery or start fresh
- Integration uses existing RecoveryService API without modifications
- Current CLI behavior preserved when no checkpoints exist
- Error handling for corrupted/inaccessible checkpoints

## Steps

1. **Add checkpoint detection to CLI action function**
   - File: `src/cli.ts` around line 44 (before `runTask()` call)
   - Import RecoveryService and instantiate with taskId
   - Call `hasCheckpoints()` to check for existing checkpoints
   - Verify: CLI can detect when checkpoints exist for a task ID

2. **Add user prompts for checkpoint recovery decisions**
   - File: `src/cli.ts` in the action function
   - Use existing `@inquirer/prompts` (already imported by planning-interface)
   - Present recovery options when checkpoints exist: resume from latest, start fresh, or show details
   - Handle user selection and pass decision context to `runTask()`
   - Verify: Users can choose between recovery options through clear prompts

3. **Handle checkpoint errors gracefully**
   - File: `src/cli.ts` in checkpoint detection logic
   - Catch and log RecoveryService errors (corrupted metadata, missing files)
   - Fall back to normal task execution when checkpoint detection fails
   - Display warning messages for checkpoint issues
   - Verify: CLI continues normally when checkpoint system has errors

4. **Pass recovery context to runTask**
   - File: `src/cli.ts` modify the `runTask()` call
   - Add recovery decision to options object passed to `runTask()`
   - Ensure backward compatibility by making recovery option optional
   - Verify: `runTask()` receives recovery context without breaking existing functionality

## Risks & Rollbacks
**Risk:** Integration might interfere with normal CLI flow
**Rollback:** Remove checkpoint detection code block, restore original direct `runTask()` call

**Risk:** RecoveryService instantiation might fail for invalid task IDs
**Mitigation:** Wrap in try-catch with fallback to normal execution

I'm confident this simplified approach will work. The RecoveryService provides exactly what we need, and adding 20-30 lines to the CLI action function is straightforward integration without architectural complexity.

---
_Plan created after 1 iteration(s) with human feedback_

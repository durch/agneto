# Remove Dynamic Prompt Injection Feature

**Strategic Intent:** Safely excise the Ctrl+I injection feature while preserving all other agent orchestration, UI events, and checkpoint recovery mechanisms.

## Context

Agneto's Ctrl+I feature allows mid-execution prompt injection to agents. This involves keyboard handlers, state management in TaskStateMachine, UI modals, provider integration, orchestrator pause checks, and checkpoint persistence. The feature must be completely removed while ensuring the remaining event-driven architecture and state machine flows remain intact.

## Acceptance Criteria

- [ ] No Ctrl+I keyboard handlers remain in App.tsx or layout components
- [ ] TaskStateMachine has zero injection-related methods, properties, or state
- [ ] TaskStateCheckpoint interface contains no injection fields
- [ ] Provider (anthropic.ts) has no injection prompt augmentation logic
- [ ] Orchestrator loops contain no injection pause checks
- [ ] `injection:pause:requested` event eliminated from event system
- [ ] No UI components reference injection modals or handlers
- [ ] `npm run build` succeeds with zero errors
- [ ] No orphaned imports or undefined method calls
- [ ] Checkpoint restoration does not reference removed injection state

## Steps

### 1. Remove keyboard handler and event emission
**Intent:** Eliminate the Ctrl+I keypress listener that initiates injection flow.

**Files:**
- `src/ui/App.tsx` (lines ~197-214)

**Actions:**
- Delete the `useInput` hook handler for Ctrl+I
- Verify no other keypress handlers are affected

**Verification:**
- Grep for `injection:pause:requested` event emission — should find zero matches in App.tsx
- `npm run build` compiles successfully

---

### 2. Remove injection UI components from layouts
**Intent:** Delete modal dialogs and event listeners for injection input.

**Files:**
- `src/ui/PlanningLayout.tsx`
- `src/ui/ExecutionLayout.tsx`

**Actions:**
- Remove `injectionPauseRequested` state subscriptions (via `stateMachine.on('state:changed', ...)`)
- Delete injection modal conditional renders
- Remove any `setPendingInjection` or `clearPendingInjection` calls in layout components

**Verification:**
- Grep for `injectionPauseRequested|setPendingInjection|clearPendingInjection` in `src/ui/` — should return zero matches in layout files
- Grep for `injection` in layout files — should find no modal or handler references
- `npm run build` succeeds

---

### 3. Purge injection state from TaskStateMachine
**Intent:** Remove all injection-related methods, properties, and event definitions from the state machine.

**Files:**
- `src/task-state-machine.ts` (lines ~149-151 for properties, ~382-422 for methods)

**Actions:**
- Delete `injectionPauseRequested` boolean property (line ~149)
- Delete `pendingInjection` string property (line ~150)
- Delete `agentInjections` Map property (line ~151)
- Delete methods: `requestInjectionPause()`, `clearInjectionPauseRequest()`, `setPendingInjection()`, `clearPendingInjection()`, `getPendingInjection()`, `recordAgentInjection()`, `getAgentInjections()` (lines ~382-422)
- Remove `injection:pause:requested` from event emission anywhere in the class
- Check constructor initialization for injection-related defaults

**Verification:**
- Grep for `injection` in `task-state-machine.ts` — should return zero matches
- `npm run build` succeeds

---

### 4. Remove injection fields from checkpoint interface and restoration
**Intent:** Ensure checkpoint snapshots no longer serialize injection state.

**Files:**
- `src/audit/types.ts` (lines ~175-176 in TaskStateCheckpoint interface)
- `src/task-state-machine.ts` (checkpoint save/restore methods)

**Actions:**
- Delete `pendingInjection?: string` from TaskStateCheckpoint interface
- Delete `agentInjections?: Map<string, string[]>` from TaskStateCheckpoint interface
- In TaskStateMachine's `saveCheckpoint()` method, remove any injection state serialization
- In TaskStateMachine's restore logic, remove any injection state deserialization

**Verification:**
- Grep for `pendingInjection|agentInjections` in `src/audit/types.ts` — should find zero matches
- Grep for `injection` in checkpoint save/restore code — should find zero matches
- `npm run build` succeeds

---

### 5. Remove provider injection logic
**Intent:** Delete the code that reads pending injection and appends it to agent prompts before sending to Claude CLI.

**Files:**
- `src/providers/anthropic.ts` (lines ~248-269)

**Actions:**
- Locate the block that calls `getPendingInjection()` and conditionally appends to the prompt
- Delete the entire block (likely inside `sendMessage` or similar method)
- Remove any related imports (e.g., methods from TaskStateMachine no longer used)

**Verification:**
- Grep for `getPendingInjection|clearPendingInjection` in `anthropic.ts` — should return zero matches
- Grep for `injection` in `anthropic.ts` — should find zero references to injection appending logic
- `npm run build` succeeds

---

### 6. Remove orchestrator pause checks
**Intent:** Eliminate any conditional branches in orchestrator loops that check for `injectionPauseRequested` and pause execution.

**Files:**
- `src/orchestrator.ts`
- `src/orchestrator-helpers.ts` (if any injection checks exist)

**Actions:**
- Grep for `injectionPauseRequested` in both files
- Delete conditional checks and any related pause/await logic
- Ensure no orphaned `clearInjectionPauseRequest()` calls remain

**Verification:**
- Grep for `injection` in `src/orchestrator*.ts` — should return zero matches
- `npm run build` succeeds

---

### 7. Final cleanup and verification
**Intent:** Ensure no stray references, imports, or comments remain; confirm compilation.

**Files:**
- Entire `src/` directory

**Actions:**
- Run `grep -r "injection" src/` (case-insensitive if needed) to find any remaining references
- Remove orphaned imports (e.g., unused methods imported from TaskStateMachine)
- Check for any TODO or AIDEV- comments mentioning injection feature
- Verify no broken type references or undefined method calls

**Verification:**
- `grep -ri "injection" src/` returns only unrelated hits (if any, e.g., dependency injection in unrelated contexts) or zero matches
- `npm run build` compiles with no errors or warnings related to removed code
- Git diff shows clean removal with no accidental deletions of unrelated code

---

## Risks & Rollbacks

**Risks:**
- **Broken checkpoint restoration:** If injection state is serialized in existing checkpoints, restoration might fail. Mitigation: Ensure checkpoint deserialization gracefully ignores missing fields (TypeScript optional fields should handle this).
- **Orphaned event listeners:** Other components might still listen for `injection:pause:requested` event. Mitigation: Thorough grep for event name; verify no listeners remain.
- **Accidental deletion of adjacent code:** Injection logic is interleaved with other state machine methods. Mitigation: Careful line-by-line review; use git diff to confirm only injection-related code is removed.

**Rollback:**
- Git revert commits in this worktree if compilation fails or unintended breakage detected.
- Restore from `.agneto/task-*/` checkpoints if state machine corruption occurs (though we're removing, not corrupting).

**Confidence:** Confident in plan structure; concerned about hidden dependencies in checkpoint restoration and event listener cleanup. Will verify exhaustively with grep and build checks at each step.

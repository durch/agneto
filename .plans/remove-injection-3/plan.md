# Remove Complete Ctrl+I Injection Infrastructure

**Strategic Intent:** Eliminate all remaining dynamic injection infrastructure (state management, provider logic, orchestrator checks, checkpoint serialization) to complete the removal started in the previous attempt.

## Context

The previous implementation successfully removed the UI layer (keyboard handlers, modals, event listeners) but left the entire backend infrastructure intact. This retry must complete the removal by eliminating: TaskStateMachine injection state/methods, provider prompt augmentation, orchestrator pause checks, and checkpoint serialization across 7 files with specific line-targeted deletions.

## Acceptance Criteria

- [ ] TaskStateMachine (src/task-state-machine.ts) has zero injection properties (lines 149-151 removed)
- [ ] TaskStateMachine has zero injection methods (lines 382-422 removed: all 9 methods)
- [ ] TaskStateMachine checkpoint restoration logic removed (lines 792-794)
- [ ] Provider (src/providers/anthropic.ts) injection augmentation block removed (lines 248-269)
- [ ] Orchestrator helper function `checkAndWaitForInjectionPause()` removed (src/orchestrator.ts:102-110)
- [ ] All orchestrator pause checks removed (lines 370-376, 1088, 1543)
- [ ] TaskStateCheckpoint interface injection fields removed (src/audit/types.ts:175-176)
- [ ] TaskStateCheckpoint JSDoc injection documentation removed (src/audit/types.ts:156-174)
- [ ] Checkpoint service serialization logic removed (src/audit/checkpoint-service.ts:213-216)
- [ ] Final verification: `grep -r "injection" src/` returns zero matches (excluding comments in CLAUDE.md references)
- [ ] Build succeeds: `npm run build` completes with exit code 0

## Steps

### 1. Remove TaskStateMachine injection properties and methods
**Intent:** Eliminate complete injection state management layer (3 properties + 9 methods + checkpoint restoration)

**Files:**
- `src/task-state-machine.ts`

**Actions:**
- Delete lines 149-151: `injectionPauseRequested`, `pendingInjection`, `agentInjections` property declarations
- Delete lines 382-422: All 9 injection methods (`requestInjectionPause`, `isInjectionPauseRequested`, `clearInjectionPause`, `setPendingInjection`, `getPendingInjection`, `clearPendingInjection`, `hasPendingInjection`, `setAgentInjection`, `getAgentInjection`, `clearAgentInjection`)
- Delete lines 792-794: Checkpoint restoration block for injection state

**Verification:**
```bash
# No injection properties in class
grep -n "injection" src/task-state-machine.ts | wc -l  # Should be 0

# Methods no longer exist
grep -n "requestInjectionPause\|setPendingInjection\|getAgentInjection" src/task-state-machine.ts  # Should return nothing
```

### 2. Remove provider injection prompt augmentation
**Intent:** Eliminate logic that appends pending injections to agent prompts

**Files:**
- `src/providers/anthropic.ts`

**Actions:**
- Delete lines 248-269: Complete injection detection and augmentation block (if statement checking `getPendingInjection()`, content appending, `clearPendingInjection()` call, debug logging)

**Verification:**
```bash
# No injection logic in provider
grep -n "getPendingInjection\|clearPendingInjection" src/providers/anthropic.ts  # Should return nothing

# Verify augmentedPrompt assignment is clean
grep -A5 "const augmentedPrompt" src/providers/anthropic.ts  # Should show direct assignment without injection block
```

### 3. Remove orchestrator injection pause infrastructure
**Intent:** Eliminate helper function and all pause checks from orchestrator loops

**Files:**
- `src/orchestrator.ts`

**Actions:**
- Delete lines 102-110: `checkAndWaitForInjectionPause()` helper function definition
- Delete lines 370-376: Main loop injection pause check calling `isInjectionPauseRequested()` and `waitForResume()`
- Locate and delete pause checks at lines ~1088 and ~1543 (verify exact lines with grep)

**Verification:**
```bash
# No injection pause checks
grep -n "checkAndWaitForInjectionPause\|isInjectionPauseRequested" src/orchestrator.ts  # Should return nothing

# No waitForResume calls related to injection
grep -n "waitForResume" src/orchestrator.ts | grep -i inject  # Should return nothing
```

### 4. Remove checkpoint interface injection fields and documentation
**Intent:** Clean audit type definitions of injection-related fields

**Files:**
- `src/audit/types.ts`

**Actions:**
- Delete lines 156-174: Complete JSDoc documentation block describing injection feature
- Delete lines 175-176: `injectionPauseRequested?: boolean` and `pendingInjection?: string | null` field declarations from TaskStateCheckpoint interface

**Verification:**
```bash
# No injection fields in checkpoint interface
grep -n "injectionPauseRequested\|pendingInjection" src/audit/types.ts  # Should return nothing

# Verify interface is valid TypeScript
npm run build 2>&1 | grep "types.ts"  # Should show no errors
```

### 5. Remove checkpoint service injection serialization
**Intent:** Eliminate checkpoint save logic that serializes injection state

**Files:**
- `src/audit/checkpoint-service.ts`

**Actions:**
- Delete lines 213-216: Injection state serialization block (comment + two field assignments calling `isInjectionPauseRequested()` and `getPendingInjection()`)

**Verification:**
```bash
# No injection serialization
grep -n "injectionPauseRequested\|pendingInjection" src/audit/checkpoint-service.ts  # Should return nothing

# No calls to injection methods
grep -n "isInjectionPauseRequested\|getPendingInjection" src/audit/checkpoint-service.ts  # Should return nothing
```

### 6. Comprehensive final verification
**Intent:** Confirm zero injection references remain in codebase (excluding documentation)

**Files:** All `src/` directory

**Actions:**
- Run comprehensive grep across entire source tree
- Verify build succeeds

**Verification:**
```bash
# Should return ONLY matches in CLAUDE.md or test fixtures (if any)
grep -r "injection" src/ --include="*.ts" --include="*.tsx"

# More specific: should return absolutely nothing
grep -r "injectionPause\|pendingInjection\|agentInjection\|checkAndWaitForInjectionPause" src/

# Build must succeed
npm run build
echo $?  # Should output: 0
```

## Risks & Rollbacks

**Risk:** Checkpoint restoration may fail if old checkpoints contain injection state
**Mitigation:** Existing optional chaining (`?.()`) will handle missing methods gracefully; old checkpoints will simply skip injection restoration

**Risk:** Orphaned event listeners in code we haven't inspected
**Mitigation:** Final grep verification (Step 6) will catch any remaining references

**Rollback:** If build fails, git diff will show exact deletions to revert; all changes are pure deletions with no refactoring

## Confidence

**Confident** — This is a pure deletion task with specific line ranges identified by SuperReviewer. Each step targets concrete, verified code blocks. The comprehensive grep verification (Step 6) will catch any missed references before claiming completion.

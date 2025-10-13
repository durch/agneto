# Complete Removal of Remaining Injection Infrastructure

**Strategic Intent:** Eliminate all remaining injection-related code from orchestrator, audit types, and checkpoint service to fix compilation failures and complete feature removal.

## Context

The initial removal addressed UI components and partial backend (TaskStateMachine, provider) but missed the orchestration and audit persistence layers. The TypeScript compiler reports 7 errors across 3 files (orchestrator.ts, checkpoint-service.ts, types.ts) where code still references deleted methods. This represents a classic incomplete refactoring where integration and persistence layers were overlooked.

## Acceptance Criteria

- [ ] All 7 TypeScript compilation errors resolved
- [ ] `checkAndWaitForInjectionPause()` helper function removed from orchestrator.ts (lines 102-116)
- [ ] All orchestrator pause checks removed (lines 91, 107, 371-376, 1089, 1544)
- [ ] TaskStateCheckpoint JSDoc documentation removed from audit/types.ts (lines 155-174)
- [ ] `injectionPauseRequested` and `pendingInjection` fields removed from TaskStateCheckpoint interface (lines 175-176, 226-227)
- [ ] Checkpoint service serialization logic removed from checkpoint-service.ts (lines 213-216)
- [ ] TaskStateMachine checkpoint restoration logic removed (lines 746-748)
- [ ] `npm run build` succeeds with exit code 0
- [ ] `grep -rn "injectionPause\|pendingInjection" src/ --include="*.ts"` returns only benign comment references (providers/index.ts, protocol/schemas.ts, agents/reviewer.ts, agents/coder.ts)

## Steps

### 1. Remove orchestrator helper function and pause checks
**Intent:** Eliminate the helper function that coordinates injection pauses and all callsites that check injection state, fixing 5 TypeScript errors in orchestrator.ts

**Files:**
- `src/orchestrator.ts`

**Actions:**
- Delete `checkAndWaitForInjectionPause()` function definition (lines 102-116)
- Remove pause check before planning loop (around line 371-376)
- Remove pause check before SuperReviewer call (around line 1089)
- Remove pause check in retry loop (around line 1544)
- Remove any other callsites found at lines 91, 107 (likely within other control flow blocks)

**Verification:**
```bash
# Should show 0 references to deleted methods in orchestrator
grep -n "isInjectionPauseRequested\|getPendingInjection\|clearPendingInjection\|checkAndWaitForInjectionPause" src/orchestrator.ts

# TypeScript errors for orchestrator.ts should be resolved
npm run build 2>&1 | grep "orchestrator.ts"
```

### 2. Remove injection fields from TaskStateCheckpoint interface
**Intent:** Eliminate injection persistence infrastructure from audit type definitions, fixing 2 TypeScript errors in checkpoint-service.ts that serialize these fields

**Files:**
- `src/audit/types.ts`

**Actions:**
- Delete JSDoc comment block describing injection feature (lines 155-174, approximately 19 lines starting with "* **Injection Handling**")
- Delete `injectionPauseRequested?: boolean;` field declaration (line 175)
- Delete `pendingInjection?: string | null;` field declaration (line 176)
- Remove duplicate references at lines 226-227 if present in documentation

**Verification:**
```bash
# Should show 0 injection references in types.ts
grep -n "injectionPause\|pendingInjection" src/audit/types.ts

# Interface should compile without these fields
npm run build 2>&1 | grep "types.ts"
```

### 3. Remove checkpoint service serialization logic
**Intent:** Delete code that attempts to serialize injection state using now-deleted methods, fixing remaining checkpoint-service.ts compilation errors

**Files:**
- `src/audit/checkpoint-service.ts`

**Actions:**
- Delete the block at lines 213-216 that calls `taskStateMachine.isInjectionPauseRequested()` and `taskStateMachine.getPendingInjection()`
- Verify no other references to injection methods exist in this file

**Verification:**
```bash
# Should show 0 injection references in checkpoint-service.ts
grep -n "injectionPause\|pendingInjection\|isInjectionPauseRequested\|getPendingInjection" src/audit/checkpoint-service.ts

# File should compile cleanly
npm run build 2>&1 | grep "checkpoint-service.ts"
```

### 4. Remove TaskStateMachine checkpoint restoration logic
**Intent:** Delete checkpoint restoration code that attempts to restore injection state, completing the TaskStateMachine cleanup

**Files:**
- `src/task-state-machine.ts`

**Actions:**
- Delete lines 746-748 that restore `injectionPauseRequested` and `pendingInjection` from checkpoint data
- This was missed in the initial TaskStateMachine cleanup pass

**Verification:**
```bash
# Should show 0 functional injection references (comments ok)
grep -n "injectionPause\|pendingInjection" src/task-state-machine.ts

# No errors should remain for task-state-machine.ts
npm run build 2>&1 | grep "task-state-machine.ts"
```

### 5. Verify complete removal and successful compilation
**Intent:** Confirm all injection infrastructure removed except benign documentation comments, and project compiles cleanly

**Files:**
- All `src/**/*.ts`

**Verification:**
```bash
# Full project build should succeed
npm run build
echo "Exit code: $?"  # Must be 0

# Only 4 files with benign comment references should remain
grep -rn "injectionPause\|pendingInjection" src/ --include="*.ts" | wc -l  # Should be ≤6 lines

# Verify specific benign references
grep -rn "injectionPause\|pendingInjection" src/ --include="*.ts" | grep -E "(providers/index|protocol/schemas|agents/reviewer|agents/coder)"

# No references in orchestrator, types, checkpoint-service, or task-state-machine
! grep -n "injectionPause\|pendingInjection" src/orchestrator.ts src/audit/types.ts src/audit/checkpoint-service.ts src/task-state-machine.ts
```

## Risks & Rollbacks

**Risk:** Accidentally removing code with similar naming patterns (e.g., "pause" without "injection" context)  
**Mitigation:** Use precise line number deletions based on SuperReviewer's identification; verify each deletion references injection-specific identifiers

**Risk:** Breaking checkpoint restoration for other valid state  
**Mitigation:** Only remove injection-specific fields (injectionPauseRequested, pendingInjection); leave all other checkpoint fields intact

**Rollback:** Git worktree is isolated; `git reset --hard HEAD` reverts to pre-removal state if needed

## Confidence

**Confident** - SuperReviewer provided exact line numbers for all remaining injection references. TypeScript compiler errors give precise locations. The deletions are surgical removals of identified code blocks with clear verification criteria.

# Fix SuperReviewer Retry to Focus on Feedback, Not Full Task

**Strategic Intent:** Ensure retry cycles address only SuperReviewer's specific feedback by using retry feedback as the sole planning input while preserving original task for reference context.

---

## Context

When SuperReviewer requests retry, the system currently passes both the original task description and SuperReviewer feedback to Planner, causing it to re-plan the entire original task rather than focus solely on fixing the identified issues. The retry feedback is briefly used to update `taskToUse` but then gets cleared, and downstream agents receive mixed signals about scope.

---

## Acceptance Criteria

- [ ] When `isRetry()` is true in Planning phase, `taskToUse` contains **only** the retry feedback text
- [ ] Planner system prompt/context clearly indicates this is a **fix cycle** addressing SuperReviewer issues
- [ ] `runPlanner()` receives explicit `isRetry` flag alongside `superReviewerFeedback`
- [ ] Bean Counter receives clear signal this is a fix cycle (via task description or explicit flag)
- [ ] Original task (`humanTask`/`refinedTask`) remains in TaskContext for reference but doesn't drive retry planning
- [ ] Checkpoint restore correctly reconstructs retry state with `retryFeedback`
- [ ] `npm run build` succeeds after changes

---

## Steps

### 1. Modify Planning Phase to Keep `taskToUse` as Retry Feedback
**Intent:** Stop clearing retry feedback prematurely; make retry feedback the sole planning input during retry cycles.

**Files:**
- `src/orchestrator.ts` (lines 502-510, 538)

**Changes:**
- Remove `clearRetryFeedback()` call at line 510
- Keep `taskToUse = context.retryFeedback!` for the entire Planning phase duration
- Clear retry feedback **after** Planning completes (before CURMUDGEONING or EXECUTING)

**Verification:**
- Add `DEBUG=true` logging in Planning phase showing `taskToUse` value when retry is active
- Verify original task remains in `context.humanTask` or `context.refinedTask`

---

### 2. Pass Explicit `isRetry` Flag to `runPlanner()`
**Intent:** Give Planner clear signal that this is a fix cycle, not a fresh task.

**Files:**
- `src/orchestrator.ts` (line 538)
- `src/agents/planner.ts` (function signature line ~24, implementation line ~40-60)

**Changes:**
- Update `runPlanner()` signature: `async function runPlanner(task: string, superReviewerFeedback?: string, isRetry?: boolean): Promise<PlannerResult>`
- Pass `isRetry: isRetry()` from orchestrator line 538
- In Planner implementation, inject retry-specific context into prompt when `isRetry === true`

**Verification:**
- `npm run build` succeeds
- Grep for all `runPlanner()` call sites to ensure signature compatibility

---

### 3. Update Planner Prompt Injection for Retry Cycles
**Intent:** Frame retry planning as "fix these issues" rather than "re-plan this task."

**Files:**
- `src/agents/planner.ts` (lines ~49-59 where `superReviewerFeedback` is injected)

**Changes:**
- When `isRetry === true`, prepend prompt context: `"This is a RETRY cycle. Address ONLY the following SuperReviewer feedback:"`
- Append: `"Do not re-plan the original task. Focus exclusively on fixing the identified issues."`
- When `isRetry === false`, keep existing behavior

**Verification:**
- Manual test with `DEBUG=true` showing modified prompt structure during retry
- Confirm Planner output focuses on fixes, not full re-implementation

---

### 4. Clear Retry Feedback After Planning Phase Completes
**Intent:** Prevent retry feedback from leaking into subsequent cycles while preserving it through Planning and Curmudgeoning.

**Files:**
- `src/orchestrator.ts` (after Planning phase approval, before EXECUTING or CURMUDGEONING)

**Changes:**
- Find transition point after user approves plan (around line ~550-560)
- Call `clearRetryFeedback()` **after** plan approval, **before** entering CURMUDGEONING or EXECUTING states

**Verification:**
- Checkpoint immediately after plan approval should show `retryFeedback: null`
- Bean Counter receives plan derived from retry feedback, but `context.retryFeedback` is cleared

---

### 5. Signal Bean Counter About Retry Context
**Intent:** Ensure Bean Counter understands this is a fix cycle, not a fresh implementation.

**Files:**
- `src/orchestrator.ts` (line ~578 where `runBeanCounter()` is called)
- `src/agents/bean-counter.ts` (function signature and implementation)

**Changes:**
- **Option A (preferred):** Pass plan context that already reflects retry scope (no signature change needed; plan content itself signals retry)
- **Option B (explicit):** Add `isFixCycle` boolean to `runBeanCounter()` signature and inject context
- **Recommendation:** Use Option A since plan description will naturally indicate "fix X" vs "implement Y"

**Verification:**
- Review Bean Counter output during retry to confirm chunking aligns with fix scope
- `npm run build` succeeds

---

### 6. Verify Checkpoint Restoration Preserves Retry State
**Intent:** Ensure checkpointed retry cycles restore correctly with `retryFeedback`.

**Files:**
- `src/orchestrator.ts` (checkpoint save/restore logic)
- `src/audit/checkpoint.ts` (if retry feedback serialization needs adjustment)

**Changes:**
- Confirm `TaskStateCheckpoint` includes `retryFeedback` field (already present per context)
- Test checkpoint restore during TASK_PLANNING state with active retry
- No code changes expected unless serialization issue found

**Verification:**
- Manual test: trigger retry → checkpoint during Planning → kill process → restore → verify `taskToUse` reflects retry feedback

---

## Risks & Rollbacks

**Risks:**
- **Planner confusion:** If retry feedback is too vague, Planner may struggle to create focused plan → Mitigation: SuperReviewer prompt already guides clear, actionable feedback
- **Bean Counter context loss:** Without original task, Bean Counter may lack integration context → Mitigation: Plan should carry sufficient context; original task remains in `context.humanTask` for reference if needed
- **Checkpoint corruption:** Retry state restoration could fail if serialization mismatches → Mitigation: Verify checkpoint schema includes `retryFeedback` before changes

**Rollback:**
- Git revert changes to `orchestrator.ts` and `planner.ts`
- Restore `clearRetryFeedback()` call to original location (line 510)
- Remove `isRetry` parameter from `runPlanner()` signature

---

**Confidence:** Concerned about whether Bean Counter needs explicit retry signal or if plan context alone suffices. Need human guidance on whether to implement Step 5 Option A or B.

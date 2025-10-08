# Fix Reviewer Rejection Flow to Route Feedback to Coder

**Strategic Intent:** Correct `CODE_REJECTED` event to send feedback to Coder (not Bean Counter) while preserving the approved plan required for re-implementation.

## Context

The `CODE_REJECTED` transition currently routes to `BEAN_COUNTING` state (line 462), sending detailed implementation feedback to the wrong agent. It also incorrectly clears `currentPlan` (line 465), which causes "No approved plan to implement!" errors when transitioning to `IMPLEMENTING` state. The fix is to mirror the proven `CODE_REVISION_REQUESTED` pattern (lines 448-459) which correctly preserves the plan and routes to Coder.

## Acceptance Criteria

- [ ] `CODE_REJECTED` event transitions to `State.IMPLEMENTING` (routes to Coder, not Bean Counter)
- [ ] `currentPlan` preserved across rejection (enables re-implementation without re-planning)
- [ ] `codeFeedback` stores reviewer's detailed rejection reasoning
- [ ] `planAttempts` and `codeAttempts` reset to 0 (allows fresh retry after rejection)
- [ ] Comment accurately describes routing to Coder for re-implementation
- [ ] `npm run build` passes without errors

## Steps

### 1. Fix CODE_REJECTED transition pattern in state machine

**File:** `src/state-machine.ts:460-468`

**Intent:** Copy the proven `CODE_REVISION_REQUESTED` pattern (lines 448-459) to fix routing and plan preservation. The key difference is resetting attempts to 0 (rejection = fresh start) vs incrementing (revision = iterative refinement).

**Changes:**
- **Line 461:** Update comment from "Go back to Bean Counter to re-chunk" → "Provide feedback to Coder for re-implementation"
- **Line 462:** Change `nextState: State.BEAN_COUNTING` → `nextState: State.IMPLEMENTING`
- **Line 463-464:** Keep attempt counter resets (intentional difference from CODE_REVISION_REQUESTED)
- **Line 465-466:** **Remove** `this.context.currentPlan = undefined;` and `this.context.currentChunk = undefined;` (these break re-implementation)
- **Line 467:** Keep `this.context.codeFeedback = data` (correct - sends feedback to Coder)

**Verification:** 
```bash
npm run build
```
Must compile without TypeScript errors.

### 2. Validate integration points

**Intent:** Confirm the fix integrates correctly with orchestrator and Coder without requiring changes.

**Evidence of correct integration:**
- `src/orchestrator.ts:1937-1940` — Already sends `verdict.feedback` in `CODE_REJECTED` event payload
- `src/orchestrator.ts:1813-1818` — `IMPLEMENTING` handler calls `getCurrentPlan()` (requires plan preservation from step 1)
- `src/agents/coder.ts:132-136` — Already consumes `feedback` parameter from `context.codeFeedback`

**Verification:** Review these lines to confirm no additional changes needed. The fix in step 1 completes the circuit.

## Risks & Rollbacks

**Risk:** Attempt counter reset behavior (lines 463-464) might differ from intent vs `CODE_REVISION_REQUESTED` (line 457).
**Mitigation:** This is intentional design — rejection = full reset, revision = incremental retry. Preserve unless requirements specify otherwise.

**Rollback:** Revert 2-line change (lines 462, 465-466) to restore original behavior.

## Confidence

**High confidence.** Fix copies a working pattern (`CODE_REVISION_REQUESTED`) proven in production. SuperReviewer identified the exact bug (plan clearing) and correct solution (preserve plan, route to `IMPLEMENTING`). No assumptions; all integration points verified in existing code.

**Strategic Intent:** Route reviewer rejection feedback to Coder (who can act on it) instead of Bean Counter (who cannot).

# Fix Reviewer Rejection Flow to Target Coder

## Context
The `CODE_REJECTED` event currently sends detailed technical feedback to Bean Counter, who operates at a high-level chunking abstraction and cannot fix implementation issues. This feedback should go to Coder (like `CODE_REVISION_REQUESTED` does) so the agent with file-editing tools can act on the reviewer's technical critique.

## Acceptance Criteria
- `CODE_REJECTED` event transitions to `IMPLEMENTING` state (matching `CODE_REVISION_REQUESTED` pattern)
- Rejection feedback stored in `context.codeFeedback` and available to Coder
- Attempt counters reset on rejection: `codeAttempts = 0`, `planAttempts = 0` (preserves existing behavior)
- Compilation succeeds: `npm run build` passes
- State machine integrity maintained (no invalid transitions)

## Steps

### 1. Update `CODE_REJECTED` event handler in state machine
**Intent:** Change transition target from `BEAN_COUNTING` to `IMPLEMENTING` and store feedback for Coder

**Files:**
- `src/state-machine.ts:460-468`

**Changes:**
- Line 462: change `nextState: 'BEAN_COUNTING'` to `nextState: 'IMPLEMENTING'`
- Line 466: change `planFeedback: payload.feedback` to `codeFeedback: payload.feedback`
- Line 467: verify `codeAttempts: 0` remains (reset behavior)
- Line 467: verify `planAttempts: 0` remains (allow fresh planning)

**Verification:** 
- Read modified file; confirm transition logic matches `CODE_REVISION_REQUESTED` pattern (lines 448-459)
- Run `npm run build` — must compile without errors

### 2. Verify orchestrator still sends correct payload
**Intent:** Ensure `reject-code` verdict handler passes feedback that Coder expects

**Files:**
- `src/orchestrator.ts:1937-1940`

**Changes:**
- Inspect existing `Event.CODE_REJECTED` emission
- Confirm `feedback` field exists and contains reviewer reasoning
- No changes needed (payload structure already correct)

**Verification:**
- Read file; confirm payload includes `feedback` field
- Trace that Coder (src/agents/coder.ts:132-136) can consume `context.codeFeedback`

### 3. Confirm Coder handles rejection feedback
**Intent:** Validate Coder already has logic to process `codeFeedback` from context

**Files:**
- `src/agents/coder.ts:132-136`

**Changes:**
- Inspect existing feedback handling (should already work for `CODE_REVISION_REQUESTED`)
- No changes needed (Coder already consumes `codeFeedback`)

**Verification:**
- Read file; confirm Coder includes `codeFeedback` in prompt when present
- No new code required (reusing existing revision flow)

## Risks & Rollbacks

**Risks:**
- State machine transition could break if `IMPLEMENTING` state unavailable from current context
- Attempt counter logic might have side effects in Bean Counter

**Mitigation:**
- Step 1 mirrors proven `CODE_REVISION_REQUESTED` pattern (lines 448-459)
- Attempt resets preserve existing behavior (no new logic)

**Rollback:**
- Revert `src/state-machine.ts:460-468` to original `BEAN_COUNTING` transition

**Confidence:** High — change is a direct pattern-match to working `CODE_REVISION_REQUESTED` flow; minimal surface area; no new complexity.

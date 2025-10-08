# Clean Log Messages for Merge Instructions and Usage Statistics

**Strategic Intent:** Strip phase badges from final user-facing outputs while preserving them for all in-progress task logging.

## Context

The logging system auto-prepends phase badges (e.g., `[ORCHESTRATION]`) to all messages via `log.info()`. Two final outputs—merge instructions and agent usage stats—appear after the Ink UI exits and should display clean without badges for better readability.

## Acceptance Criteria

- `logMergeInstructions()` outputs git commands without `[ORCHESTRATION]` or `ℹ️ Info:` prefixes
- `logAgentUsageStats()` outputs usage table without any badge prefixes
- All other log messages during task execution retain phase badges unchanged
- `npm run build` compiles successfully
- No changes to badge generation logic for other phases (Planner, Coder, Reviewer, etc.)

## Steps

### 1. Research current implementation and badge flow
**Intent:** Understand how badges are applied and identify integration points for clean output  
**Files:**
- `src/ui/log.ts` (lines 269-291 for `orchestrator()` method, line 529 for badge generation)
- `src/orchestrator-helpers.ts` (lines 149-157 for `logMergeInstructions()`)
- `src/orchestrator.ts` (lines 1058-1059 for call sites)

**Verification:** Confirm `generatePhaseBadge()` flow and identify whether `log` class has a method to bypass badges

### 2. Add badge-bypass method to Logger class
**Intent:** Create a dedicated method for raw output without badge processing  
**Files:**
- `src/ui/log.ts`

**Action:** Add new public method (e.g., `rawInfo()` or `infoNoBadge()`) that writes directly to console without calling `orchestrator()` or applying badges  
**Verification:** Method signature matches existing `info()` but skips badge generation; compiles without errors

### 3. Update `logMergeInstructions()` to use badge-bypass method
**Intent:** Output clean git commands without `[ORCHESTRATION]` prefix  
**Files:**
- `src/orchestrator-helpers.ts` (lines 149-157)

**Action:** Replace `log.info()` calls with the new badge-bypass method  
**Verification:** Function compiles; manually inspect that merge instructions would appear without prefixes

### 4. Check if `logAgentUsageStats()` exists in this worktree
**Intent:** Determine if usage stats function needs updating in this branch  
**Files:**
- `src/orchestrator-helpers.ts`
- `src/orchestrator.ts` (search for `logAgentUsageStats` references)

**Action:** Use `Grep` to locate function; if exists, apply same badge-bypass treatment; if deleted, document that master branch requires same fix  
**Verification:** Either function updated or note added for master branch handling

### 5. Verify compilation and no behavioral regressions
**Intent:** Ensure changes compile and don't break existing logging  
**Files:** All modified files

**Verification:** Run `npm run build` — must succeed with zero errors

## Risks & Rollbacks

**Risks:**
- New method might conflict with existing silent/verbose logic (mitigate: reuse existing silent checks)
- Badge removal might apply too broadly if method misused elsewhere (mitigate: clear naming like `rawInfo()`)

**Rollbacks:**
- Revert new logger method
- Restore original `log.info()` calls in orchestrator-helpers

## Confidence

Confident in approach; slight uncertainty about whether `logAgentUsageStats()` exists in current worktree vs. only in master—will verify in step 4.

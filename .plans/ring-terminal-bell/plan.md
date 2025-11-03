# Add Terminal Bell Notifications to All Human Interaction Prompts

## Strategic Intent
Provide consistent audio feedback for all human interaction prompts by adding terminal bell calls to the four missing locations where user input is required.

## Context
Agneto uses a terminal bell utility (`src/utils/terminal-bell.ts`) to notify users when input is needed. Currently, only planning approval prompts and task completion have bells. Four human interaction points lack bell notifications:

1. **Refinement approval** (PlanningLayout.tsx:182-187)
2. **SuperReview approval** (PlanningLayout.tsx:189-194)
3. **Refiner questions** (PlanningLayout.tsx - uses generic handleDataUpdate)
4. **CLI checkpoint recovery** (cli.ts:71,115)

The event-driven architecture has TaskStateMachine emit events → React handlers in PlanningLayout.tsx update state → UI renders prompts. The bell must ring when the event handler fires, before the prompt becomes visible.

## Acceptance Criteria
- [ ] Terminal bell rings when `refinement:awaiting_approval` event displays prompt
- [ ] Terminal bell rings when `superreview:awaiting_approval` event displays prompt
- [ ] Terminal bell rings when `question:asked` event displays prompt
- [ ] Terminal bell rings for CLI checkpoint recovery prompts (both occurrences)
- [ ] `npm run build` completes successfully
- [ ] Existing bell functionality for planning approval remains unchanged
- [ ] Bell rings once per prompt (no duplicates)

## Steps

### 1. Add bell to PlanningLayout.tsx event handlers
**Intent:** Ring bell when refinement/superreview/question events trigger UI prompts

**Files:**
- `src/ui/ink/components/PlanningLayout.tsx`

**Changes:**
1. Add import at top: `import { bell } from '../../../utils/terminal-bell.js';`
2. Add `bell();` as first line in `handleRefinementAwaitingApproval` (before `setShowRefinementApproval(true)` at line 183)
3. Add `bell();` as first line in `handleSuperReviewAwaitingApproval` (before `setShowSuperReviewApproval(true)` at line 190)
4. Create dedicated question handler (mirroring existing pattern from `planning-interface.ts:53`):
   ```typescript
   const handleQuestionAsked = () => {
     bell();
     handleDataUpdate();
   };
   ```
5. Replace `question:asked` subscription target from `handleDataUpdate` to `handleQuestionAsked` in useEffect

**Verification:**
```bash
npm run build  # Must compile successfully
grep -n "bell()" src/ui/ink/components/PlanningLayout.tsx  # Should show 3 occurrences
grep -n "question:asked" src/ui/ink/components/PlanningLayout.tsx  # Should show handleQuestionAsked subscription
```

### 2. Add bell to CLI checkpoint recovery prompts
**Intent:** Ring bell before CLI prompts when resuming from checkpoints

**Files:**
- `src/cli.ts`

**Changes:**
1. Add import at top: `import { bell } from './utils/terminal-bell.js';`
2. Add `bell();` immediately before `await select(...)` at line 71
3. Add `bell();` immediately before `await select(...)` at line 115

**Verification:**
```bash
npm run build  # Must compile successfully
grep -n "bell()" src/cli.ts  # Should show exactly 2 occurrences (lines ~71 and ~115)
```

## Risks & Rollbacks

**Risk:** Bell utility might fail silently in non-TTY environments  
**Mitigation:** `bell()` already handles this (`process.stdout.write('\x07')` fails gracefully)

**Risk:** Question handler might interfere with other data update events  
**Mitigation:** New handler calls `handleDataUpdate()` internally, preserving existing behavior while adding bell

**Risk:** CLI bell might ring in non-interactive mode  
**Mitigation:** CLI checkpoint prompts only appear in interactive mode (guarded by checkpoint detection logic)

**Rollback:** Remove added `bell()` calls and question handler; restore `question:asked` subscription to `handleDataUpdate`

## Confidence
**Confident** — Pattern is proven (planning-interface.ts:53 already uses this approach), changes are minimal (6 lines across 2 files), and verification is straightforward via compilation + grep. No new dependencies or architectural changes required.

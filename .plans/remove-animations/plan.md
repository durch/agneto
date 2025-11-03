# Remove Interval-Based Animations from UI Components

**Strategic Intent:** Eliminate all setInterval/setTimeout-based animations by replacing them with static displays while preserving visual distinction between states.

## Context

The previous implementation attempt made zero changes to the codebase. All three target files still contain active setInterval calls that cycle animations. The git diff shows HEAD equals baseline commit f4cc807 with no modifications. This plan focuses on the concrete code changes required to remove these intervals.

## Acceptance Criteria

- `useSpinner.ts` returns constant `SPINNER_FRAMES[0]` without setInterval
- `StatusIndicator.tsx` displays static `●` or `○` based on `isActive` prop without blinking
- `BeanCounterAnimation.tsx` displays single static phrase without rotation interval
- `grep -E 'setInterval|setTimeout' src/ui/` returns zero matches in modified files
- `npm run build` succeeds with zero TypeScript errors
- Component props/exports remain unchanged (no breaking interface changes)
- Visual states remain distinguishable (active vs inactive, different components use different static indicators)

## Steps

### 1. Remove animation from useSpinner hook
**Intent:** Replace frame-cycling interval with immediate return of static first frame  
**Files:**
- `src/ui/hooks/useSpinner.ts`

**Changes:**
- Remove `useState` for `frame` (line ~13)
- Remove `useEffect` with `setInterval` (lines ~15-23)
- Change return statement to `SPINNER_FRAMES[0]` directly

**Verification:**
```bash
grep -n 'setInterval\|setTimeout' src/ui/hooks/useSpinner.ts
# Expected: no matches

grep -n 'SPINNER_FRAMES\[0\]' src/ui/hooks/useSpinner.ts  
# Expected: match on return statement
```

### 2. Remove blinking from StatusIndicator
**Intent:** Display solid indicator based on isActive state without interval-based blinking  
**Files:**
- `src/ui/components/StatusIndicator.tsx`

**Changes:**
- Remove `useState` for `blinkOn` (line ~12)
- Remove `useEffect` with `setInterval` (lines ~14-22)  
- Replace conditional `blinkOn ? '●' : ' '` with `isActive ? '●' : '○'` to show distinct static states

**Verification:**
```bash
grep -n 'setInterval\|setTimeout' src/ui/components/StatusIndicator.tsx
# Expected: no matches

grep -n "isActive ? '●' : '○'" src/ui/components/StatusIndicator.tsx
# Expected: match showing static conditional render
```

### 3. Remove phrase rotation from BeanCounterAnimation  
**Intent:** Display single static phrase instead of rotating through array  
**Files:**
- `src/ui/components/BeanCounterAnimation.tsx`

**Changes:**
- Remove `useState` for `unusedPhrases` and `currentPhrase` (lines ~21-22)
- Remove `useEffect` with `setInterval` (lines ~24-41)
- Replace `currentPhrase` render with direct `PHRASES[0]` or select one phrase deterministically

**Verification:**
```bash
grep -n 'setInterval\|setTimeout' src/ui/components/BeanCounterAnimation.tsx
# Expected: no matches

grep -n 'PHRASES\[0\]' src/ui/components/BeanCounterAnimation.tsx
# Expected: match in render logic
```

### 4. Verify no intervals remain and build succeeds
**Intent:** Confirm all animation timers removed and TypeScript compilation passes  
**Files:** All modified files

**Verification:**
```bash
# Check no intervals in any modified UI files
grep -rn 'setInterval\|setTimeout' src/ui/hooks/useSpinner.ts src/ui/components/StatusIndicator.tsx src/ui/components/BeanCounterAnimation.tsx
# Expected: exit code 1 (no matches)

# Verify TypeScript compiles
npm run build
# Expected: exit code 0, "Build successful"

# Confirm changes exist in git
git diff --stat
# Expected: shows 3 files changed with line deletions
```

## Risks & Rollbacks

**Risk:** Removing React hooks (useState/useEffect) might trigger linter warnings about hook count changes  
**Mitigation:** Acceptable - static returns don't need hooks; linter warnings are cosmetic  

**Risk:** Visual distinction lost if both active/inactive show same symbol  
**Mitigation:** StatusIndicator uses `●` vs `○`; other components use different static frames from their respective constant arrays  

**Rollback:** `git checkout src/ui/hooks/useSpinner.ts src/ui/components/StatusIndicator.tsx src/ui/components/BeanCounterAnimation.tsx`

---

**Confidence:** Confident in approach - the changes are surgical (remove intervals, return constants) with clear verification commands. Each step has concrete file paths and grep-based success criteria.

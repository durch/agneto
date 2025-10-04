# Optimize PlanningLayout Getter Calls with Memoization

## Context
Lines 294-334 of `PlanningLayout.tsx` contain 6 getter calls that execute on every render. Since these values only change when `currentState` changes, they can be memoized to prevent unnecessary re-computation. This is a targeted optimization for the component's initialization block.

## Acceptance Criteria
- Lines 294-300 getter calls wrapped in `React.useMemo` with `[currentState]` dependency
- TypeScript compilation succeeds
- Component renders correctly with memoized values
- No functional regressions in planning layout

## Steps

### 1. Memoize getter calls in lines 294-334
**Intent**: Wrap the 6 getter calls in React.useMemo hooks to cache results until currentState changes

**Files**: `src/ui/ink/components/PlanningLayout.tsx` (lines 294-300)

**Changes**:
```typescript
// Replace lines 294-300 with:
const context = React.useMemo(() => taskStateMachine.getContext(), [currentState]);
const taskToUse = context.taskToUse || context.humanTask;
const pendingRefinement = React.useMemo(() => taskStateMachine.getPendingRefinement(), [currentState]);
const planMd = React.useMemo(() => taskStateMachine.getPlanMd(), [currentState]);
const planPath = React.useMemo(() => taskStateMachine.getPlanPath(), [currentState]);
const curmudgeonFeedback = React.useMemo(() => taskStateMachine.getCurmudgeonFeedback(), [currentState]);
const simplificationCount = React.useMemo(() => taskStateMachine.getSimplificationCount(), [currentState]);
```

**Verify**: Read the modified lines to confirm useMemo wrapping and `[currentState]` dependency

### 2. Verify TypeScript compilation
**Intent**: Ensure memoization doesn't introduce type errors

**Command**: `npm run build`

**Verify**: Build succeeds without TypeScript errors in PlanningLayout.tsx

## Risks & Rollbacks
**Risk**: Incorrect dependency array could cause stale values  
**Mitigation**: `currentState` is the correct dependency per requirements  
**Rollback**: `git checkout src/ui/ink/components/PlanningLayout.tsx`

**Confidence**: High - minimal change, clear scope, matches stated requirements exactly

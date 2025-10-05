# Simplify Promise Resolver Pattern

## Context
The refinement, answer, and superReviewer callbacks currently accept promises and require dummy promise creation/extraction in the UI. The existing `onPlanFeedback` callback already demonstrates the simpler pattern: it accepts the feedback value directly and calls the resolver internally. We'll align the three complex callbacks to this existing pattern.

## Acceptance Criteria
- Remove all dummy promise creation from PlanningLayout.tsx (lines 117-129, 137-148, 156-168)
- Change orchestrator callback signatures from `(promise: Promise<T>) => void` to `(value: T) => void`
- Update PlanningLayout.tsx to call callbacks directly with values (no state storage)
- TypeScript compiles without errors
- All existing functionality preserved

## Steps

### 1. Update orchestrator.ts callback signatures
**Intent:** Change three callbacks from promise-accepting to value-accepting to match `onPlanFeedback` pattern

**Files:** `src/orchestrator.ts`

**Changes:**
- Line ~436-449 (refinement): Change `(feedbackPromise: Promise<Feedback>)` to `(feedback: Feedback)` and call `resolverFunc(feedback)` directly
- Line ~381-383 (answer): Change `(answerPromise: Promise<string>)` to `(answer: string)` and call `answerResolverFunc(answer)` directly  
- Line ~1084-1099 (superReviewer): Change `(decisionPromise: Promise<SuperReviewerDecision>)` to `(decision: SuperReviewerDecision)` and call `resolverFunc(decision)` directly

**Verify:** Run `npm run build` - TypeScript should compile without errors in orchestrator.ts

### 2. Remove dummy promise logic from PlanningLayout.tsx
**Intent:** Simplify UI to call callbacks directly with values, matching how `onPlanFeedback` already works

**Files:** `src/ui/ink/components/PlanningLayout.tsx`

**Changes:**
- Lines 117-129: Remove useEffect hook, remove `refinementResolver` state, call `onRefinementFeedback?.({ type: 'approve' })` directly in handleRefinementApprove
- Lines 137-148: Remove useEffect hook, remove `answerResolver` state, call `onAnswerCallback?.(answer)` directly in handleAnswerSubmit
- Lines 156-168: Remove useEffect hook, remove `superReviewerResolver` state, call `onSuperReviewerDecision?.({ action: 'approve' })` directly in handleSuperReviewerApprove

**Verify:** 
- Run `npm run build` - TypeScript should compile without errors
- Check component renders without runtime errors
- Verify similar direct callback pattern exists for `onPlanFeedback` (reference implementation)

## Risks & Rollbacks

**Risk:** UI callbacks called before orchestrator sets up promise resolver  
**Mitigation:** Orchestrator creates callbacks before rendering UI (existing pattern)  
**Rollback:** Git revert changes, restore dummy promise pattern

**Risk:** TypeScript type mismatches in callback signatures  
**Mitigation:** Follow exact pattern from existing `onPlanFeedback` implementation  
**Rollback:** Restore original callback type signatures

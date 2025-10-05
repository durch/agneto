# Cleanup SuperReviewer Migration Remnants

## Context
The SuperReviewer decision handling was migrated to CommandBus (commit 27e4d0b), but deprecated promise resolver callback code remains. Merge approval is the only flow still using callbacks and needs CommandBus migration. All other approval flows (plan, refinement, SuperReviewer, question answering) already use CommandBus successfully.

## Acceptance Criteria
- All deprecated resolver state removed from PlanningLayout.tsx (`superReviewerResolver`, `refinementResolver`, `mergeApprovalResolver`)
- All deprecated callback props removed from interfaces (`onRefinementFeedback`, `onMergeApprovalCallback`)
- Merge approval migrated to CommandBus pattern matching existing flows
- Modal context type cleaned up (no 'superreviewer' literal)
- Manual `inkInstance.rerender()` calls removed from orchestrator
- TypeScript compiles without errors
- Merge approval functionality unchanged from user perspective

## Steps

### 1. Migrate merge approval to CommandBus in orchestrator.ts
**Intent**: Replace promise resolver callback pattern with CommandBus event-driven pattern  
**Files**: `src/orchestrator.ts`  
**Actions**:
- Replace lines 1021-1035 callback resolver pattern with `await commandBus.waitForCommand<MergeApprovalDecision>('merge:approve')` 
- Remove `onMergeApprovalCallback` prop passing (line 1030)
- Remove manual `inkInstance.rerender()` call (line 1030)
- Follow exact pattern from SuperReviewer flow (lines 989-1009)

**Verify**: `grep -n "mergeCallback\|onMergeApprovalCallback" src/orchestrator.ts` returns no matches

### 2. Update PlanningLayout.tsx to handle merge approval via CommandBus
**Intent**: Remove all deprecated resolver state and add CommandBus merge approval handling  
**Files**: `src/ui/ink/components/PlanningLayout.tsx`  
**Actions**:
- Remove `superReviewerResolver` state declaration and all references (lines 56, 623, 742, 755, 763, 769)
- Remove `refinementResolver` state declaration and all references (line 55 + usage sites)
- Remove `mergeApprovalResolver` state declaration and all references (lines 57, 132, 784, 795, 796, 798, 799)
- Add merge approval CommandBus handlers (`handleMergeApprove`, `handleMergeSkip`) following refinement pattern (lines 161-174)
- Update modal context type to remove 'superreviewer' literal (lines 47, 88)

**Verify**: `grep -n "Resolver" src/ui/ink/components/PlanningLayout.tsx` returns no matches

### 3. Remove deprecated callback props from App.tsx interface
**Intent**: Clean up prop interfaces no longer used  
**Files**: `src/ui/ink/App.tsx`  
**Actions**:
- Remove `onRefinementFeedback` prop from interface (line 18)
- Remove `onMergeApprovalCallback` prop from interface (line 20)

**Verify**: `grep -n "onRefinementFeedback\|onMergeApprovalCallback" src/ui/ink/App.tsx` returns no matches

### 4. Remove unused prop passing throughout orchestrator
**Intent**: Clean up undefined callback props passed to UI  
**Files**: `src/orchestrator.ts`  
**Actions**:
- Remove `onRefinementFeedback: undefined` from all UI render calls (lines 868, 897, 964, 1033)

**Verify**: `grep -n "onRefinementFeedback" src/orchestrator.ts` returns no matches

### 5. Add merge approval command types to CommandBus
**Intent**: Ensure TypeScript types support new merge commands  
**Files**: `src/ui/command-bus.ts` (if type definitions needed)  
**Actions**:
- Check if `MergeApprovalDecision` type exists
- Add if missing: `export type MergeApprovalDecision = { type: 'merge:approve' } | { type: 'merge:skip' }`

**Verify**: `grep -n "MergeApprovalDecision" src/ui/command-bus.ts` shows type definition

### 6. Final verification build and search
**Intent**: Confirm all remnants removed and code compiles  
**Files**: All modified files  
**Actions**:
- Run `npm run build` - must succeed with zero errors
- Run `grep -r "superReviewerResolver\|refinementResolver\|mergeApprovalResolver\|onRefinementFeedback\|onMergeApprovalCallback" src/` - must return no matches (excluding comments)

**Verify**: Build succeeds, search returns empty or only comment/doc references

## Risks & Rollbacks

**Risks**:
- Merge approval flow might break if CommandBus wiring incorrect
- TypeScript compilation errors if types not properly updated
- UI modal visibility logic may need adjustment for merge commands

**Rollback**: 
- Revert via `git checkout HEAD -- src/orchestrator.ts src/ui/ink/components/PlanningLayout.tsx src/ui/ink/App.tsx src/ui/command-bus.ts`
- Old callback pattern was functional, so revert restores working state

**Mitigation**:
- Follow proven CommandBus pattern from SuperReviewer migration (already working)
- Test merge approval manually after each step
- Incremental commits allow selective rollback if needed

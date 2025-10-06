# Migrate Human Review to CommandBus Event-Driven Architecture

## Context

The human review flow currently uses deprecated promise resolvers passed through callback props. This needs to be migrated to the CommandBus event-driven architecture already proven in plan approval, refinement approval, and SuperReviewer flows. Additionally, command type names must align with UI terminology (approve/retry/reject).

## Acceptance Criteria

- ExecutionLayout sends commands via `commandBus.sendCommand({ type: 'humanreview:approve|retry|reject', feedback })` (payload contains only feedback, not decision)
- CommandBus command types renamed: `humanreview:retry` (was revise), `humanreview:reject` (was needs_human), approve unchanged
- CommandBus mapping logic (lines 104-110, 161-169) updated with new case labels and correct HumanInteractionResult structure
- Orchestrator uses `commandBus.waitForAnyCommand<HumanInteractionResult>(['humanreview:approve', 'humanreview:retry', 'humanreview:reject'])` 
- onHumanReviewDecision callback prop removed from ExecutionLayout interface (line 72) and App.tsx (lines 19, 410)
- humanReviewResolver state and useEffect (lines 100-141) deleted from ExecutionLayout
- Existing decision handling (orchestrator lines 1691-1705) works unchanged with new command types

## Steps

### 1. Rename command types in CommandBus (src/ui/command-bus.ts)

**Intent:** Align command type strings with UI terminology (retry/reject instead of revise/needs_human)

**Files:** `src/ui/command-bus.ts`

**Changes:**
- Lines 84-86: Rename type definitions `'humanreview:revise'` → `'humanreview:retry'`, `'humanreview:needs_human'` → `'humanreview:reject'`
- Lines 106, 109: Update switch case labels to `'humanreview:retry'` and `'humanreview:reject'`
- Lines 164, 167: Update type guard switch cases to match new names
- Lines 104-110: Verify mapping returns `{ decision: 'approve|retry|reject', feedback }` structure (decision values remain unchanged)

**Verify:** `npm run build` compiles without type errors; grep for old command names returns no matches

### 2. Replace resolver calls with CommandBus in ExecutionLayout (src/ui/ink/components/ExecutionLayout.tsx)

**Intent:** Remove promise resolver pattern and wire UI buttons to CommandBus commands

**Files:** `src/ui/ink/components/ExecutionLayout.tsx`

**Changes:**
- Line 398 (approve button): Replace resolver call with `await commandBus.sendCommand({ type: 'humanreview:approve', feedback: '' })`
- Line 404 (reject button): Replace with `await commandBus.sendCommand({ type: 'humanreview:reject', feedback: 'User chose to skip this chunk' })`
- Line 422 (retry modal submit): Replace with `await commandBus.sendCommand({ type: 'humanreview:retry', feedback: feedbackText })`
- Delete lines 100-141 (humanReviewResolver state, useEffect hook)

**Verify:** Grep for `humanReviewResolver` returns no matches; ExecutionLayout contains zero promise resolver code

### 3. Replace promise pattern in orchestrator (src/orchestrator.ts)

**Intent:** Use CommandBus.waitForAnyCommand instead of creating promise with resolver callback

**Files:** `src/orchestrator.ts`

**Changes:**
- Lines 1667-1705: Replace entire promise creation block with:
  ```typescript
  const result = await commandBus.waitForAnyCommand<HumanInteractionResult>([
    'humanreview:approve',
    'humanreview:retry', 
    'humanreview:reject'
  ]);
  ```
- Keep existing decision handling (lines 1691-1705) unchanged - already correctly checks `result.decision === 'approve' | 'retry' | 'reject'`

**Verify:** Orchestrator contains no `onHumanReviewDecision` callback creation; grep for `new Promise.*resolve.*humanReview` returns nothing

### 4. Remove deprecated callback props (src/ui/ink/App.tsx, ExecutionLayout interface)

**Intent:** Delete unused callback prop references from component contracts

**Files:** 
- `src/ui/ink/components/ExecutionLayout.tsx` (interface definition)
- `src/ui/ink/App.tsx` (prop passing)

**Changes:**
- ExecutionLayout.tsx line 72: Remove `onHumanReviewDecision?: ...` from interface
- App.tsx line 19: Remove from AppProps interface
- App.tsx line 410: Remove prop from ExecutionLayout component instantiation

**Verify:** Grep for `onHumanReviewDecision` returns zero matches across codebase

## Risks & Rollbacks

**Risk:** CommandBus mapping returns wrong decision value structure
- **Mitigation:** Lines 104-110 mapping already correct, just needs case label updates
- **Rollback:** Revert command-bus.ts changes, restore old command type names

**Risk:** Orchestrator decision handling breaks with new command types
- **Mitigation:** Decision values ('approve'/'retry'/'reject') unchanged, only command type strings renamed
- **Rollback:** Revert Step 3, restore promise pattern

**Risk:** UI buttons don't trigger orchestrator actions
- **Mitigation:** Pattern proven in SuperReviewer migration (same sendCommand → waitForAnyCommand flow)
- **Rollback:** Restore humanReviewResolver state and callback wiring

## Verification

End-to-end test: Trigger human review during execution, verify:
1. Clicking "Approve" → orchestrator receives `{ decision: 'approve', feedback: '' }`
2. Clicking "Reject" → orchestrator receives `{ decision: 'reject', feedback: '...' }`
3. Modal submit → orchestrator receives `{ decision: 'retry', feedback: <user input> }`
4. No console errors about missing resolvers or undefined callbacks

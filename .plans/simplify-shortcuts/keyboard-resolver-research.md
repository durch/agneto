# Keyboard Handler and Resolver Wiring Research

## Overview
This document analyzes the existing keyboard shortcut implementation in PlanningLayout and ExecutionLayout to understand how user input flows to resolver functions. This research ensures we preserve identical behavior when replacing `useInput` with `SelectInput` menus.

---

## PlanningLayout.tsx - Keyboard Shortcuts (lines 139-219)

### Refinement Phase (TASK_REFINING)
**State Check**: `currentState === TaskState.TASK_REFINING && refinementResolver && taskStateMachine.getPendingRefinement()`

| Key | Action | Resolver Call |
|-----|--------|---------------|
| `a` or `A` | Approve | `refinementResolver({ type: 'approve' })` |
| `r` or `R` | Reject | Opens modal → `refinementResolver({ type: 'reject', details: feedbackText })` |

**Resolver Setup** (lines 101-116):
- Effect triggers when `onRefinementFeedback` callback provided
- Creates dummy promise, calls `onRefinementFeedback(dummyPromise)`
- Orchestrator attaches resolver to `(dummyPromise as any).resolve`
- UI extracts and stores resolver: `setRefinementResolver(() => resolver)`
- Resolver cleared after use: `setRefinementResolver(null)`

---

### Planning Phase (TASK_PLANNING)
**State Check**: `currentState === TaskState.TASK_PLANNING`

| Key | Action | Resolver Call |
|-----|--------|---------------|
| `a` or `A` | Approve | `onPlanFeedback?.({ type: 'approve' })` |
| `r` or `R` | Reject | Opens modal → `onPlanFeedback?.({ type: 'wrong-approach', details: feedbackText })` |

**Resolver Pattern**:
- Uses direct callback `onPlanFeedback` (not promise-based)
- No local resolver state needed
- Calls callback directly with feedback object

---

### SuperReviewer Phase (TASK_SUPER_REVIEWING)
**State Check**: `currentState === TaskState.TASK_SUPER_REVIEWING && superReviewerResolver`

| Key | Action | Resolver Call |
|-----|--------|---------------|
| `a` or `A` | Approve | `superReviewerResolver({ action: 'approve' })` |
| `r` or `R` | Retry | Opens modal → `superReviewerResolver({ action: 'retry', feedback: feedbackText })` |
| `x` or `X` | Abandon | `superReviewerResolver({ action: 'abandon' })` |

**Resolver Setup** (lines 119-136):
- Same promise pattern as refinement
- Effect triggers when `onSuperReviewerDecision` callback provided
- Creates dummy promise, orchestrator attaches resolver
- UI extracts: `setSuperReviewerResolver(() => resolver)`
- Resolver cleared after use: `setSuperReviewerResolver(null)`

---

### Navigation Shortcuts (Global)
| Key | Action | Notes |
|-----|--------|-------|
| `←` | Focus left pane | `setFocusedPane('left')` |
| `→` | Focus right pane | `setFocusedPane('right')` |
| `Tab` | Cycle focus | Toggle between left/right |
| `Enter` | Fullscreen focused pane | Opens modal with content |
| `Esc` | Exit fullscreen | Only in fullscreen mode |

---

## ExecutionLayout.tsx - Keyboard Shortcuts (lines 106-127)

### Human Review Phase (needs-human verdict)
**State Check**: `executionStateMachine?.getNeedsHumanReview() && humanReviewResolver`

| Key | Action | Resolver Call |
|-----|--------|---------------|
| `a` or `A` | Approve | `humanReviewResolver({ decision: 'approve' })` |
| `r` or `R` | Retry | Opens modal → `humanReviewResolver({ decision: 'retry', feedback: feedbackText })` |
| `x` or `X` | Reject | `humanReviewResolver({ decision: 'reject' })` |

**Resolver Setup** (lines 87-103):
- Same promise pattern as PlanningLayout refinement/superreviewer
- Effect triggers when `onHumanReviewDecision` callback provided
- Creates dummy promise, orchestrator attaches resolver
- UI extracts: `setHumanReviewResolver(() => resolver)`
- After resolution: clears resolver AND calls `executionStateMachine.clearHumanReview()`

---

## Common Patterns Identified

### Promise-Based Resolver Pattern (Used in 3 cases)
```typescript
// 1. Orchestrator creates promise with attached resolver
const dummyPromise = new Promise<T>((resolve) => {});
callback(dummyPromise);  // Orchestrator attaches resolver
const resolver = (dummyPromise as any).resolve;

// 2. UI stores resolver in state
setResolver(() => resolver);

// 3. Keyboard handler calls resolver
resolver(resultValue);

// 4. Clean up
setResolver(null);
```

**Used For**:
- Refinement approval (`RefinementFeedback`)
- SuperReviewer decisions (`SuperReviewerDecision`)
- Human review during execution (`HumanInteractionResult`)

### Direct Callback Pattern (Used in 1 case)
```typescript
// No local state needed
onPlanFeedback?.({ type: 'approve' });
```

**Used For**:
- Plan approval/rejection (`PlanFeedback`)

### Modal Text Input Pattern (Shared)
Both layouts use `TextInputModal` component for collecting feedback:
- Triggered by 'R' key (reject/retry actions)
- Modal captures text input
- On submit: resolver called with feedback text
- On cancel: modal closes, no resolver call

---

## Critical Implementation Details for Menu Migration

### 1. Resolver Wiring Requirements
- **Promise-based resolvers**: Must use orchestrator's resolver, not create new promise
- **Direct callbacks**: Can call synchronously without state
- **Cleanup**: Always clear resolver state after calling it

### 2. State Guard Conditions
Every keyboard handler checks:
- Current state matches expected phase
- Resolver/callback is available
- Any additional data is present (e.g., `getPendingRefinement()`)

### 3. Text Feedback Collection
- Some actions need immediate resolution (approve/reject)
- Some need text input first (retry/wrong-approach)
- Modal handles text collection, then calls resolver

### 4. Execution Layout Specifics
- Additional cleanup: `executionStateMachine.clearHumanReview()`
- Uses execution state machine methods, not task state machine

---

## SelectInput Menu Implementation Requirements

### For Each Approval Point:

1. **Refinement Approval**
   - Menu items: ["Approve", "Reject"]
   - Approve → `refinementResolver({ type: 'approve' })`
   - Reject → Show TextInputModal → `refinementResolver({ type: 'reject', details: text })`

2. **Plan Approval**
   - Menu items: ["Approve", "Reject"]
   - Approve → `onPlanFeedback?.({ type: 'approve' })`
   - Reject → Show TextInputModal → `onPlanFeedback?.({ type: 'wrong-approach', details: text })`

3. **SuperReviewer Decision**
   - Menu items: ["Approve", "Retry with Feedback", "Abandon"]
   - Approve → `superReviewerResolver({ action: 'approve' })`
   - Retry → Show TextInputModal → `superReviewerResolver({ action: 'retry', feedback: text })`
   - Abandon → `superReviewerResolver({ action: 'abandon' })`

4. **Human Review (Execution)**
   - Menu items: ["Approve", "Retry with Feedback", "Reject"]
   - Approve → `humanReviewResolver({ decision: 'approve' })` + `clearHumanReview()`
   - Retry → Show TextInputModal → `humanReviewResolver({ decision: 'retry', feedback: text })` + `clearHumanReview()`
   - Reject → `humanReviewResolver({ decision: 'reject' })` + `clearHumanReview()`

### Shared Behavior:
- Keep same resolver extraction pattern from orchestrator
- Maintain same cleanup (clear resolver state)
- Preserve modal text input for feedback collection
- Keep same guard conditions before showing menu

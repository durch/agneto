# Fix Missing Event Emissions in State Machine Setters

## Context

The Ink UI subscribes to events from `TaskStateMachine` and `CoderReviewerStateMachine` for reactive updates. Several setter methods currently mutate state without emitting events, causing stale UI display until the next state transition. This violates the event-driven architecture pattern established by working setters like `setLiveActivityMessage()` and `setPlan()`.

## Acceptance Criteria

- `setCurmudgeonFeedback()` emits `curmudgeon:feedback` event after mutation
- `clearCurmudgeonFeedback()` emits `curmudgeon:feedback` event with undefined payload
- `clearLiveActivityMessage()` emits `activity:updated` event with null payload
- `setNeedsHumanReview()` emits `execution:humanreview` event with boolean flag
- `clearHumanReview()` emits `execution:humanreview` event with `needed: false`
- PlanningLayout subscribes to `curmudgeon:feedback` event
- ExecutionLayout subscribes to `execution:humanreview` event
- All UI components force re-render when relevant events fire
- No regressions in existing event-driven flows (plan approval, question answering, activity updates)

## Steps

### 1. Add event emission to `setCurmudgeonFeedback()`

**Intent:** Emit `curmudgeon:feedback` event when Curmudgeon feedback is set.

**Files:** `src/task-state-machine.ts:328-331`

**Implementation:**
```typescript
setCurmudgeonFeedback(feedback: string) {
  this.context.curmudgeonFeedback = feedback;
  this.emit('curmudgeon:feedback', { feedback });
}
```

**Verification:** Search for `setCurmudgeonFeedback` calls in orchestrator.ts, verify event payload structure matches pattern.

---

### 2. Add event emission to `clearCurmudgeonFeedback()`

**Intent:** Emit `curmudgeon:feedback` event with undefined payload when clearing.

**Files:** `src/task-state-machine.ts:336-339`

**Implementation:**
```typescript
clearCurmudgeonFeedback() {
  this.context.curmudgeonFeedback = undefined;
  this.emit('curmudgeon:feedback', { feedback: undefined });
}
```

**Verification:** Grep for `clearCurmudgeonFeedback` usage, confirm clearing pattern matches other clear methods.

---

### 3. Add event emission to `clearLiveActivityMessage()`

**Intent:** Emit `activity:updated` event with null payload when clearing activity.

**Files:** `src/task-state-machine.ts:218-221`

**Implementation:**
```typescript
clearLiveActivityMessage() {
  this.liveActivityMessage = null;
  this.emit('activity:updated', { agent: null, message: null });
}
```

**Verification:** Check `setLiveActivityMessage()` (line 215) for payload structure consistency.

---

### 4. Add event emission to `setNeedsHumanReview()`

**Intent:** Emit `execution:humanreview` event when human review flag changes.

**Files:** `src/state-machine.ts:242-246`

**Implementation:**
```typescript
setNeedsHumanReview(needed: boolean, context?: string) {
  this.needsHumanReview = needed;
  this.humanReviewContext = context;
  this.emit('execution:humanreview', { needed, context });
}
```

**Verification:** Grep for `setNeedsHumanReview` calls, verify context parameter usage.

---

### 5. Add event emission to `clearHumanReview()`

**Intent:** Emit `execution:humanreview` event with `needed: false` when clearing.

**Files:** `src/state-machine.ts:255-259`

**Implementation:**
```typescript
clearHumanReview() {
  this.needsHumanReview = false;
  this.humanReviewContext = undefined;
  this.emit('execution:humanreview', { needed: false });
}
```

**Verification:** Confirm payload matches `setNeedsHumanReview` structure.

---

### 6. Subscribe to `curmudgeon:feedback` in PlanningLayout

**Intent:** Update PlanningLayout when Curmudgeon feedback changes.

**Files:** `src/ui/ink/components/PlanningLayout.tsx:138-156` (existing useEffect block)

**Implementation:**
Add event listener inside existing useEffect:
```typescript
const handleCurmudgeonFeedback = () => forceUpdate({});
taskStateMachine.on('curmudgeon:feedback', handleCurmudgeonFeedback);

// In cleanup:
taskStateMachine.off('curmudgeon:feedback', handleCurmudgeonFeedback);
```

**Verification:** Check that `curmudgeonFeedback` is read from `taskStateMachine.getCurmudgeonFeedback()` (lines 76, 130).

---

### 7. Subscribe to `execution:humanreview` in ExecutionLayout

**Intent:** Update ExecutionLayout when human review flag changes.

**Files:** `src/ui/ink/components/ExecutionLayout.tsx:131-151` (existing useEffect block)

**Implementation:**
Add event listener inside existing useEffect:
```typescript
const handleHumanReview = () => forceUpdate({});
stateMachine.on('execution:humanreview', handleHumanReview);

// In cleanup:
stateMachine.off('execution:humanreview', handleHumanReview);
```

**Verification:** Verify `needsHumanReview` is read from `stateMachine.getNeedsHumanReview()` (lines 102, 161).

---

### 8. Test event flow end-to-end

**Intent:** Verify UI updates without manual rerenders when state changes.

**Files:** N/A (integration test)

**Implementation:**
1. Run `npm run build` to verify TypeScript compiles
2. Grep for `inkInstance.rerender()` calls - ensure none related to these state changes
3. Check orchestrator flows for `setCurmudgeonFeedback`, `clearLiveActivityMessage`, `setNeedsHumanReview` calls
4. Trace event subscriptions in PlanningLayout and ExecutionLayout useEffect hooks

**Verification:** No TypeScript errors, event flow correctly wired, UI components subscribed to all new events.

## Risks & Rollbacks

**Risks:**
- Event listener memory leaks if cleanup not properly implemented (mitigated by following existing useEffect patterns)
- Duplicate re-renders if events fire too frequently (unlikely - these are low-frequency state changes)
- Breaking checkpoint restoration if event emissions interfere with deserialization (mitigated by emitting AFTER state mutation)

**Rollback:**
Remove `this.emit()` calls from setters if UI behaves incorrectly. Remove event subscriptions from UI components. Revert to previous state.

**Confidence:** High. This follows the exact pattern established by working event emissions (`setLiveActivityMessage`, `setPlan`, `setCurrentQuestion`). The architecture already handles this pattern correctly.

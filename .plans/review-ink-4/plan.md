# Replace Inquirer Human Review with Ink UI Interactive Pattern

## Context

The ExecutionLayout displays execution state but lacks interactivity for handling "needs-human" verdicts from the Reviewer agent. Currently, `promptHumanReview` uses Inquirer prompts instead of the Ink UI. This plan replaces those prompts with Ink-based interactions following the established promise-resolver pattern from PlanningLayout (lines 134-151).

## Acceptance Criteria

- ExecutionLayout detects "needs-human" state from ExecutionStateMachine and displays interactive instructions
- Keyboard handlers [A] approve, [R] retry (with feedback modal), [X] reject work correctly
- Promise-resolver pattern matches PlanningLayout implementation (resolver extracted from orchestrator's promise)
- Orchestrator inlines promise-resolver logic when "needs-human" verdict detected
- Orchestrator re-renders Ink UI after storing state but before awaiting decision
- Dead code removed: `promptHumanReview` from human-review.ts and its import from orchestrator-helpers.ts
- Type safety maintained with HumanInteractionResult interface throughout

## Steps

### 1. Add state tracking to ExecutionStateMachine
**Intent**: Store whether human review is needed and context  
**Files**: `src/state-machine.ts`  
**Changes**: Add `needsHumanReview: boolean` and `humanReviewContext?: string` to ExecutionState interface; add `setNeedsHumanReview(needed: boolean, context?: string)` and `getNeedsHumanReview()` methods  
**Verify**: TypeScript compiles; methods are callable from orchestrator

### 2. Update ExecutionLayoutProps interface
**Intent**: Add callback for human review decisions  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx`  
**Changes**: Add `onHumanReviewDecision?: (decision: Promise<HumanInteractionResult>) => void` to ExecutionLayoutProps interface  
**Verify**: TypeScript compiles; prop is optional and correctly typed

### 3. Extract and store resolver in ExecutionLayout
**Intent**: Follow PlanningLayout pattern for resolver extraction  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx`  
**Changes**: Add `humanReviewResolver` state; add useEffect hook following PlanningLayout lines 134-151 pattern:
```typescript
const [humanReviewResolver, setHumanReviewResolver] = 
  React.useState<((value: HumanInteractionResult) => void) | null>(null);

React.useEffect(() => {
  const needsReview = executionStateMachine.getNeedsHumanReview();
  if (onHumanReviewDecision && needsReview && !humanReviewResolver) {
    const dummyPromise = new Promise<HumanInteractionResult>(() => {});
    onHumanReviewDecision(dummyPromise);
    const resolver = (dummyPromise as any).resolve;
    setHumanReviewResolver(() => resolver);
  }
}, [onHumanReviewDecision, executionStateMachine, humanReviewResolver]);
```  
**Verify**: TypeScript compiles; resolver is extracted when needsHumanReview becomes true

### 4. Add keyboard handlers for human review
**Intent**: Handle A/R/X keypresses when human review is active  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx`  
**Changes**: Add to existing useInput hook with guard condition:
```typescript
useInput((input, key) => {
  const needsReview = executionStateMachine.getNeedsHumanReview();
  
  if (needsReview && humanReviewResolver) {
    if (input === 'a' || input === 'A') {
      humanReviewResolver({ decision: 'approve' });
      setHumanReviewResolver(null);
    } else if (input === 'r' || input === 'R') {
      setShowRetryModal(true);
    } else if (input === 'x' || input === 'X') {
      humanReviewResolver({ decision: 'reject' });
      setHumanReviewResolver(null);
    }
  }
  // existing handlers...
});
```  
**Verify**: Pressing A/R/X only works when needsHumanReview is true

### 5. Display interactive instructions in Live Activity panel
**Intent**: Show available actions when human review is needed  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx`  
**Changes**: Add conditional rendering in Live Activity panel:
```typescript
{executionStateMachine.getNeedsHumanReview() && (
  <Box flexDirection="column" marginTop={1}>
    <Text bold color="yellow">⚠ Human Review Required</Text>
    <Text dimColor>{executionStateMachine.getState().humanReviewContext || 'Reviewer needs your decision'}</Text>
    <Box marginTop={1}>
      <Text>[A] Approve  [R] Retry with feedback  [X] Reject</Text>
    </Box>
  </Box>
)}
```  
**Verify**: Instructions appear when needsHumanReview is true; disappear when false

### 6. Handle retry feedback with TextInputModal
**Intent**: Collect feedback text when user chooses retry  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx`  
**Changes**: Add showRetryModal state and TextInputModal component:
```typescript
const [showRetryModal, setShowRetryModal] = React.useState(false);

{showRetryModal && (
  <TextInputModal
    title="Retry Feedback"
    prompt="Provide feedback for retry:"
    onSubmit={(feedback) => {
      humanReviewResolver?.({ decision: 'retry', feedback });
      setShowRetryModal(false);
      setHumanReviewResolver(null);
    }}
    onCancel={() => setShowRetryModal(false)}
  />
)}
```  
**Verify**: Modal appears on R press; submitting calls resolver with feedback; canceling closes modal

### 7. Inline promise-resolver logic in orchestrator for plan review
**Intent**: Create promise and resolver when plan review needs human input  
**Files**: `src/orchestrator.ts`  
**Changes**: In PLAN_REVIEW state handler when `verdict.verdict === "needs_human"`, inline promise-resolver pattern before awaiting:
```typescript
let resolverFunc: ((value: HumanInteractionResult) => void) | null = null;
const decisionPromise = new Promise<HumanInteractionResult>((resolve) => {
  resolverFunc = resolve;
});
(decisionPromise as any).resolve = resolverFunc;

const callback = (decision: Promise<HumanInteractionResult>) => {
  (decision as any).resolve = resolverFunc;
};

executionStateMachine.setNeedsHumanReview(true, verdict.feedback);
inkInstance.rerender(<App 
  taskStateMachine={taskStateMachine} 
  executionStateMachine={executionStateMachine} 
  onHumanReviewDecision={callback} 
/>);

const decision = await decisionPromise;
executionStateMachine.setNeedsHumanReview(false);
// Handle decision.decision (approve/retry/reject)...
```  
**Verify**: UI shows human review prompt; keyboard input resolves promise; orchestrator continues with decision

### 8. Inline promise-resolver logic in orchestrator for code review
**Intent**: Create promise and resolver when code review needs human input  
**Files**: `src/orchestrator.ts`  
**Changes**: In CODE_REVIEW state handler when `verdict.verdict === "needs_human"`, inline same promise-resolver pattern as step 7  
**Verify**: UI shows human review prompt during code review; keyboard input resolves promise; orchestrator continues with decision

### 9. Remove dead code
**Intent**: Clean up unused Inquirer-based human review code  
**Files**: `src/ui/human-review.ts`, `src/orchestrator-helpers.ts`, `src/orchestrator.ts`  
**Changes**: 
- Delete `promptHumanReview` function from human-review.ts (lines ~32-67)
- Remove `promptHumanReview` import from orchestrator-helpers.ts
- Remove `promptForSuperReviewerDecision` import from orchestrator.ts line 28
- Delete `promptForSuperReviewerDecision` function from human-review.ts (lines 69-131)  
**Verify**: Build succeeds; no references to deleted functions remain

## Risks & Rollbacks

**Risk**: Promise-resolver wiring fails between orchestrator and UI  
**Mitigation**: Follow PlanningLayout pattern exactly (lines 134-151); add debug logging to confirm resolver extraction  
**Rollback**: Revert ExecutionLayout changes; keep orchestrator using `promptHumanReview`

**Risk**: Keyboard handlers interfere with existing ExecutionLayout inputs  
**Mitigation**: Guard all new handlers with `needsHumanReview && humanReviewResolver` conditions  
**Rollback**: Remove keyboard handler additions; state machine changes are backwards compatible

**Risk**: Re-render timing causes UI to miss state updates  
**Mitigation**: Explicitly call `inkInstance.rerender()` immediately after `setNeedsHumanReview(true)` before awaiting promise  
**Rollback**: Revert orchestrator changes; ExecutionLayout changes are backwards compatible with missing callback prop

# Add SuperReviewer Phase Visualization to PlanningLayout

## Context
The PlanningLayout component needs to support the SuperReviewer phase using the same promise-based approval pattern as refinement. SuperReviewer is a final quality gate that reviews completed implementations. The component must display the original plan (left pane), SuperReviewer results (right pane), and capture user decisions (approve/retry/abandon) through keyboard handlers.

## Acceptance Criteria
- PlanningLayoutProps interface extended with `onSuperReviewerDecision` callback
- useEffect wires SuperReviewer resolver following exact pattern from refinement (lines 76-92)
- Keyboard handlers [A], [R], [X] properly resolve promise with appropriate decisions
- TASK_SUPER_REVIEWING state displays plan (left) and SuperReviewer results (right)
- Live Activity panel shows interactive instructions during SuperReviewer phase
- Promise resolution unblocks orchestrator correctly
- No regression in existing refinement or planning functionality

## Steps

### 1. Add TypeScript type definitions for SuperReviewer decisions
**Intent:** Define the shape of SuperReviewer decisions that will be passed through promises

**Files to modify:** 
- `src/ui/ink/components/PlanningLayout.tsx` (add type above component, around line 15-30)

**What to add:**
```typescript
export type SuperReviewerDecision = 
  | { action: 'approve' }
  | { action: 'retry'; feedback: string }
  | { action: 'abandon' };
```

**Verification:** TypeScript compiles without errors, type is available for use in component

**Confidence:** High - straightforward type definition matching existing patterns

---

### 2. Extend PlanningLayoutProps interface
**Intent:** Add callback prop for SuperReviewer decision handling, matching refinement pattern

**Files to modify:**
- `src/ui/ink/components/PlanningLayout.tsx` (PlanningLayoutProps interface, around line 32-37)

**What to change:**
Add new optional callback property:
```typescript
onSuperReviewerDecision?: (promise: Promise<SuperReviewerDecision>) => void;
```

**Verification:** TypeScript compiles, prop is available in component destructuring

**Confidence:** High - direct parallel to existing `onFeedback` prop

---

### 3. Add SuperReviewer resolver state management
**Intent:** Store resolver function for SuperReviewer approval promise, following refinement pattern

**Files to modify:**
- `src/ui/ink/components/PlanningLayout.tsx` (state declarations, around line 45-50)

**What to add:**
```typescript
const [superReviewerResolver, setSuperReviewerResolver] = React.useState<
  ((value: SuperReviewerDecision) => void) | null
>(null);
```

**Verification:** State hook compiles, variable is available in component scope

**Confidence:** High - identical pattern to refinement resolver state

---

### 4. Wire SuperReviewer resolver in useEffect
**Intent:** Extract and store resolver from orchestrator's promise when SuperReviewer phase starts

**Files to modify:**
- `src/ui/ink/components/PlanningLayout.tsx` (add new useEffect after line 92)

**What to add:**
```typescript
React.useEffect(() => {
  if (
    onSuperReviewerDecision &&
    currentState === TaskState.TASK_SUPER_REVIEWING &&
    taskStateMachine.getSuperReviewResult()
  ) {
    const dummyPromise = new Promise<SuperReviewerDecision>(() => {});
    onSuperReviewerDecision(dummyPromise);
    const resolver = (dummyPromise as any).resolve;
    if (resolver) {
      setSuperReviewerResolver(() => resolver);
    }
  }
}, [onSuperReviewerDecision, currentState, taskStateMachine]);
```

**Verification:** 
- TypeScript compiles without errors
- Console.log in effect confirms it fires when entering TASK_SUPER_REVIEWING state
- Resolver function is stored in state

**Confidence:** High - exact copy of refinement pattern (lines 76-92) with appropriate variable substitutions

---

### 5. Implement keyboard handlers for SuperReviewer decisions
**Intent:** Capture [A]pprove, [R]etry, [X]abandon keys and resolve promise

**Files to modify:**
- `src/ui/ink/components/PlanningLayout.tsx` (useInput hook, around line 95-120)

**What to change:**
Add new conditional block inside existing useInput hook:
```typescript
// SuperReviewer decision handling
if (
  currentState === TaskState.TASK_SUPER_REVIEWING &&
  superReviewerResolver &&
  !isTextInputModalOpen
) {
  if (input === 'a' || input === 'A') {
    superReviewerResolver({ action: 'approve' });
    setSuperReviewerResolver(null);
    return;
  }
  if (input === 'x' || input === 'X') {
    superReviewerResolver({ action: 'abandon' });
    setSuperReviewerResolver(null);
    return;
  }
  if (input === 'r' || input === 'R') {
    // TODO: Open TextInputModal for retry feedback
    // For now, placeholder: resolve with empty feedback
    superReviewerResolver({ action: 'retry', feedback: '' });
    setSuperReviewerResolver(null);
    return;
  }
}
```

**Verification:**
- Run task and reach SuperReviewer phase
- Press 'A' - promise resolves with approve decision
- Press 'X' - promise resolves with abandon decision  
- Press 'R' - promise resolves with retry decision (empty feedback for now)
- orchestrator logs show promise is resolved

**Confidence:** Medium-High - straightforward key handling, but retry modal integration is placeholder only

---

### 6. Add SuperReviewer phase rendering in main switch statement
**Intent:** Display plan (left) and SuperReviewer results (right) during TASK_SUPER_REVIEWING state

**Files to modify:**
- `src/ui/ink/components/PlanningLayout.tsx` (main render logic, add case around line 250)

**What to add:**
Add new case before default case in state switch:
```typescript
case TaskState.TASK_SUPER_REVIEWING: {
  const superReviewResult = taskStateMachine.getSuperReviewResult();
  const planMd = taskStateMachine.getPlanMd();
  
  if (!superReviewResult) {
    return (
      <Box flexDirection="column" width="100%">
        <Box borderStyle="round" borderColor="blue" padding={1}>
          <Text color="blue">⏳ SuperReviewer performing final quality check...</Text>
        </Box>
      </Box>
    );
  }
  
  leftPane = (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="round" borderColor="green" paddingX={1} marginBottom={1}>
        <Text bold color="green">📋 Original Plan</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        <Text>{planMd || 'No plan available'}</Text>
      </Box>
    </Box>
  );
  
  rightPane = (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="round" borderColor="magenta" paddingX={1} marginBottom={1}>
        <Text bold color="magenta">🔍 SuperReviewer Results</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        <Text bold>Verdict: <Text color={superReviewResult.verdict === 'PASS' ? 'green' : 'yellow'}>{superReviewResult.verdict}</Text></Text>
        <Text>{'\n'}</Text>
        <Text bold>Summary:</Text>
        <Text>{superReviewResult.summary}</Text>
        <Text>{'\n'}</Text>
        {superReviewResult.issues && superReviewResult.issues.length > 0 && (
          <>
            <Text bold color="yellow">Issues Found:</Text>
            {superReviewResult.issues.map((issue, idx) => (
              <Text key={idx}>• {issue}</Text>
            ))}
          </>
        )}
      </Box>
    </Box>
  );
  
  liveActivity = (
    <Box borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text color="cyan">
        [A] Approve & Complete  [R] Retry with Feedback  [X] Abandon Task
      </Text>
    </Box>
  );
  break;
}
```

**Verification:**
- Task reaches TASK_SUPER_REVIEWING state
- Left pane shows original plan markdown
- Right pane shows SuperReviewer verdict, summary, and issues
- Live Activity shows keyboard shortcuts
- Layout maintains three-pane structure

**Confidence:** High - straightforward rendering logic using existing TaskStateMachine methods

---

### 7. Verify promise-based approval flow end-to-end
**Intent:** Ensure orchestrator can await SuperReviewer decision and flow continues correctly

**Files to verify:**
- `src/orchestrator.ts` (should already have SuperReviewer await logic)
- `src/ui/ink/components/PlanningLayout.tsx` (all changes from previous steps)

**What to test:**
1. Run task with `npm start -- "simple test task"`
2. Let task complete through to SuperReviewer phase
3. Verify UI shows plan + SuperReviewer results
4. Press [A] to approve
5. Confirm orchestrator logs show promise resolution
6. Verify task completes successfully

**Verification:**
- Orchestrator doesn't hang waiting for promise
- User decision properly propagates to orchestrator
- No console errors or TypeScript warnings
- Resolver cleanup happens (state set to null)

**Confidence:** Medium - depends on orchestrator integration being correct, but pattern is proven from refinement

## Risks & Rollbacks

**Risk 1:** TypeScript type mismatches between component and orchestrator
- **Mitigation:** Use exact same pattern as refinement approval
- **Rollback:** Revert PlanningLayout.tsx to previous commit

**Risk 2:** Promise resolver not properly wired, causing orchestrator to hang
- **Mitigation:** Follow proven refinement pattern exactly (lines 76-92)
- **Rollback:** Remove SuperReviewer case and revert to previous working state

**Risk 3:** Keyboard handlers conflict with existing input handling
- **Mitigation:** Add state checks to prevent conflicts (TASK_SUPER_REVIEWING && !isTextInputModalOpen)
- **Rollback:** Remove keyboard handler block

**Risk 4:** Retry feedback modal integration incomplete (known limitation)
- **Mitigation:** Placeholder implementation resolves with empty feedback
- **Future:** Add TextInputModal integration in follow-up task
- **Rollback:** N/A - placeholder is acceptable for initial implementation

## Uncertainties

- **TextInputModal integration:** Step 5 includes placeholder for retry feedback modal. Full modal integration requires understanding TextInputModal component API and state management, which may need a follow-up task.
- **SuperReviewResult type shape:** Assuming `getSuperReviewResult()` returns object with `{ verdict, summary, issues }` based on common patterns, but should verify actual type definition in TaskStateMachine.

**Overall Confidence:** High for core promise-based approval pattern (exact copy of proven refinement approach). Medium for UI rendering details and retry modal integration (placeholders acceptable for initial implementation).

---
_Plan created after 1 iteration(s) with human feedback_

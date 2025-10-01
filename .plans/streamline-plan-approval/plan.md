# Streamline Plan Approval Flow: Automatic Planner-Curmudgeon Cycles

## Context

Currently, users approve plans in TASK_PLANNING state (orchestrator.ts:441-478), then Curmudgeon reviews automatically. This creates approval fatigue. The requirement is simple: move user approval to after Curmudgeon sign-off, eliminating intermediate approvals.

The Curmudgeon feedback is correct: the existing code already has the automatic loop (CURMUDGEON_SIMPLIFY → TASK_PLANNING → TASK_CURMUDGEONING). We just need to move the approval point.

## Acceptance Criteria

- [ ] User approval removed from TASK_PLANNING state
- [ ] User approval added to TASK_CURMUDGEONING state (after Curmudgeon approves)
- [ ] Planner ↔ Curmudgeon loop continues automatically until approval
- [ ] User sees all iterations in real-time via existing pane UI
- [ ] User approves plan exactly once (after Curmudgeon sign-off)
- [ ] Non-interactive mode bypasses approval (as before)
- [ ] User can still reject plan and trigger replanning
- [ ] System transitions to execution after final user approval

## Steps

### 1. Remove approval from TASK_PLANNING state
**Intent**: Eliminate intermediate user approval, allow automatic transition to Curmudgeon review

**Files**: `src/orchestrator.ts`

**Action**: Delete lines 441-478 (entire approval block in TASK_PLANNING case). Plan generation should automatically transition to TASK_CURMUDGEONING.

**Verification**:
```bash
# Verify approval block removed
grep -A 30 "case TaskState.TASK_PLANNING:" src/orchestrator.ts | grep -q "onPlanFeedback" && echo "FAIL: Approval still present" || echo "PASS"

# Verify transition to CURMUDGEONING exists
grep -A 30 "case TaskState.TASK_PLANNING:" src/orchestrator.ts | grep -q "CURMUDGEON" && echo "PASS" || echo "FAIL: Missing transition"
```

### 2. Add approval to TASK_CURMUDGEONING after approval
**Intent**: Present plan to user only after Curmudgeon approves

**Files**: `src/orchestrator.ts`

**Action**: In TASK_CURMUDGEONING case, after line 559 (where `hasApproval && !hasConcerns` is true), insert approval logic:

```typescript
if (hasApproval && !hasConcerns) {
    log.orchestrator(`✅ Curmudgeon approved plan`);
    
    // Interactive mode: show plan to user for final approval
    if (inkInstance && !options?.nonInteractive) {
        let resolverFunc: ((value: PlanFeedback) => void) | null = null;
        const feedbackPromise = new Promise<PlanFeedback>((resolve) => {
            resolverFunc = resolve;
        });
        (feedbackPromise as any).resolve = resolverFunc;
        
        const planCallback = (feedback: PlanFeedback) => {
            resolverFunc?.(feedback);
        };
        
        inkInstance.rerender(React.createElement(App, {
            taskStateMachine,
            onPlanFeedback: planCallback,
            onRefinementFeedback: undefined
        }));
        
        const feedback = await feedbackPromise;
        
        if (feedback.type === "approve") {
            taskStateMachine.transition(TaskEvent.CURMUDGEON_APPROVED);
        } else {
            // User rejected - treat as Curmudgeon simplify request
            taskStateMachine.setCurmudgeonFeedback(feedback.details || "User requested plan revision");
            taskStateMachine.transition(TaskEvent.CURMUDGEON_SIMPLIFY);
        }
    } else {
        // Non-interactive: proceed automatically
        taskStateMachine.transition(TaskEvent.CURMUDGEON_APPROVED);
    }
}
```

**Verification**:
```bash
# Verify approval added after Curmudgeon approval
grep -A 50 "hasApproval && !hasConcerns" src/orchestrator.ts | grep -q "onPlanFeedback" && echo "PASS" || echo "FAIL"

# Verify both interactive and non-interactive paths exist
grep -A 50 "hasApproval && !hasConcerns" src/orchestrator.ts | grep -q "nonInteractive" && echo "PASS" || echo "FAIL"
```

### 3. Test interactive flow with simple task
**Intent**: Verify Planner → Curmudgeon loop works automatically, approval shown only once

**Files**: None (testing)

**Action**:
```bash
npm start -- "add a comment to README"
```

**Expected behavior**:
1. Planner generates plan (no approval prompt)
2. Curmudgeon reviews plan (visible in UI)
3. If Curmudgeon requests changes: Planner replans automatically (no approval)
4. Loop continues until Curmudgeon approves
5. User sees approval prompt ONLY ONCE (after Curmudgeon approves)
6. User presses 'A' to approve
7. System transitions to execution phase

**Verification**: Watch for single approval prompt after Curmudgeon sign-off. Count approval prompts (should be exactly 1).

### 4. Test non-interactive flow
**Intent**: Verify non-interactive mode skips approval entirely

**Files**: None (testing)

**Action**:
```bash
npm start -- "add a comment to README" --non-interactive
```

**Expected behavior**:
1. Planner generates plan (no approval)
2. Curmudgeon reviews and approves (no approval)
3. System proceeds directly to execution

**Verification**: No approval prompts shown, task completes automatically.

### 5. Test user rejection flow
**Intent**: Verify user can reject plan and trigger replanning

**Files**: None (testing)

**Action**:
```bash
npm start -- "add a comment to README"
# When approval prompt appears, press 'S' (simplify) or 'E' (edit)
```

**Expected behavior**:
1. Planner → Curmudgeon loop completes automatically
2. User sees approval prompt
3. User rejects with feedback
4. System transitions back to TASK_PLANNING with feedback
5. New Planner → Curmudgeon loop begins

**Verification**: User rejection triggers new planning cycle. System does not proceed to execution.

## Risks & Rollbacks

**Risk 1**: React.createElement import missing in orchestrator.ts
- **Mitigation**: Add `import React from 'react'` at top of file if needed
- **Rollback**: Add import, recompile

**Risk 2**: PlanFeedback type not imported in orchestrator.ts
- **Mitigation**: Verify import exists: `import { PlanFeedback } from './ui/planning-interface'`
- **Rollback**: Add missing import

**Risk 3**: Approval UI doesn't render correctly in TASK_CURMUDGEONING context
- **Mitigation**: Test rendering with simple task first
- **Rollback**: Revert approval insertion, restore original TASK_PLANNING approval

**Rollback strategy**: Revert orchestrator.ts changes (git checkout), rebuild:
```bash
git checkout src/orchestrator.ts
npm run build
```

## Confidence Level

**High confidence**. This is the minimal change approach recommended by Curmudgeon feedback:
- Remove approval from one location (TASK_PLANNING)
- Add approval to one location (TASK_CURMUDGEONING)
- No new state management, no flags, no conditional complexity
- Reuses existing approval pattern exactly as written
- Preserves all existing functionality (interactive/non-interactive, rejection handling)

The change is surgical: ~30 lines deleted, ~30 lines added, zero new abstractions.

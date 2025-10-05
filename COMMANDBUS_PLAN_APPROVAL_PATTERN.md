# CommandBus Plan Approval Pattern - Investigation Results

This document provides a complete reference of the CommandBus pattern used for plan approval, extracted from the actual codebase. This pattern should be replicated for migrating SuperReviewer approval to CommandBus.

---

## 1. Type Definitions

### PlanFeedback Type (src/ui/planning-interface.ts:16-19)

```typescript
export type PlanFeedbackType =
    | "approve"
    | "simplify"
    | "add-detail"
    | "wrong-approach"
    | "edit-steps"
    | "reject";

export interface PlanFeedback {
    type: PlanFeedbackType;
    details?: string;
}
```

**Key characteristics:**
- Simple interface with `type` discriminator and optional `details`
- Multiple feedback types for different approval scenarios
- Used consistently across UI and orchestrator

---

## 2. CommandBus Command Definitions (src/ui/command-bus.ts:9-22)

```typescript
export type Command =
  | { type: 'plan:approve' }
  | { type: 'plan:reject'; details: string }
  | { type: 'refinement:approve' }
  | { type: 'refinement:reject'; details: string }
  | { type: 'question:answer'; answer: string }
  | { type: 'superreview:approve' }
  | { type: 'superreview:retry'; feedback: string }
  | { type: 'superreview:abandon' }
  // ... other commands
```

**Pattern:**
- Commands are discriminated unions with `type` field
- Simple approvals have no payload: `{ type: 'plan:approve' }`
- Rejections include feedback: `{ type: 'plan:reject'; details: string }`

---

## 3. CommandBus Translation Logic (src/ui/command-bus.ts:72-130)

The CommandBus `waitForCommand<T>()` method translates raw commands into typed feedback objects:

```typescript
async waitForCommand<T = void>(type: Command['type']): Promise<T> {
  return new Promise((resolve) => {
    const handler = (command: Command, commandResolve: (value: any) => void) => {
      if (command.type === type) {
        this.off('command', handler);

        // Extract the relevant data based on command type
        let result: any;
        switch (command.type) {
          case 'plan:approve':
            result = { type: 'approve' } as PlanFeedback;
            break;
          case 'plan:reject':
            result = { type: 'wrong-approach', details: command.details } as PlanFeedback;
            break;
          // ... other cases
        }

        commandResolve(result);
        this.commandComplete();
        resolve(result);
      }
    };

    this.on('command', handler);
  });
}
```

**Key mechanism:**
- Listens for specific command type
- Translates raw `Command` to typed feedback object (e.g., `PlanFeedback`)
- Resolves both the command promise and orchestrator promise
- Cleans up event listener after handling

---

## 4. Orchestrator Pattern (src/orchestrator.ts:530-546)

```typescript
// Interactive mode: show plan to user for approval
if (inkInstance && !options?.nonInteractive) {
    // Wait for plan feedback via CommandBus
    const feedback = await commandBus.waitForCommand<PlanFeedback>('plan:approve');

    if (feedback.type === "approve") {
        log.orchestrator("Plan approved by user.");
        taskStateMachine.transition(TaskEvent.CURMUDGEON_APPROVED);
    } else {
        // User rejected again - go back to planning with feedback
        const rejectionFeedback = feedback.details || "User requested plan revision";
        taskStateMachine.setCurmudgeonFeedback(rejectionFeedback);
        taskStateMachine.transition(TaskEvent.CURMUDGEON_SIMPLIFY);
    }
} else {
    // Non-interactive: proceed automatically
    taskStateMachine.transition(TaskEvent.CURMUDGEON_APPROVED);
}
```

**Pattern steps:**
1. **Check interactive mode** - Only wait for user input if in interactive mode
2. **Wait for command** - `await commandBus.waitForCommand<PlanFeedback>('plan:approve')`
   - Note: Waits for EITHER `plan:approve` OR `plan:reject` (CommandBus handles both)
3. **Process feedback** - Check `feedback.type` to determine action
4. **Transition state** - Update TaskStateMachine based on decision
5. **Fallback** - Non-interactive mode skips waiting and proceeds automatically

**Important:** The orchestrator waits for a single command type (`'plan:approve'`), but the CommandBus `waitForCommand()` method internally handles BOTH approve and reject commands because both are valid responses to a plan approval prompt.

---

## 5. UI Pattern (src/ui/ink/components/PlanningLayout.tsx:147-178, 728-740)

### Handler Functions (lines 147-178)

```typescript
// Handle approve action
const handleApprove = async () => {
  setIsProcessingFeedback(true);
  setLastAction('Approved');

  try {
    await commandBus.sendCommand({ type: 'plan:approve' });
  } catch (error) {
    setLastAction('Error processing approval');
    setIsProcessingFeedback(false); // Only reset on error
  }
};

// Handle reject action - opens modal to collect feedback
const handleReject = () => {
  openTextInputModal(
    'plan',
    'Reject Plan',
    'Explain what\'s wrong with this approach...',
    async (feedbackText: string) => {
      setIsProcessingFeedback(true);
      setLastAction('Rejected - sending feedback');

      try {
        await commandBus.sendCommand({ type: 'plan:reject', details: feedbackText });
        setLastAction('Rejection feedback sent');
      } catch (error) {
        setLastAction('Error processing rejection');
        setIsProcessingFeedback(false); // Only reset on error
      }
    }
  );
};
```

### Menu Integration (lines 728-740)

```typescript
<SelectInput
  items={[
    { label: 'Approve and Start Coding', value: 'approve' },
    { label: 'Reject and Provide Feedback', value: 'reject' }
  ]}
  onSelect={(item) => {
    if (item.value === 'approve') {
      handleApprove();
    } else if (item.value === 'reject') {
      handleReject();
    }
  }}
/>
```

**Pattern steps:**
1. **Menu items** - Define approve/reject options for `ink-select-input`
2. **Handler routing** - `onSelect` routes to appropriate handler based on `item.value`
3. **Approve handler** - Directly sends `{ type: 'plan:approve' }` command
4. **Reject handler** - Opens modal to collect feedback, then sends `{ type: 'plan:reject', details: feedbackText }`
5. **Processing state** - Set `isProcessingFeedback` to show feedback UI
6. **Error handling** - Only reset processing state on error (success keeps it set)

---

## 6. Reference Template for SuperReviewer Migration

### Step 1: Update CommandBus Types (if not already present)

```typescript
// In src/ui/command-bus.ts
export type Command =
  | { type: 'superreview:approve' }
  | { type: 'superreview:retry'; feedback: string }
  | { type: 'superreview:abandon' }
  // ... existing commands
```

**Note:** These commands are already defined in the current CommandBus!

### Step 2: Update CommandBus Translation Logic

```typescript
// In src/ui/command-bus.ts - waitForCommand() switch statement
case 'superreview:approve':
  result = { action: 'approve' } as SuperReviewerDecision;
  break;
case 'superreview:retry':
  result = { action: 'retry', feedback: command.feedback } as SuperReviewerDecision;
  break;
case 'superreview:abandon':
  result = { action: 'abandon' } as SuperReviewerDecision;
  break;
```

**Note:** This translation is already implemented in the current CommandBus (lines 96-103)!

### Step 3: Update Orchestrator to Use CommandBus

**Current pattern (callback-based):**
```typescript
const decision = await new Promise<SuperReviewerDecision>((resolve) => {
  inkInstance.rerender(<App
    taskStateMachine={taskStateMachine}
    onSuperReviewDecision={resolve}  // ← Callback resolver
  />);
});
```

**New pattern (CommandBus-based):**
```typescript
// Wait for SuperReviewer decision via CommandBus
const decision = await commandBus.waitForCommand<SuperReviewerDecision>('superreview:approve');

if (decision.action === 'approve') {
  log.orchestrator("SuperReviewer approved - proceeding to Gardener");
  taskStateMachine.transition(TaskEvent.SUPER_REVIEW_APPROVED);
} else if (decision.action === 'retry') {
  log.orchestrator(`SuperReviewer requested retry: ${decision.feedback}`);
  // Handle retry logic
} else if (decision.action === 'abandon') {
  log.orchestrator("SuperReviewer abandoned task");
  taskStateMachine.transition(TaskEvent.HUMAN_ABANDON);
}
```

**Key change:** Replace `onSuperReviewDecision` callback prop with `commandBus.waitForCommand()`.

### Step 4: Update PlanningLayout UI Handlers

**Add handler functions:**
```typescript
const handleSuperReviewApprove = async () => {
  setIsProcessingFeedback(true);
  setLastAction('Approved');

  try {
    await commandBus.sendCommand({ type: 'superreview:approve' });
  } catch (error) {
    setLastAction('Error processing approval');
    setIsProcessingFeedback(false);
  }
};

const handleSuperReviewRetry = () => {
  openTextInputModal(
    'superreview',
    'Request Changes',
    'Explain what needs to be fixed...',
    async (feedbackText: string) => {
      setIsProcessingFeedback(true);
      setLastAction('Retry requested');

      try {
        await commandBus.sendCommand({ type: 'superreview:retry', feedback: feedbackText });
        setLastAction('Retry feedback sent');
      } catch (error) {
        setLastAction('Error processing retry');
        setIsProcessingFeedback(false);
      }
    }
  );
};

const handleSuperReviewAbandon = async () => {
  setIsProcessingFeedback(true);
  setLastAction('Abandoned');

  try {
    await commandBus.sendCommand({ type: 'superreview:abandon' });
  } catch (error) {
    setLastAction('Error processing abandon');
    setIsProcessingFeedback(false);
  }
};
```

**Update menu:**
```typescript
<SelectInput
  items={[
    { label: 'Approve and Complete Task', value: 'approve' },
    { label: 'Retry and Fix Issues', value: 'retry' },
    { label: 'Abandon Task', value: 'abandon' }
  ]}
  onSelect={(item) => {
    if (item.value === 'approve') {
      handleSuperReviewApprove();
    } else if (item.value === 'retry') {
      handleSuperReviewRetry();
    } else if (item.value === 'abandon') {
      handleSuperReviewAbandon();
    }
  }}
/>
```

**Note:** The menu items and structure already exist in PlanningLayout.tsx (lines 756-761), but the handlers need to be wired to CommandBus instead of callbacks.

### Step 5: Remove Callback Props

**Remove from orchestrator:**
```typescript
// DELETE: onSuperReviewDecision prop
// DELETE: Manual rerender after setting SuperReviewer result
```

**Remove from PlanningLayout interface:**
```typescript
// DELETE: onSuperReviewDecision?: (decision: SuperReviewerDecision) => void;
```

**Remove from App.tsx:**
```typescript
// DELETE: onSuperReviewDecision prop passing
```

---

## 7. Key Architectural Insights

### Why This Pattern Works

1. **Decoupling**: UI doesn't know about orchestrator logic, only sends commands
2. **Type Safety**: CommandBus translates raw commands to typed feedback objects
3. **Consistency**: Same pattern for all approval flows (plan, refinement, superreview)
4. **Extensibility**: Adding new command types requires only updating Command union and switch statement
5. **Event-Driven**: Eliminates promise resolver callback hell

### Common Pitfalls to Avoid

1. **Don't pass callbacks AND use CommandBus** - Choose one pattern (CommandBus is preferred)
2. **Don't forget to update CommandBus translation** - Both `waitForCommand()` and `waitForAnyCommand()` switch statements
3. **Don't manually rerender** - Event-driven architecture handles this automatically
4. **Don't forget error handling** - UI handlers should catch errors and reset processing state

### Migration Checklist

- [ ] Verify CommandBus command types exist (already done for SuperReviewer)
- [ ] Verify CommandBus translation logic exists (already done for SuperReviewer)
- [ ] Replace orchestrator callback pattern with `commandBus.waitForCommand()`
- [ ] Update UI handlers to use `commandBus.sendCommand()`
- [ ] Wire menu `onSelect` to new handlers
- [ ] Remove callback props from component interfaces
- [ ] Remove callback prop passing from parent components
- [ ] Test approve flow
- [ ] Test retry flow with feedback modal
- [ ] Test abandon flow
- [ ] Verify state transitions work correctly

---

## 8. Actual Code Locations Reference

**Type Definitions:**
- `PlanFeedback`: `src/ui/planning-interface.ts:16-19`
- `SuperReviewerDecision`: `src/types.ts` (imported in CommandBus)
- `Command` union: `src/ui/command-bus.ts:9-22`

**CommandBus Implementation:**
- Main class: `src/ui/command-bus.ts:30-203`
- Translation logic: `src/ui/command-bus.ts:72-130` (waitForCommand)
- SuperReviewer translations: `src/ui/command-bus.ts:96-103` (already implemented)

**Orchestrator Usage:**
- Plan approval: `src/orchestrator.ts:532` (and lines 557, etc.)
- Pattern: `await commandBus.waitForCommand<PlanFeedback>('plan:approve')`

**UI Implementation:**
- Handlers: `src/ui/ink/components/PlanningLayout.tsx:147-178`
- Menu: `src/ui/ink/components/PlanningLayout.tsx:728-740`
- SuperReviewer menu (existing): `src/ui/ink/components/PlanningLayout.tsx:756-761`

---

## Summary

The CommandBus pattern for plan approval is **fully implemented and working**. The SuperReviewer commands are **already defined in CommandBus** with proper translation logic. The migration requires:

1. **Orchestrator**: Replace callback-based waiting with `commandBus.waitForCommand<SuperReviewerDecision>('superreview:approve')`
2. **UI Handlers**: Wire existing menu items to CommandBus send commands (approve/retry/abandon)
3. **Cleanup**: Remove callback props from component interfaces

This is a **straightforward refactor** following the proven plan approval pattern.

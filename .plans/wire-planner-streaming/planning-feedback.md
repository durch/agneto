# Planning Feedback History

Curmudgeon simplification request: Looking at this plan, I see unnecessary complexity and over-engineering for what should be a straightforward wiring task.

## Problems

**1. You're modifying too many layers**
The plan touches 4 different files (planner agent, provider, orchestrator, state machine) when the requirement is simpler. You're threading callbacks through the entire stack when a more direct approach exists.

**2. The provider already has streaming capabilities**
The Claude CLI provider (`anthropic.ts`) already handles stdout streaming. You don't need to add callback parameters throughout the entire chain - you just need to tap into the existing stream at the right place.

**3. Overcomplicating the callback mechanism**
You're creating a multi-layer callback system (orchestrator → planner → provider) when you could directly observe the provider's output stream from the orchestrator level. The planner doesn't need to know about UI updates.

## Simpler Approach

**What you actually need:**

1. **In orchestrator**: Before calling planner, set up a callback that watches the provider's output
2. **Use existing provider stream**: The provider already emits stdout - just subscribe to it
3. **Update UI directly**: Call `taskStateMachine.setLiveActivityMessage()` and `inkInstance.rerender()` from the orchestrator when data arrives
4. **Clean up after**: Clear live activity when done

This is really a 2-file change (orchestrator + maybe provider helper if needed), not a 4-file callback threading exercise.

**Concrete suggestion:**

```typescript
// In orchestrator TASK_PLANNING case:
const streamCallback = (chunk: string) => {
  taskStateMachine.setLiveActivityMessage('Planner', chunk);
  inkInstance?.rerender(<App taskStateMachine={taskStateMachine} />);
};

// Pass callback directly to planner's provider call
const { planMd, planPath } = await planner.createPlan(
  taskStateMachine.getTaskDescription(),
  { onStream: streamCallback }  // Add options object to planner
);

taskStateMachine.clearLiveActivity('Planner');
```

The planner just needs to accept an optional `onStream` in its options and pass it to the provider. No need to modify signatures across multiple layers or create complex callback chains.

**The test step is good** - that's necessary validation.

## Verdict

The plan is over-engineered for a simple streaming callback integration. Simplify to a direct orchestrator-to-provider streaming subscription rather than threading callbacks through multiple abstraction layers.

**simplify**

Human feedback: Testing this is hard, drop it, human will test after the implementation is done
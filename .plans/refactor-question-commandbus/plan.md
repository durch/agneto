# Refactor Question Answering to CommandBus Pattern

## Context
The question answering flow currently uses legacy promise resolver callbacks (`refinementInteractionCallback`, `answerResolver`) while other refinement flows have migrated to the CommandBus event-driven pattern. The `question:answer` command type already exists in CommandBus infrastructure and is fully functional. This refactor aligns question answering with the established pattern used by refinement approval and plan approval.

## Acceptance Criteria
- Orchestrator receives answers via `commandBus.waitForCommand<string>('question:answer')` instead of callback function
- UI sends answers via `commandBus.sendCommand({ type: 'question:answer', answer })` without invoking callbacks
- All callback-related code removed: `refinementInteractionCallback`, `onRefinementInteraction` prop, `refinementInteractionHandler` state, `answerResolver` state
- Question/answer loop continues working (up to 3 questions)
- Modal visibility state management preserved via `taskStateMachine.setAnsweringQuestion()`
- TypeScript compiles successfully
- Existing refinement approval flow unaffected

## Steps

### 1. Update orchestrator to use CommandBus for receiving answers
**Intent**: Replace callback-based answer handling with CommandBus pattern  
**Files**: `src/orchestrator.ts` (lines 341-375, 380-398)  
**Changes**:
- Remove `refinementInteractionCallback` function definition (lines 341-375)
- In the question/answer loop (around line 391), replace callback invocation with:
  ```typescript
  const answer = await commandBus.waitForCommand<string>('question:answer');
  ```
- Preserve the existing loop logic that processes refiner responses and manages question iteration  

**Verify**: Search for `refinementInteractionCallback` in orchestrator.ts - should have zero matches

### 2. Remove onRefinementInteraction prop from App component interface
**Intent**: Eliminate unused callback prop from component hierarchy  
**Files**: `src/ui/ink/App.tsx` (line 20, line 78)  
**Changes**:
- Remove `onRefinementInteraction?: (question: string, answer: string) => Promise<void>;` from interface definition (line 20)
- Remove `onRefinementInteraction={onRefinementInteraction}` from render call (line 78)  

**Verify**: Search for `onRefinementInteraction` in App.tsx - should have zero matches

### 3. Simplify inkInstance.rerender call in orchestrator
**Intent**: Remove obsolete callback prop from rerender invocation  
**Files**: `src/orchestrator.ts` (line 416)  
**Changes**:
- Remove `onRefinementInteraction: undefined` from the rerender props object  

**Verify**: Read orchestrator.ts:416 - should not contain `onRefinementInteraction`

### 4. Remove callback state from PlanningLayout component
**Intent**: Eliminate legacy callback state management  
**Files**: `src/ui/ink/components/PlanningLayout.tsx` (lines 160-168)  
**Changes**:
- Remove `refinementInteractionHandler` state variable declaration (line 160)
- Remove the `useEffect` hook that sets `refinementInteractionHandler` from props (lines 162-168)  

**Verify**: Search for `refinementInteractionHandler` in PlanningLayout.tsx - should only appear in TextInputModal handler (to be updated in next step)

### 5. Update TextInputModal to use CommandBus exclusively
**Intent**: Replace dual handler approach with pure CommandBus pattern  
**Files**: `src/ui/ink/components/PlanningLayout.tsx` (lines 847-873)  
**Changes**:
- Remove `answerResolver` state variable and all references (lines 858-861, 869-870)
- Update `onSubmit` handler (line 863) to:
  ```typescript
  onSubmit={async (answer) => {
    taskStateMachine.setAnsweringQuestion(true);
    await commandBus.sendCommand({ type: 'question:answer', answer });
  }}
  ```
- Update `onCancel` handler to match pattern if needed (currently empty)  

**Verify**: 
- Search for `answerResolver` in PlanningLayout.tsx - should have zero matches
- Search for `refinementInteractionHandler` in PlanningLayout.tsx - should have zero matches
- Modal condition (line 847) should only check `currentQuestion` existence

### 6. Verify TypeScript compilation and event flow
**Intent**: Ensure no type errors and CommandBus communication works  
**Files**: N/A (verification step)  
**Actions**:
- Run `npm run build` - must complete without errors
- Examine CommandBus definition in `src/ui/command-bus.ts` (lines 14, 93-94, 157-158) - confirm `question:answer` mapping returns string type  

**Verify**: Build succeeds with zero TypeScript errors

## Risks & Rollbacks

**Risk**: Answer not received by orchestrator if CommandBus queue is not properly processed  
**Mitigation**: CommandBus pattern already proven working for refinement/plan approval flows  
**Rollback**: Revert orchestrator.ts and PlanningLayout.tsx changes, restore callback props in App.tsx

**Risk**: Modal visibility state gets out of sync during question loop  
**Mitigation**: Preserved existing `taskStateMachine.setAnsweringQuestion()` calls  
**Rollback**: Check event emission in TaskStateMachine for `question:answering` event

**Concern**: The orchestrator question/answer loop (lines 380-398) has complex flow control - need to ensure CommandBus wait doesn't break iteration logic. Confident the pattern will work based on refinement approval migration, but this is the highest-risk integration point.

# Relocate Clarifying Question Modal to App Root Level

**Strategic Intent:** Ensure all modal overlays render at the application root level for consistent fullscreen behavior and unified event-driven architecture.

## Context

Currently, the clarifying question modal is rendered within `PlanningLayout.tsx`, while plan approval and task refinement modals are rendered at the `App.tsx` root level. This inconsistency may cause visual layering issues and deviates from the established pattern. The refactor will align the question modal with the event-driven architecture using CommandBus and TaskStateMachine events.

## Acceptance Criteria

- Clarifying question modal rendered at `App.tsx` root level
- Modal visibility controlled by `question:asked` and `question:answering` events
- Answer submission uses `commandBus.sendCommand({ type: 'question:answer', answer: string })`
- PlanningLayout contains no question modal rendering logic
- Modal achieves true fullscreen overlay consistent with other root-level modals
- TypeScript compiles successfully (`npm run build`)

## Steps

### 1. Research existing modal patterns at App root level
**Intent:** Understand how plan approval and task refinement modals are implemented to replicate the pattern.

**Files:** `src/ui/ink/App.tsx`

**Actions:**
- Read App.tsx to examine event subscription patterns for existing modals
- Identify conditional rendering logic for plan/task modals
- Note how state is read from TaskStateMachine (e.g., `getPendingRefinement()`, `getPlanMd()`)
- Document event listener setup and cleanup patterns

**Verification:** Can describe the exact pattern: event subscription in useEffect, conditional rendering based on TaskStateMachine getters, CommandBus command sending

### 2. Analyze current question modal implementation in PlanningLayout
**Intent:** Identify all code that needs to be moved and understand current event handling.

**Files:** `src/ui/ink/components/PlanningLayout.tsx`

**Actions:**
- Read PlanningLayout.tsx to locate question modal rendering code
- Identify state checks used for modal visibility (likely `currentQuestion` and `answeringQuestion`)
- Find answer submission logic (should already use CommandBus)
- Note any PlanningLayout-specific props or state related to questions

**Verification:** Have complete list of code blocks to move and understand current event dependencies

### 3. Verify TaskStateMachine question-related methods and events
**Intent:** Confirm the state machine provides necessary getters and emits required events.

**Files:** `src/task-state-machine.ts`

**Actions:**
- Read TaskStateMachine to verify `getCurrentQuestion()` and `getAnsweringQuestion()` methods exist
- Confirm `question:asked` and `question:answering` events are emitted
- Check `setCurrentQuestion()` and `setAnsweringQuestion()` emit events correctly
- Verify `clearCurrentQuestion()` exists for cleanup

**Verification:** All required methods and events are documented and functional

### 4. Add question modal to App.tsx root level
**Intent:** Implement modal rendering at application root following established patterns.

**Files:** `src/ui/ink/App.tsx`

**Actions:**
- Subscribe to `question:asked` and `question:answering` events in existing useEffect
- Add conditional rendering for question modal after existing modals
- Read state via `taskStateMachine.getCurrentQuestion()` and `taskStateMachine.getAnsweringQuestion()`
- Pass `commandBus` to modal component for answer submission
- Ensure cleanup in useEffect return (add `.off()` for new events)

**Verification:** App.tsx compiles, modal structure matches plan/task modal patterns

### 5. Remove question modal from PlanningLayout
**Intent:** Eliminate duplicate rendering and simplify PlanningLayout.

**Files:** `src/ui/ink/components/PlanningLayout.tsx`

**Actions:**
- Remove question modal component rendering
- Remove any question-related event subscriptions (if local)
- Remove question-related props from component interface (if any)
- Keep only the main planning display logic

**Verification:** PlanningLayout compiles, no question modal references remain

### 6. Verify TypeScript compilation
**Intent:** Ensure all changes are type-safe and compilation succeeds.

**Actions:**
- Run `npm run build`
- Fix any TypeScript errors related to imports, types, or missing references

**Verification:** `npm run build` exits with status 0, no compilation errors

### 7. Manual visual verification (optional, documented)
**Intent:** Confirm modal behavior matches expectations if manual testing is possible.

**Actions:**
- Document expected behavior: modal appears on `question:asked` event, overlays entire screen
- Document expected interaction: answer submission triggers `question:answer` command, modal hides on `question:answering`
- Note this step is optional due to Ink testing limitations

**Verification:** Behavior patterns are documented for future reference

## Risks & Rollbacks

**Risk 1:** Event subscription conflicts or missing cleanup cause memory leaks
- **Mitigation:** Follow exact pattern from existing modals, ensure all `.on()` have matching `.off()` in cleanup
- **Rollback:** Revert App.tsx changes, restore PlanningLayout modal

**Risk 2:** Modal visibility logic incorrect, causing modal to not appear or not hide
- **Mitigation:** Use exact same state check pattern as other modals (`getCurrentQuestion() && !getAnsweringQuestion()`)
- **Rollback:** Revert to PlanningLayout implementation

**Risk 3:** CommandBus command type mismatch breaks answer submission
- **Mitigation:** Verify command type string matches orchestrator's `waitForCommand` call
- **Rollback:** No change needed to CommandBus, only UI component adjustment required

**General Rollback:** All changes are isolated to UI components. Git revert of commits restores previous behavior with no data loss risk.

# Eliminate State Machine Getter Calls During Render Using React State

## Context

The Agneto UI currently uses `forceUpdate({})` to trigger re-renders when state machines emit events, then reads data via getter methods during render. This creates tight coupling between UI and state machine implementation details. The goal is to decouple by storing UI-relevant data in React state that updates via event handlers.

**Why this matters:**
- Getter calls during render create implicit dependencies that React cannot track
- Makes it harder to test components in isolation (mocked state machines must implement all getter methods)
- Violates React's principle of explicit data flow (props/state → render)
- Current pattern requires reading code to understand what data triggers re-renders vs what's read on-demand

**What we're solving:**
Moving from "event fires → forceUpdate → getters read during render" to "event fires → setState → React state read during render" makes data dependencies explicit in component state declarations.

## Acceptance Criteria

- [ ] App.tsx event handlers update React state instead of calling `forceUpdate({})`
- [ ] ExecutionLayout.tsx event handlers update React state instead of calling `forceUpdate({})`
- [ ] JSX expressions read from React state variables instead of calling getter methods
- [ ] Components initialize React state from current machine state on mount
- [ ] Event listeners properly cleaned up to prevent memory leaks
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] UI displays correctly during planning, execution, and review phases
- [ ] Injection modal (Ctrl+I) and human review prompts continue working

## Steps

### 1. Add React state for TaskStateMachine data in App.tsx
**Intent:** Store TaskStateMachine data in React state updated by events
**Files:** `src/ui/ink/App.tsx` (lines 98-140)
**Changes:**
- Add `useState` declarations for: `currentTaskState`, `planMd`, `pendingRefinement`, `currentQuestion`, `superReviewResult`, `gardenerResult`
- Initialize each from `taskStateMachine` getters on mount in existing `useEffect` (line 108)
- Update event handlers (`handleStateChange`, `handleDataUpdate`) to call `setState()` instead of `forceUpdate({})`
**Verify:** TypeScript compiles; console.log in event handlers shows setState calls firing

### 2. Replace getter calls with React state in App.tsx JSX
**Intent:** Remove direct state machine access during render
**Files:** `src/ui/ink/App.tsx` (lines 192-305)
**Changes:**
- In `getPhaseInfo()`: Replace `taskStateMachine.getCurrentState()` with `currentTaskState`
- In `getTaskInfo()`: Replace `taskStateMachine.getContext().originalTask` with stored context
- In `getPaneContent()`: Replace getter calls with React state variables
**Verify:** UI displays phase transitions correctly; no TypeScript errors

### 3. Add React state for CoderReviewerStateMachine data in ExecutionLayout.tsx
**Intent:** Store execution state in React state updated by events
**Files:** `src/ui/ink/components/ExecutionLayout.tsx` (lines 120-169)
**Changes:**
- Add `useState` for: `currentPhase`, `beanCounterOutput`, `coderOutput`, `reviewerOutput`, `coderSummary`, `reviewerSummary`, `needsHumanReview`
- Initialize from `executionStateMachine` getters in existing `useEffect` (line 120)
- Update event handlers to call `setState()` instead of `forceUpdate({})`
**Verify:** Console.log shows setState calls on execution phase changes

### 4. Replace getter calls with React state in ExecutionLayout.tsx JSX
**Intent:** Remove direct state machine access during render
**Files:** `src/ui/ink/components/ExecutionLayout.tsx` (lines 179-183, 233-263)
**Changes:**
- Replace `executionStateMachine.getAgentOutput('coder')` with `coderOutput` state
- Replace `executionStateMachine.getAgentOutput('reviewer')` with `reviewerOutput` state
- Replace `executionStateMachine.getNeedsHumanReview()` with `needsHumanReview` state
**Verify:** Agent output displays correctly during execution; human review prompts appear

### 5. Verify event cleanup and memory leaks
**Intent:** Ensure no memory leaks from event listeners
**Files:** `src/ui/ink/App.tsx` (line 124), `src/ui/ink/components/ExecutionLayout.tsx` (line 162)
**Changes:** Review existing cleanup functions to ensure all event listeners are removed
**Verify:** Add console.log in cleanup functions; unmount component (navigate away) shows cleanup logs

### 6. End-to-end testing
**Intent:** Verify all UI functionality works with React state
**Files:** N/A (manual testing)
**Changes:** Run full task execution: refinement → planning → execution → review
**Verify:**
- Phase transitions display correctly
- Agent outputs update in real-time
- Ctrl+I injection modal works
- Human review prompts appear when needed
- SuperReviewer/Gardener split-pane layout works

## Risks & Rollbacks

**Risks:**
- Initialization race: Event fires before `useEffect` runs → React state misses update
  - Mitigation: Initialize from current machine state in `useEffect` before subscribing
- Stale closure: Event handler captures old setState reference
  - Mitigation: Use functional setState updates: `setState(prev => newValue)`
- Over-rendering: Multiple setState calls per event
  - Mitigation: Batch related state in single useState object if needed

**Rollback:**
- Revert to `forceUpdate({})` pattern by restoring event handlers
- Remove useState declarations
- Restore getter calls in JSX

**Estimated time:** 30-45 minutes (mostly careful JSX updates to avoid breaking existing logic)

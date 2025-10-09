# Isolate Tool Status Rendering in PlanningStatusLine

**Strategic Intent:** Eliminate parent re-renders from high-frequency `tool:status` events by moving subscription, state, and rendering logic into a memoized child component.

## Context

`PlanningLayout.tsx` currently manages `taskToolStatus` state (line 84) with an isolated subscription (lines 86-108). Despite optimization, `setTaskToolStatus()` triggers parent re-renders on every event. The `statusLine` memoization (lines 426-477) and rendering (lines 805-809) depend on this state. Moving the entire subscription → computation → rendering chain into a memoized child component (`PlanningStatusLine`) will isolate re-renders to only that child.

## Acceptance Criteria

- `PlanningStatusLine` component exists as a memoized child with isolated `tool:status` subscription
- Component owns `toolStatus` state and `statusLine` computation logic (formerly lines 426-477)
- `PlanningLayout` removes `taskToolStatus` state, subscription (lines 84-108), and `statusLine` memoization (lines 426-477)
- Spinner + status line renders correctly in child component
- `npm run build` succeeds with no TypeScript errors
- Parent no longer re-renders on `tool:status` events (child handles independently)

## Steps

### 1. Create PlanningStatusLine Component

**Intent:** Encapsulate tool status subscription, computation, and rendering in a memoized child component.

**Files:**
- `src/ui/components/PlanningStatusLine.tsx` (new)

**Implementation:**
- Import: `React`, `useState`, `useEffect`, `useMemo`, `Text`, `Spinner` from Ink, `TaskStateMachine`, `TaskState` types
- Props interface: `{ currentState: TaskState; taskStateMachine: TaskStateMachine; pendingRefinement: string | null; planMd: string | null; curmudgeonFeedback: string | null }`
- Local state: `const [toolStatus, setToolStatus] = useState<{ agent: string; tool: string; summary: string } | null>(null)`
- `useEffect` subscription:
  - Subscribe to `tool:status` event
  - Handler: `setToolStatus(taskStateMachine.getToolStatus())`
  - Return cleanup: `taskStateMachine.off('tool:status', handler)`
  - Deps: `[taskStateMachine]`
- Copy `statusLine` memoization logic from `PlanningLayout.tsx:426-477`:
  - `const statusLine = useMemo(() => { ... }, [currentState, toolStatus, pendingRefinement, planMd, curmudgeonFeedback])`
  - (Keep identical logic; only rename `taskToolStatus` → `toolStatus`)
- Render: `{statusLine && <Text><Spinner type="dots" /> {statusLine}</Text>}`
- Export: `export default React.memo(PlanningStatusLine)`

**Verification:** File compiles; no syntax errors.

---

### 2. Update PlanningLayout to Use Child Component

**Intent:** Remove parent-level tool status management and delegate to `PlanningStatusLine`.

**Files:**
- `src/ui/components/PlanningLayout.tsx`

**Implementation:**
- Remove lines 84-108 (state + subscription)
- Remove lines 426-477 (`statusLine` memoization)
- Import `PlanningStatusLine` at top
- Replace lines 805-809 with:
  ```tsx
  <PlanningStatusLine
    currentState={currentState}
    taskStateMachine={taskStateMachine}
    pendingRefinement={pendingRefinement}
    planMd={planMd}
    curmudgeonFeedback={curmudgeonFeedback}
  />
  ```

**Verification:** File compiles; `PlanningLayout` no longer references `taskToolStatus` or `statusLine`.

---

### 3. Verify Compilation and Rendering

**Intent:** Confirm implementation is correct and functional.

**Files:**
- All modified files

**Verification:**
- Run `npm run build` → succeeds with no TypeScript errors
- Manual test: Launch planning flow; verify spinner + status line renders correctly in terminal
- Inspect: Parent component no longer re-renders on `tool:status` events (can add temporary debug log in parent render to confirm)

---

## Risks & Rollbacks

**Risks:**
- Props interface mismatch (e.g., missing context needed for `statusLine` computation) → caught by TypeScript
- Event subscription lifecycle issues (memory leak if cleanup fails) → validated by existing patterns in codebase

**Rollback:** Revert commit if issues detected; pattern is well-established (similar to existing memoized components).

---

**Confidence:** Confident. Approach follows existing memoization patterns (StatusIndicator, MarkdownText) and CLAUDE.md performance guidance. Integration path is clear: child owns subscription → state → computation → rendering; parent delegates entirely.

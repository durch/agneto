# Execution Phase UI Redesign

## Context
The current execution UI swaps content between Coder and Reviewer, obscuring concurrent agent activity. This plan introduces a split-pane view with static status indicators and keyboard shortcuts for detailed inspection, using existing TaskStateMachine APIs and FullscreenModal patterns.

## Acceptance Criteria
- Right pane displays Coder and Reviewer summaries in 50/50 vertical split during execution
- Static colored indicators (green/gray circles) show active agent based on execution state
- Contextual status text updates per execution phase
- Keyboard shortcuts C and R open fullscreen modals with complete agent outputs
- Footer displays shortcuts (C/R) during execution phase
- Left pane Bean Counter display remains unchanged

## Steps

### 1. Add split-pane layout and static status indicators
**Intent:** Replace single-content right pane with dual-agent display using static colored circles

**Files:** `src/ui/ink/components/PlanningLayout.tsx`

**Changes:**
- Within `{executionState && currentState === TaskState.TASK_EXECUTING}` block:
  - Replace existing `<Box>` with two vertically stacked `<Box>` components (50% height each)
  - Add `getActiveAgent(state: ExecutionState)` helper function that returns 'coder' | 'reviewer' based on state:
    - PLANNING, IMPLEMENTING → 'coder'
    - PLAN_REVIEW, CODE_REVIEW → 'reviewer'
    - Default → null
  - Add `getAgentStatusText(agent: 'coder' | 'reviewer', state: ExecutionState)` helper function returning contextual text:
    - Coder: "Proposing implementation..." (PLANNING), "Writing code..." (IMPLEMENTING)
    - Reviewer: "Reviewing plan..." (PLAN_REVIEW), "Reviewing code..." (CODE_REVIEW)
  - Render each agent box with:
    - Static colored circle prefix: `<Text color={isActive ? 'green' : 'gray'}>●</Text>`
    - Agent name (Coder/Reviewer)
    - Status text from helper
    - Summary text from `taskStateMachine.getCoderSummary()` / `getReviewerSummary()`

**Verification:**
```bash
npm start -- "test execution UI"
# During execution phase, verify:
# - Both Coder and Reviewer sections visible simultaneously
# - Green circle appears next to active agent (matches execution state)
# - Gray circle appears next to inactive agent
# - Status text updates contextually as states transition
```

### 2. Implement keyboard shortcuts and fullscreen modals
**Intent:** Add C/R shortcuts to open modals displaying full agent output

**Files:** `src/ui/ink/components/PlanningLayout.tsx`

**Changes:**
- Add state: `const [modalContent, setModalContent] = useState<{agent: string, content: string} | null>(null)`
- Add `useInput` handler for execution phase:
  ```typescript
  useInput((input, key) => {
    if (currentState !== TaskState.TASK_EXECUTING) return;
    if (input === 'c' || input === 'C') {
      const output = taskStateMachine.getAgentOutput('coder');
      setModalContent({ agent: 'Coder', content: output });
    }
    if (input === 'r' || input === 'R') {
      const output = taskStateMachine.getAgentOutput('reviewer');
      setModalContent({ agent: 'Reviewer', content: output });
    }
    if (key.escape && modalContent) {
      setModalContent(null);
    }
  });
  ```
- Render `<FullscreenModal>` when `modalContent` is set:
  ```tsx
  {modalContent && (
    <FullscreenModal
      title={`${modalContent.agent} Full Output`}
      content={modalContent.content}
      onClose={() => setModalContent(null)}
    />
  )}
  ```

**Verification:**
```bash
# During execution phase:
# - Press 'c' key → fullscreen modal opens with complete Coder output
# - Press ESC → modal closes
# - Press 'r' key → fullscreen modal opens with complete Reviewer output
# - Press ESC → modal closes
# - Verify modal titles show "Coder Full Output" / "Reviewer Full Output"
```

### 3. Update footer shortcuts for execution phase
**Intent:** Display C/R shortcuts in footer during execution

**Files:** `src/ui/ink/components/PlanningLayout.tsx`

**Changes:**
- Locate existing footer rendering logic (likely in `<Footer>` component or bottom `<Box>`)
- Add conditional shortcuts display for execution phase:
  ```tsx
  {currentState === TaskState.TASK_EXECUTING && (
    <Text dimColor> | C: Coder Details | R: Reviewer Details</Text>
  )}
  ```
- Ensure this appears alongside existing shortcuts (Q to quit, etc.)

**Verification:**
```bash
# Start task and wait for execution phase
# - Footer shows "C: Coder Details | R: Reviewer Details" during execution
# - Footer reverts to previous shortcuts when execution completes
# - No layout shifts or visual glitches
```

### 4. Integration testing across execution states
**Intent:** Verify UI correctly tracks state machine transitions and displays appropriate agent status

**Files:** None (verification only)

**Changes:** N/A

**Verification:**
```bash
# Start a simple task that will go through full execution cycle
npm start -- "add a comment to README"

# Verify state transitions and UI updates:
# 1. BEAN_COUNTING → Bean Counter active in left pane, right pane shows both agents (Coder inactive)
# 2. PLANNING → Coder shows green circle, status "Proposing implementation..."
# 3. PLAN_REVIEW → Reviewer shows green circle, status "Reviewing plan..."
# 4. IMPLEMENTING → Coder shows green circle, status "Writing code..."
# 5. CODE_REVIEW → Reviewer shows green circle, status "Reviewing code..."
# 6. At each state, test C/R shortcuts to verify correct agent output in modal
# 7. Verify left pane Bean Counter display never changes
```

## Risks & Rollbacks

**Risk:** `getAgentOutput()` may return empty string during state transitions
- Mitigation: Display fallback text "No output yet" when content is empty
- Rollback: Remove modal feature, rely on inline summaries only

**Risk:** 50/50 vertical split may truncate long summaries on small terminals
- Mitigation: Truncate text with "..." and rely on fullscreen modal (C/R) for full content
- Rollback: Revert to original single-pane swapping behavior

**Risk:** Static indicators may not clearly convey "activity" compared to blinking
- Mitigation: Use bold text for active agent name (`<Text bold>`) in addition to green color
- Rollback: Falls back to color-only indicators (still functional)

**Risk:** Modal rendering may conflict with existing fullscreen modal usage
- Mitigation: Ensure `modalContent` state is scoped only to execution phase
- Rollback: Remove modal feature, document C/R shortcuts as "coming soon"

## Confidence
**High confidence** - This plan uses existing patterns (FullscreenModal, TaskStateMachine APIs), makes localized changes to a single component, and follows standard React hook patterns. Static indicators avoid timer complexity. The vertical split is a straightforward layout change with clear fallback strategies.

---
_Plan created after 1 iteration(s) with human feedback_

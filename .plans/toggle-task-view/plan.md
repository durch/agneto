# Add Hotkey-Toggled Task Description View

## Context

Implement a fullscreen task description view accessible via 'T' key, mirroring the existing Plan View (accessible via 'P' key). Remove task description from main UI layout.

## Acceptance Criteria

- Task description removed from main UI
- 'T' key opens fullscreen task description view
- 'Esc' or 'T' closes the view
- Visual design matches Plan View
- No conflicts with existing hotkeys
- No regressions in existing features

## Steps

### 1. Locate and examine PlanView pattern
**Intent**: Understand component structure and integration points  
**Files**: `src/ui/ink/components/PlanView.tsx`, `src/ui/ink/App.tsx`  
**Actions**:
- Read PlanView.tsx to understand component props, layout, keyboard handling
- Read App.tsx to understand state management (showPlanView) and keyboard event wiring
**Verify**: Can describe PlanView's props, state management, and keyboard handlers

### 2. Create TaskView component
**Intent**: Create fullscreen task view matching PlanView structure  
**Files**: `src/ui/ink/components/TaskView.tsx` (new)  
**Actions**:
- Copy PlanView.tsx as template
- Replace plan content with task description display
- Update component name, props interface, and documentation
**Verify**: Component renders task description in fullscreen layout

### 3. Add showTaskView state to App
**Intent**: Enable toggling task view visibility  
**Files**: `src/ui/ink/App.tsx`  
**Actions**:
- Add `const [showTaskView, setShowTaskView] = useState(false)`
- Add 'T' key handler to toggle state
- Ensure 'Esc' handler also closes task view
**Verify**: `grep -n "showTaskView" src/ui/ink/App.tsx` shows state and handlers

### 4. Remove task description from main layout
**Intent**: Eliminate task description from primary UI  
**Files**: `src/ui/ink/components/PlanningLayout.tsx` (or wherever task description currently displays)  
**Actions**:
- Locate current task description rendering
- Remove or comment out that display logic
**Verify**: Main UI no longer shows task description inline

### 5. Wire TaskView into App
**Intent**: Integrate component with state and data  
**Files**: `src/ui/ink/App.tsx`  
**Actions**:
- Import TaskView component
- Render TaskView when `showTaskView === true`
- Pass `taskStateMachine` props for task description data
- Pass `onClose={() => setShowTaskView(false)}` handler
**Verify**: TaskView appears when state is true, receives correct props

### 6. End-to-end validation
**Intent**: Confirm complete functionality  
**Files**: N/A (testing)  
**Actions**:
- Run `npm start -- "test task"`
- Press 'T' → task view opens
- Press 'Esc' or 'T' → view closes
- Verify main UI has no task description
- Test 'P' key still works for plan view
**Verify**: All acceptance criteria met, no regressions

## Risks & Rollbacks

**Risk**: Task description data not available in expected location  
**Mitigation**: Examine `taskStateMachine` API in step 1; adjust props in step 5 if needed

**Risk**: Keyboard event conflicts  
**Mitigation**: Check existing key handlers in App.tsx during step 3; choose different key if 'T' conflicts

**Rollback**: Revert TaskView.tsx creation and App.tsx changes; restore task description to original location

---
_Plan created after 1 iteration(s) with human feedback_

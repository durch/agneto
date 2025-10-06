# Fix Ctrl+T Keyboard Shortcut for Task Modal

## Context
The Agneto TUI advertises a Ctrl+T shortcut in the footer to view task descriptions, but the keyboard handler was never implemented. The modal infrastructure (state, rendering, and TaskView component) already exists and works correctly. We only need to wire up the missing keyboard shortcut handler.

## Acceptance Criteria
- Pressing Ctrl+T opens the TaskView modal displaying the task description
- Modal shows `taskToUse` (refined) if available, otherwise `humanTask` (original)
- Pressing Esc closes the modal (existing functionality)
- Works in all task states (planning, executing, etc.)
- Follows existing patterns for keyboard shortcuts (e.g., Ctrl+P)
- No interference with existing shortcuts

## Steps

### 1. Add Ctrl+T keyboard handler to global useInput hook
**Intent**: Capture Ctrl+T keypress and toggle task modal visibility

**File**: `src/ui/ink/App.tsx`

**Change**: In the global `useInput` hook (currently lines 169-218), add a new handler for Ctrl+T after the Ctrl+P handler block (around line 185):

```typescript
if (input === 't' && key.ctrl) {
  // Only show if task description is available
  const hasTaskDescription = taskToUse || humanTask;
  if (hasTaskDescription) {
    setIsTaskModalOpen((prev) => !prev);
  }
  return;
}
```

**Verification**: 
- Read lines 169-218 to confirm exact insertion point
- Check that handler follows same pattern as Ctrl+P handler (lines 179-185)
- Ensure it's placed before the catch-all modal input handlers (after line 218)
- Verify `taskToUse` and `humanTask` variables are in scope (they should be from React state)

### 2. Verify modal closes correctly with Esc key
**Intent**: Confirm existing Esc key handling works for the task modal

**File**: `src/ui/ink/App.tsx`

**Verification steps**:
- Read lines 185-191 (existing Esc key handler)
- Confirm it checks `isTaskModalOpen` and calls `setIsTaskModalOpen(false)`
- No code changes needed - just verification that existing logic covers this modal

**Confidence**: Very high - existing code already handles this correctly

### 3. Test the shortcut manually
**Intent**: Verify end-to-end functionality

**Verification steps**:
1. Build project: `npm run build`
2. Run Agneto with a test task: `npm start -- "test task"`
3. During execution, press Ctrl+T
4. Confirm modal opens with task description
5. Press Esc to close
6. Press Ctrl+T again to reopen
7. Try during different phases (planning, executing, etc.)

**Expected behavior**:
- Modal opens/closes cleanly
- Task description is visible and readable
- No console errors
- Works consistently across different task states

## Risks & Rollbacks

**Risk 1**: Shortcut conflicts with terminal emulator or OS shortcuts
- **Mitigation**: Ctrl+T is uncommon for system shortcuts; Ink captures input reliably
- **Rollback**: Remove the handler block from `useInput` hook

**Risk 2**: Modal doesn't display correct task description
- **Mitigation**: TaskView component already works correctly (used in other contexts)
- **Rollback**: Check that `taskToUse` and `humanTask` are properly propagated to TaskView props

**Risk 3**: Toggle behavior interferes with other modals
- **Mitigation**: Follow existing pattern from Ctrl+P handler (uses same toggle pattern)
- **Rollback**: Change from toggle to simple `setIsTaskModalOpen(true)` if needed

## Confidence Level
**High confidence** - This is a simple addition of 6 lines of code following an established pattern. All infrastructure exists and works. The only uncertainty is whether there are edge cases where `taskToUse` and `humanTask` are both undefined, but the check handles that gracefully by doing nothing.

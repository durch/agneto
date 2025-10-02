# Simplify Keyboard Shortcuts to Menu-Based Navigation

## Context

The Agneto Ink UI currently uses multiple conflicting keyboard shortcuts (A/R/X/Tab/Arrows) across PlanningLayout and ExecutionLayout. This change replaces these shortcuts with menu-based navigation using `ink-select-input`, preserving only essential shortcuts: Ctrl/Cmd+Enter (submit), Enter (select), and Esc (cancel).

## Acceptance Criteria

- Single-letter shortcuts (A/R/X) completely removed from PlanningLayout and ExecutionLayout
- Tab and arrow-based pane navigation removed from PlanningLayout
- Menu-based selection using arrow keys + Enter for all approval/rejection actions
- All existing resolver functions called with identical data (approval flows unchanged)
- TextInputModal, FullscreenModal, TaskView shortcuts unchanged (Ctrl/Cmd+Enter, Esc)
- No keyboard shortcut conflicts exist between UI states
- Users can complete approval workflows using only: arrows, Enter, and Esc

## Steps

### 1. Add ink-select-input dependency
**Intent:** Install menu navigation library required for replacement

**Files to modify:**
- package.json

**Action:** Run `npm install ink-select-input --save`

**Verification:** Check `package.json` shows `ink-select-input` in dependencies, `npm list ink-select-input` confirms installation

### 2. Research existing keyboard handler patterns
**Intent:** Understand current useInput hooks and resolver wiring before modifications

**Files to read:**
- src/ui/ink/components/PlanningLayout.tsx (lines 139-219, resolver setup lines 48-77)
- src/ui/ink/components/ExecutionLayout.tsx (lines 106-127, resolver setup)

**Action:** Grep for `useInput` usage across UI components, verify resolver callback patterns

**Verification:** Document which shortcuts map to which resolver calls (e.g., A → handleApprove, R → handleReject)

### 3. Replace PlanningLayout shortcuts with inline SelectInput menus
**Intent:** Remove all keyboard shortcuts (A/R/S/D/E/C/Tab/Arrows/X), replace with menu-based selection

**Files to modify:**
- src/ui/ink/components/PlanningLayout.tsx

**Implementation:**
1. Add `import SelectInput from 'ink-select-input'` at top
2. Remove entire `useInput` hook (lines 139-219)
3. Remove `focusedPane` state and all pane navigation logic
4. When `showApprovalOptions === true` and approval needed, render:
   ```tsx
   <SelectInput 
     items={[
       { label: 'Approve Plan', value: 'approve' },
       { label: 'Reject Plan', value: 'reject' },
       { label: 'Simplify', value: 'simplify' },
       { label: 'Add Detail', value: 'add-detail' },
       { label: 'Wrong Approach', value: 'wrong-approach' },
       { label: 'Edit Steps', value: 'edit-steps' }
     ]}
     onSelect={(item) => {
       if (item.value === 'approve') handleApprove();
       else if (item.value === 'reject') handleReject();
       else handleFeedback(item.value);
     }}
   />
   ```
5. When SuperReviewer active (abandonTask callback exists), render:
   ```tsx
   <SelectInput 
     items={[{ label: 'Abandon Task', value: 'abandon' }]}
     onSelect={() => abandonTask?.()}
   />
   ```
6. Ensure menu only shows when approval needed (same conditional logic as before)

**Verification:** 
- Arrow keys navigate menu items
- Enter key calls correct resolver (check console logs or state changes)
- Approval/rejection flows work identically to before
- No residual `useInput` hook code remains

### 4. Replace ExecutionLayout shortcuts with inline SelectInput menus
**Intent:** Remove A/R/X shortcuts, replace with menu for human review decisions

**Files to modify:**
- src/ui/ink/components/ExecutionLayout.tsx

**Implementation:**
1. Add `import SelectInput from 'ink-select-input'` at top
2. Remove `useInput` hook (lines 106-127)
3. When `humanReviewNeeded === true`, render:
   ```tsx
   <SelectInput 
     items={[
       { label: 'Approve', value: 'approve' },
       { label: 'Retry', value: 'retry' },
       { label: 'Reject', value: 'reject' }
     ]}
     onSelect={(item) => {
       if (item.value === 'approve') handleApprove();
       else if (item.value === 'retry') handleRetry();
       else if (item.value === 'reject') handleReject();
     }}
   />
   ```
4. Ensure menu only shows during human review state

**Verification:**
- Menu appears when reviewer requests human input
- Arrow keys navigate, Enter selects
- Each menu option calls correct resolver function
- Human review decisions work identically to before

### 5. Verify no keyboard conflicts across UI states
**Intent:** Ensure no shortcuts clash between modals, menus, and input fields

**Files to check:**
- src/ui/ink/components/TextInputModal.tsx (verify Ctrl/Cmd+Enter, Esc still work)
- src/ui/ink/components/FullscreenModal.tsx (verify Esc still works)
- src/ui/ink/components/TaskView.tsx (verify Esc still works)
- src/ui/ink/components/PlanningLayout.tsx (verify no useInput remains)
- src/ui/ink/components/ExecutionLayout.tsx (verify no useInput remains)

**Action:** Grep for `useInput` across all components, verify only allowed shortcuts exist

**Verification:** 
- `grep -r "useInput" src/ui/ink/components/` shows only TextInputModal, FullscreenModal, TaskView
- No single-letter shortcuts (A/R/X/S/D/E/C) remain
- No Tab or arrow-based pane navigation remains

### 6. Integration testing with full approval flow
**Intent:** Test complete user journey through refinement, planning, execution phases

**Test scenarios:**
1. Start task, navigate refinement approval menu (arrows + Enter)
2. Navigate planning approval menu, test all feedback options
3. Trigger human review in execution, test approve/retry/reject menu
4. Open fullscreen modal (Enter), verify Esc closes it
5. Open text input modal, verify Ctrl/Cmd+Enter submits, Esc cancels
6. Verify SuperReviewer abandon menu works

**Verification:**
- All approval flows complete successfully
- No keyboard shortcut errors logged
- Menu selections trigger correct state transitions
- Modals maintain existing Esc/Ctrl+Enter behavior

### 7. Rebuild and manual smoke test
**Intent:** Ensure TypeScript compiles and basic navigation works

**Action:** Run `npm run build`, then `npm start -- "simple test task"`

**Verification:**
- Build succeeds with no TypeScript errors
- UI renders menus correctly during approval states
- Arrow key navigation + Enter selection works smoothly
- No console errors about undefined shortcuts

## Risks & Rollbacks

**Risks:**
- Menu navigation may feel slower than single-letter shortcuts (UX tradeoff for clarity)
- SelectInput component may have unexpected behavior with Ink v6 (verify compatibility)
- Resolver functions might not fire if onSelect wiring is incorrect

**Rollback:**
- Git revert changes to PlanningLayout.tsx and ExecutionLayout.tsx
- Uninstall `ink-select-input` if it causes issues
- Previous `useInput` hooks are preserved in git history

**Mitigation:**
- Test SelectInput compatibility early (Step 3 verification)
- Keep resolver wiring identical to previous implementation
- Verify each menu option individually before moving to next component

# Create Text Input Modal Component and SuperReviewer Decision Type

## Context
Build a reusable multi-line text input modal for the Ink UI following existing FullscreenModal patterns, and add a TypeScript interface for SuperReviewer decisions. The component must properly handle multi-line text input as specified in requirements.

## Acceptance Criteria
- [ ] SuperReviewerDecision interface added to src/types.ts with approve/retry/abandon actions and optional feedback
- [ ] TextInputModal component created with fullscreen double-border layout matching FullscreenModal.tsx
- [ ] Multi-line text input properly implemented (verify ink-text-input supports multiline or use alternative approach)
- [ ] Keyboard shortcuts: Cmd/Ctrl+Enter submits, Esc cancels, Enter adds newline
- [ ] Visual feedback shows character count and submit hint
- [ ] TypeScript compilation succeeds with no errors

## Steps

### 1. Add SuperReviewerDecision type definition
**Intent:** Define the interface for SuperReviewer decision outputs

**Files:** `src/types.ts`

**Action:**
- Add interface after SuperReviewerResult (line ~16):
  ```typescript
  export interface SuperReviewerDecision {
    action: 'approve' | 'retry' | 'abandon';
    feedback?: string;
  }
  ```

**Verify:** `npm run build` succeeds

### 2. Create TextInputModal component with proper multi-line handling
**Intent:** Implement fullscreen modal with multi-line text input and keyboard shortcuts

**Files:** 
- `src/ui/ink/components/TextInputModal.tsx` (create)
- `src/ui/ink/components/FullscreenModal.tsx` (reference)

**Action:**
- Copy double-border Box pattern from FullscreenModal.tsx
- Verify ink-text-input package exists in package.json
- Check ink-text-input documentation for multiline support
- Implement component with:
  - Props interface: title, placeholder, onSubmit, onCancel
  - Fullscreen Box with double border
  - Multi-line text input (using ink-text-input if it supports multiline, or React.useState + manual text handling if needed)
  - useInput hook for keyboard shortcuts (Cmd/Ctrl+Enter submit, Esc cancel, Enter newline)
  - Bottom row with character count and submit hint
- Export as named export

**Important:** Must preserve Enter key for newlines while using Cmd/Ctrl+Enter for submission. If ink-text-input doesn't support this pattern, implement custom text handling with useState and manual cursor management.

**Verify:** Component compiles and keyboard shortcuts work as specified

### 3. Build and verify
**Intent:** Confirm implementation is correct

**Action:** Run `npm run build`

**Verify:** Zero TypeScript errors

## Risks & Rollbacks
- **Risk:** ink-text-input may not support multiline Enter behavior → **Mitigation:** Implement custom text area with useState and manual line handling
- **Risk:** Keyboard shortcut conflicts → **Mitigation:** Test that Enter creates newlines and only Cmd/Ctrl+Enter submits

---

**Confidence:** High for type definition. Medium-high for component - depends on ink-text-input capabilities, but fallback to custom implementation is straightforward if needed. The requirement for proper multi-line handling is non-negotiable and will be implemented correctly.

---
_Plan created after 2 iteration(s) with human feedback_

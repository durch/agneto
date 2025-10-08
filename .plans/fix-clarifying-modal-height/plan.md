# Remove Artificial Height Cap from Clarifying Questions Modal

**Strategic Intent:** Allow the refinement clarifying questions modal to expand to available terminal height instead of being arbitrarily limited to 30 rows.

## Context

The `TextInputModal` used for clarifying questions during refinement is constrained by `Math.min(terminalHeight - 4, 30)`, which caps the modal at 30 rows even when significantly more terminal space is available. Other modals in the codebase (e.g., `FullscreenModal`) use `terminalHeight - 4` directly without artificial limits. This change removes the unnecessary cap while preserving the required 4-row margin.

## Acceptance Criteria

- [ ] Modal height calculation uses `terminalHeight - 4` without the 30-row limit
- [ ] TypeScript compilation succeeds with no errors
- [ ] Code change is confined to a single line in App.tsx

## Steps

### 1. Remove the 30-row height cap from TextInputModal rendering
**Intent:** Change the height calculation from `Math.min(terminalHeight - 4, 30)` to `terminalHeight - 4` to allow full terminal height usage.

**Files:**
- `src/ui/App.tsx:369`

**Action:** Replace the `height` prop value with `terminalHeight - 4`, removing the `Math.min(..., 30)` constraint.

**Verification:** 
```bash
npm run build
```
Expected: Clean compilation with no TypeScript errors.

### 2. Verify the change matches existing modal patterns
**Intent:** Confirm the modified height calculation aligns with how other modals (like `FullscreenModal`) handle height.

**Files:**
- `src/ui/App.tsx:386-389` (FullscreenModal reference for comparison)

**Verification:** Visual inspection confirms consistency with the `FullscreenModal` height pattern (`terminalHeight`).

## Risks & Rollbacks

**Risks:**
- None significant; the 4-row margin prevents overflow, and the pattern is proven in `FullscreenModal`

**Rollback:**
- If issues arise, restore the original `Math.min(terminalHeight - 4, 30)` calculation

**Confidence:** Confident. The change is minimal, the pattern exists elsewhere in the codebase, and the 4-row margin provides safety.

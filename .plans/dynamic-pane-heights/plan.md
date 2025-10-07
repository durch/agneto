# Dynamic Vertical Space Allocation in PlanningLayout

## Context

PlanningLayout currently uses a hardcoded 50/50 split for vertical space via `const paneContentHeight = Math.floor(availableContentHeight / 2) - 4;` on line 303. This prevents top panes from filling available space naturally. The fix is a simple flexbox adjustment: remove the static calculation, add flexGrow to the top row, and handle content overflow appropriately.

## Acceptance Criteria

- No static `paneContentHeight` calculation based on `availableContentHeight / 2`
- Top panes fill available vertical space using flexbox properties
- Bottom "Live Activity" panel remains visible
- Content overflow handled gracefully without breaking layout
- Layout responds correctly to terminal resizing

## Steps

1. **Remove static height calculation**
   - **Intent**: Eliminate hardcoded 50/50 vertical split
   - **File**: `src/ui/ink/components/PlanningLayout.tsx` (line 303)
   - **Change**: Delete `const paneContentHeight = Math.floor(availableContentHeight / 2) - 4;`
   - **Verify**: File compiles, no linting errors

2. **Make top row container flexible**
   - **Intent**: Allow top row to expand and fill available vertical space
   - **File**: `src/ui/ink/components/PlanningLayout.tsx` (around line 325)
   - **Change**: Add `flexGrow={1}` to the top row `<Box>` container
   - **Verify**: Grep shows no remaining references to `paneContentHeight` outside MarkdownText prop usages

3. **Remove maxLines props from MarkdownText components**
   - **Intent**: Let content flow naturally within parent Box constraints
   - **Files**: `src/ui/ink/components/PlanningLayout.tsx` (all MarkdownText usages)
   - **Change**: Remove `maxLines={paneContentHeight}` from all MarkdownText instances in top panes
   - **Verify**: Build succeeds, MarkdownText receives no maxLines prop (it's already optional per MarkdownText.tsx:11)

4. **Test overflow behavior and add constraint if needed**
   - **Intent**: Ensure very long markdown content doesn't exceed terminal height
   - **File**: `src/ui/ink/components/PlanningLayout.tsx` (top row Box, if needed)
   - **Change**: Test with long content. If Ink doesn't clip naturally, add `height={availableContentHeight - 10}` to top row Box (reserving space for bottom panel)
   - **Verify**: Run app with various content lengths, resize terminal - bottom panel stays visible, no layout breaks

## Risks & Rollbacks

**Risk**: Content overflow breaks layout if Ink doesn't clip automatically  
**Mitigation**: Step 4 adds explicit height constraint if needed  
**Rollback**: Git revert; restore line 303 and maxLines props

**Risk**: Bottom panel gets hidden by expanding top panes  
**Mitigation**: Height constraint in step 4 reserves space for bottom panel  
**Rollback**: Adjust height calculation in step 4

This is a minimal-change plan: 3 lines modified (1 deleted, 1 flexGrow added, multiple maxLines removed), with conditional height constraint if overflow testing reveals issues.

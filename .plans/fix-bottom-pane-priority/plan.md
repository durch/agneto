# Fix Bottom Pane Layout Priority in Ink UI

## Context

The Agneto Ink UI currently allows top content panes to grow unbounded (`flexGrow={1}`), which can compress the bottom human interaction pane when terminal height is limited. This creates a critical UX issue where menu options may become invisible. We need to invert the flex priority: top panes should compress first, bottom pane should maintain full visibility.

## Acceptance Criteria

- Bottom pane (human interaction menu/modals) is always fully visible with all options displayed
- Top content panes compress/scroll first when terminal height is limited
- Existing fullscreen shortcuts (Ctrl+Q/W/E) for top panes continue working
- Fix applies to both `PlanningLayout.tsx` and `ExecutionLayout.tsx`
- No visual regression in normal terminal height scenarios

## Implementation Plan

### 1. Research Current Layout Structure
**Intent**: Understand the exact flexbox configuration and dependencies before making changes.

**Files to examine**:
- `src/ui/ink/components/PlanningLayout.tsx` (lines 320-777)
- `src/ui/ink/components/ExecutionLayout.tsx` (lines 243-427)

**Actions**:
```bash
# Examine exact Box hierarchy and flex properties
grep -n "flexGrow\|flexShrink\|minHeight\|maxHeight" src/ui/ink/components/PlanningLayout.tsx
grep -n "flexGrow\|flexShrink\|minHeight\|maxHeight" src/ui/ink/components/ExecutionLayout.tsx

# Check if there are any existing height constraints
grep -n "height=" src/ui/ink/components/PlanningLayout.tsx src/ui/ink/components/ExecutionLayout.tsx
```

**Verification**: Confirm line numbers and structure match description (root container, top panes, bottom pane sections).

---

### 2. Remove Root Container Flex Growth in PlanningLayout
**Intent**: Prevent the entire PlanningLayout from expanding unbounded, which would allow bottom pane compression.

**File**: `src/ui/ink/components/PlanningLayout.tsx:320`

**Change**: Remove or set `flexGrow={0}` on the root `<Box>` container to prevent automatic expansion.

**Verification**: 
```bash
# Confirm flexGrow is removed/set to 0
grep -A 2 "^  <Box flexDirection=\"column\" borderStyle=\"round\"" src/ui/ink/components/PlanningLayout.tsx
```

---

### 3. Add Flex Shrink Priority to Top Panes in PlanningLayout
**Intent**: Force top content panes to compress before the bottom pane when space is limited.

**File**: `src/ui/ink/components/PlanningLayout.tsx` (lines containing top pane Box components)

**Changes**:
- Add `flexShrink={1}` to top content panes (plan display, super-review pane, gardener pane)
- Keep or add `flexGrow={1}` to allow them to use available space when not constrained

**Verification**:
```bash
# Check top panes have shrink priority
grep -B 2 -A 2 "planMd\|superReviewResults\|gardenerResults" src/ui/ink/components/PlanningLayout.tsx | grep -E "flexGrow|flexShrink"
```

---

### 4. Protect Bottom Pane with Flex Constraints in PlanningLayout
**Intent**: Guarantee bottom pane maintains full visibility and never compresses.

**File**: `src/ui/ink/components/PlanningLayout.tsx` (lines 574-731, bottom pane section)

**Changes**:
- Add `flexShrink={0}` to bottom pane container Box to prevent compression
- Consider adding `minHeight` if menu content has known minimum (but check if this is needed - flexShrink=0 may be sufficient)

**Verification**:
```bash
# Confirm bottom pane has shrink protection
grep -A 5 "Bottom pane.*question modal\|SelectInput" src/ui/ink/components/PlanningLayout.tsx | grep -E "flexShrink|minHeight"
```

---

### 5. Apply Identical Changes to ExecutionLayout
**Intent**: Ensure consistent behavior across both layout components.

**File**: `src/ui/ink/components/ExecutionLayout.tsx:243`

**Changes** (mirror steps 2-4):
- Remove/set `flexGrow={0}` on root container (line 243)
- Add `flexShrink={1}, flexGrow={1}` to top content panes (ExecutionOutputPane area)
- Add `flexShrink={0}` to bottom pane container (lines 335-389)

**Verification**:
```bash
# Compare flex properties between both files
diff <(grep -E "flexGrow|flexShrink" src/ui/ink/components/PlanningLayout.tsx) \
     <(grep -E "flexGrow|flexShrink" src/ui/ink/components/ExecutionLayout.tsx)
```

---

### 6. Build and Manual Testing
**Intent**: Verify TypeScript compiles and no visual regressions occur.

**Actions**:
```bash
npm run build

# Test in constrained terminal height (resize terminal to ~15 rows)
# TODO: Manual verification required - check:
# 1. Bottom menu fully visible with all options
# 2. Top panes compress/scroll appropriately
# 3. Fullscreen shortcuts (Ctrl+Q/W/E) still work
# 4. Normal terminal height (30+ rows) looks unchanged
```

**Success criteria**: Clean build, no visual breaks, bottom pane never compressed.

---

## Risks & Rollback

**Risks**:
- **Top pane content truncation**: If top panes compress too aggressively, critical content might not be visible. Mitigation: Top panes already have fullscreen shortcuts (Ctrl+Q/W/E).
- **Modal rendering issues**: Modals might behave unexpectedly with new flex constraints. Mitigation: Modals use separate rendering logic (FullscreenModal, TextInputModal) which should be unaffected.
- **Unknown flex edge cases**: Ink's flexbox implementation might have quirks. Mitigation: Minimal changes (only flex properties), easy to revert.

**Rollback**: Revert flex property changes in both component files. No data or state changes involved.

**Confidence**: High confidence this will work based on standard flexbox behavior. The pattern is well-established (shrink parent's flexible children first, protect critical UI with `flexShrink={0}`). Main uncertainty is whether `minHeight` will be needed on bottom pane, but starting with `flexShrink={0}` is the correct minimal approach.

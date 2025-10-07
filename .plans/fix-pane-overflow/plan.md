# Strategic Intent

Replace line-based truncation with terminal-row-aware overflow detection using simple conversion logic that accounts for formatting overhead without manual height tracking.

# Fix Pane Overflow Detection with Row-Aware Truncation

## Context

The Ink UI uses dynamic pane sizing based on terminal dimensions, but overflow detection relies on line-based truncation that doesn't account for terminal width wrapping or markdown formatting overhead (margins, borders, headers). This causes inaccurate truncation - content that looks like "5 lines" may render as 8 terminal rows. The fix uses a simple conversion approach: treat available terminal rows as a content line budget with a formatting overhead multiplier, leveraging Ink's built-in wrapping rather than tracking each element's rendered height.

## Acceptance Criteria

- MarkdownText accepts `maxHeight` prop (terminal rows) and converts to content lines using simple percentage-based overhead estimation
- Conversion logic accounts for formatting overhead without per-element height tracking
- ExecutionLayout uses `maxHeight` instead of `maxLines` for beanCounter pane
- PlanningLayout calculates and distributes height budgets across MarkdownText instances based on rendering state
- Truncation indicator appears when content exceeds available terminal rows
- Existing `maxLines` prop remains supported for backward compatibility

## Steps

### 1. Add `maxHeight` prop to MarkdownText with row-to-line conversion

**Intent:** Enable MarkdownText to accept terminal row budget and estimate usable content lines.

**Files:** `src/ui/ink/components/MarkdownText.tsx`

**Changes:**
- Add `maxHeight?: number` to `MarkdownTextProps` interface (keep existing `maxLines` for backward compatibility)
- Add conversion logic: `const estimatedMaxLines = maxHeight ? Math.floor(maxHeight * 0.8) : maxLines`
- Use `estimatedMaxLines` in existing line-slicing logic (no changes to truncation logic itself)
- Update truncation check: `const isTruncated = estimatedMaxLines && lines.length > estimatedMaxLines`

**Verification:** Read the updated file - logic should use `estimatedMaxLines` consistently; 0.8 multiplier reserves 20% for formatting overhead.

### 2. Update ExecutionLayout to use maxHeight

**Intent:** Pass terminal row budget to MarkdownText instead of content line count.

**Files:** `src/ui/ink/components/ExecutionLayout.tsx`

**Changes:**
- Verify line 270 currently uses `maxLines={beanCounterHeight}`
- Change to `maxHeight={beanCounterHeight}` (beanCounterHeight is already in terminal rows)
- Calculate height budgets for Coder and Reviewer panes: `const agentPaneHeight = terminalHeight - beanCounterHeight - HEADER_FOOTER_HEIGHT` (define constant for header/footer space)
- Pass `maxHeight={agentPaneHeight}` to MarkdownText in Coder and Reviewer sections

**Verification:** Grep for `<MarkdownText` in ExecutionLayout.tsx - all instances should use `maxHeight` with terminal row values; no `maxLines` props should reference height calculations.

### 3. Calculate and distribute height budgets in PlanningLayout

**Intent:** Allocate available vertical space across MarkdownText instances based on which states render simultaneously.

**Files:** `src/ui/ink/components/PlanningLayout.tsx`

**Research first:** Read lines 395-620 to determine rendering patterns:
- Identify conditional blocks that render multiple MarkdownText instances simultaneously vs. exclusively
- Check if left/right panes split height or stack vertically
- Note which TaskState values trigger which MarkdownText renders

**Changes:**
- Calculate per-pane heights: If side-by-side layout, each pane gets `availableContentHeight`; if stacked, divide by 2
- For exclusive rendering states (only one MarkdownText at a time): pass full pane height
- For concurrent rendering (multiple MarkdownText in same pane): divide pane height by number of concurrent instances
- Add `maxHeight` prop to all MarkdownText instances (lines 400, 420, 449, 467, 479 in left panel; lines 516, 540, 569, 589, 612 in right panel)

**Verification:** Read the updated file - each MarkdownText should receive `maxHeight` matching its available vertical space; concurrent instances should sum to ≤ pane height.

## Risks & Rollbacks

**Risk:** 0.8 multiplier may over/under-truncate on heavily formatted content (many code blocks or headers).

**Mitigation:** Multiplier is easily tunable (change 0.8 to 0.7 or 0.85) without architectural changes.

**Rollback:** Revert to `maxLines` prop usage; remove `maxHeight` prop and conversion logic.

**Risk:** PlanningLayout may have complex rendering patterns with dynamic MarkdownText instance counts.

**Mitigation:** Step 3 starts with reading existing rendering logic before making changes; allocation strategy adapts to discovered patterns.

**Rollback:** Remove `maxHeight` props from PlanningLayout; keep ExecutionLayout changes only.

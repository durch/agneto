**Strategic Intent:** Enable formatted markdown rendering in Task Refiner clarifying questions for consistent visual presentation across all agent communications.

# Update Task Refiner Questions to Use MarkdownText Component

## Context

The Task Refiner displays clarifying questions during the refinement phase. Currently, these questions are likely rendered as plain text in a modal at the App.tsx root level. The MarkdownText component already exists in the codebase for rendering formatted markdown content (used in plans, refinements, and review outputs). This change aligns question display with the existing markdown-first communication pattern throughout Agneto's UI.

## Acceptance Criteria

- Clarifying questions render with MarkdownText component, preserving markdown formatting (bold, italic, lists, code blocks, etc.)
- Question modal maintains current layout and positioning at App.tsx root level
- Question answering flow via CommandBus (`question:answer`) remains unchanged
- No errors or warnings during `npm run build`
- Event-driven architecture (`question:asked` event) remains intact

## Steps

### 1. Locate the current question modal implementation
**Intent:** Identify where clarifying questions are currently rendered to understand the baseline implementation.

**Files to examine:**
- `src/ui/ink/App.tsx` (root-level modal rendering)
- `src/ui/ink/components/` (check for any QuestionModal or similar component)

**Verification:** Can describe current question rendering approach (component name, location, current text rendering method).

**Approach:** Use Grep to find "question:asked" event usage and ReadFile to examine App.tsx modal rendering logic.

### 2. Verify MarkdownText component location and usage pattern
**Intent:** Understand how MarkdownText is imported and used elsewhere in the UI to replicate the pattern.

**Files to examine:**
- `src/ui/ink/components/PlanningLayout.tsx` (likely uses MarkdownText for plan display)
- Find MarkdownText component definition/import path

**Verification:** Can identify MarkdownText import path and typical usage pattern (props, wrapping, etc.).

**Approach:** Grep for "MarkdownText" component usage, ReadFile relevant files to understand props and patterns.

### 3. Replace plain Text with MarkdownText in question modal
**Intent:** Update the question rendering to use MarkdownText for formatted output.

**Files to modify:**
- The file identified in Step 1 where question text is rendered (likely `App.tsx` or a modal component it uses)

**Changes:**
- Import MarkdownText component
- Replace `<Text>{currentQuestion}</Text>` (or similar) with `<MarkdownText content={currentQuestion} />` (adjust props based on Step 2 findings)

**Verification:** Visual inspection of question modal with markdown-formatted question text (if possible, or verify via code review that MarkdownText is properly invoked).

### 4. Verify TypeScript compilation
**Intent:** Ensure no type errors introduced by the change.

**Command:** `npm run build`

**Verification:** Build completes successfully with no TypeScript errors or warnings related to the changes.

## Risks & Rollbacks

**Risk:** MarkdownText component may have layout constraints (width, wrapping) that don't fit the modal context.
**Mitigation:** Review MarkdownText usage in PlanningLayout to understand typical container requirements. If issues arise, may need to adjust modal Box styling.

**Risk:** Question content may not always be valid markdown, causing rendering issues.
**Mitigation:** MarkdownText should gracefully handle plain text (markdown renderers typically pass through plain text unchanged). If issues occur, inspect actual question content format from Task Refiner.

**Rollback:** Revert the Text→MarkdownText change in the identified file. Simple one-line edit rollback.

---

**Confidence Level:** High confidence this is a straightforward component substitution. The event-driven architecture and modal structure remain untouched. Primary concern is ensuring MarkdownText props match the expected interface (likely just `content` prop based on typical usage patterns in Ink markdown components).

# Dynamic Height Sizing for ExecutionLayout Bean Counter Pane

**Strategic Intent:** Replace hardcoded height calculation in ExecutionLayout with dynamic sizing that respects terminal boundaries and preserves interactive elements.

## Context

ExecutionLayout currently uses a hardcoded percentage-based height calculation (`Math.floor(terminalHeight * 0.5)`) for the Bean Counter pane, which doesn't account for header, footer, status panel, and interaction menu space. PlanningLayout already implements correct dynamic height via the `availableContentHeight` prop calculated in App.tsx. This task aligns ExecutionLayout with the proven PlanningLayout pattern to prevent terminal overflow while maintaining interactive element visibility.

## Acceptance Criteria

- ExecutionLayout receives `availableContentHeight`, `terminalHeight`, and `terminalWidth` props (matching PlanningLayout interface)
- Bean Counter pane's MarkdownText uses `availableContentHeight` for maxHeight calculation
- Coder and Reviewer panes dynamically calculate heights based on `availableContentHeight` (maintaining split-pane proportions)
- Human review SelectInput menus remain fully visible and functional
- No terminal overflow or unwanted scrolling occurs during task execution
- TypeScript compiles without errors (`npm run build`)

## Steps

1. **Update ExecutionLayout prop interface** (src/ui/ink/components/ExecutionLayout.tsx)
   - **Intent:** Add missing height-related props to match PlanningLayout
   - **File:** src/ui/ink/components/ExecutionLayout.tsx:15-32
   - **Action:** Add `availableContentHeight: number`, `terminalHeight: number`, `terminalWidth: number` to ExecutionLayoutProps interface
   - **Verify:** TypeScript compilation passes; interface matches PlanningLayout's prop signature

2. **Remove hardcoded beanCounterHeight calculation** (src/ui/ink/components/ExecutionLayout.tsx)
   - **Intent:** Eliminate percentage-based height logic that doesn't account for UI chrome
   - **File:** src/ui/ink/components/ExecutionLayout.tsx:224
   - **Action:** Delete `const beanCounterHeight = Math.max(15, Math.floor(terminalHeight * 0.5));`
   - **Verify:** Line 224 no longer exists; no references to old `beanCounterHeight` variable remain

3. **Calculate dynamic pane heights from availableContentHeight** (src/ui/ink/components/ExecutionLayout.tsx)
   - **Intent:** Use available content height to compute Bean Counter, Coder, and Reviewer pane heights
   - **File:** src/ui/ink/components/ExecutionLayout.tsx:224 (after step 2 deletion)
   - **Action:** Add calculations:
     ```typescript
     const beanCounterHeight = availableContentHeight;
     const coderReviewerAvailableHeight = availableContentHeight;
     const coderHeight = Math.floor(coderReviewerAvailableHeight * 0.5);
     const reviewerHeight = coderReviewerAvailableHeight - coderHeight;
     ```
   - **Verify:** Variables defined; values are positive integers; split-pane proportions preserved

4. **Update Bean Counter MarkdownText maxHeight** (src/ui/ink/components/ExecutionLayout.tsx)
   - **Intent:** Apply dynamic height to Bean Counter pane's MarkdownText component
   - **File:** src/ui/ink/components/ExecutionLayout.tsx:~240 (Bean Counter MarkdownText component)
   - **Action:** Ensure `maxHeight={beanCounterHeight}` prop uses new dynamic calculation
   - **Verify:** Grep confirms `maxHeight={beanCounterHeight}` exists; no hardcoded values remain

5. **Update Coder pane MarkdownText maxHeight** (src/ui/ink/components/ExecutionLayout.tsx)
   - **Intent:** Apply dynamic height to Coder pane's MarkdownText component
   - **File:** src/ui/ink/components/ExecutionLayout.tsx:~260 (Coder MarkdownText component)
   - **Action:** Change MarkdownText `maxHeight` prop to `maxHeight={coderHeight}`
   - **Verify:** Grep confirms `maxHeight={coderHeight}` in Coder section

6. **Update Reviewer pane MarkdownText maxHeight** (src/ui/ink/components/ExecutionLayout.tsx)
   - **Intent:** Apply dynamic height to Reviewer pane's MarkdownText component
   - **File:** src/ui/ink/components/ExecutionLayout.tsx:~280 (Reviewer MarkdownText component)
   - **Action:** Change MarkdownText `maxHeight` prop to `maxHeight={reviewerHeight}`
   - **Verify:** Grep confirms `maxHeight={reviewerHeight}` in Reviewer section

7. **Update App.tsx ExecutionLayout prop passing** (src/ui/ink/App.tsx)
   - **Intent:** Pass calculated height props from App.tsx to ExecutionLayout
   - **File:** src/ui/ink/App.tsx:~400 (ExecutionLayout component usage)
   - **Action:** Add props: `availableContentHeight={availableContentHeight}`, `terminalHeight={terminalHeight}`, `terminalWidth={terminalWidth}` to ExecutionLayout component
   - **Verify:** Grep confirms all three props passed; matches PlanningLayout prop passing pattern

8. **Verify TypeScript compilation** (project root)
   - **Intent:** Ensure no type errors introduced by interface changes
   - **File:** N/A (build verification)
   - **Action:** Run `npm run build` from project root
   - **Verify:** Build completes successfully with exit code 0; no TypeScript errors reported

## Risks & Rollbacks

**Risk:** Pane heights too small on very small terminals (< 30 rows), causing content truncation  
**Mitigation:** `availableContentHeight` calculation in App.tsx already includes `Math.max(10, ...)` floor; split calculations maintain minimum viable heights  
**Rollback:** Revert ExecutionLayout.tsx interface and calculations; restore hardcoded `beanCounterHeight` at line 224

**Risk:** Interactive menus (SelectInput) overlap with content after height changes  
**Mitigation:** Status panel calculation (lines 370-426) already reserves space for menus via `statusOverhead` constant  
**Rollback:** Adjust `coderReviewerAvailableHeight` to subtract additional menu space if overlap occurs

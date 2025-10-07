# Fix Bean Counter Markdown Rendering in Ink UI

## Context
Bean Counter output displays raw markdown syntax in the Ink UI because the orchestrator manually constructs plain text output and the UI component uses `<Text>` instead of the existing `<MarkdownText>` component. Terminal output already renders correctly via `prettyPrint()`.

## Acceptance Criteria
- Bean Counter output in Ink UI displays formatted markdown (headers, bold, code blocks)
- No raw markdown syntax visible in UI (no `#`, `**`, `` ` `` characters)
- Terminal output remains unchanged (already working)
- Audit logs remain unchanged (already storing raw responses correctly)

## Steps

### 1. Store raw Bean Counter response in orchestrator
**Intent**: Preserve markdown formatting by storing the raw response instead of manually constructed plain text

**Files**: `src/orchestrator.ts` (around line 1499-1500)

**Changes**:
- Replace manual construction of `chunkOutput` string with direct storage of `rawResponse`
- Change `stateMachine.setAgentOutput('bean', chunkOutput)` to `stateMachine.setAgentOutput('bean', rawResponse)`

**Verify**: Read lines 1490-1510 of orchestrator.ts to confirm raw response is stored in state machine

### 2. Use MarkdownText component in ExecutionLayout
**Intent**: Render markdown formatting in UI using existing proven component

**Files**: `src/ui/ink/components/ExecutionLayout.tsx` (line 267)

**Changes**:
- Replace `<Text wrap="wrap">{leftContent}</Text>` with `<MarkdownText maxLines={beanCounterHeight}>{leftContent}</MarkdownText>`
- Pattern already proven in `PlanningLayout.tsx:351`

**Verify**: Read ExecutionLayout.tsx to confirm MarkdownText component is used for Bean Counter output

### 3. Test rendering
**Intent**: Confirm markdown displays correctly in UI

**Testing**:
- Run `npm run build` to verify TypeScript compiles
- Execute a test task with Bean Counter output
- Visual check: Bean Counter messages show formatted headers, bold text, code blocks (not raw `#`, `**`, `` ` ``)

**Verify**: Bean Counter output in UI matches formatted quality of Planner output

## Risks & Rollbacks

**Risk**: MarkdownText component may have different wrapping behavior than Text component
- Mitigation: MarkdownText already used successfully for plan display (PlanningLayout.tsx:351)
- Rollback: Revert both changes if layout breaks

**Risk**: Raw response may contain interpreter metadata not suitable for display
- Mitigation: Bean Counter responses are natural language descriptions (verified by interpreter pattern in CLAUDE.md)
- Rollback: Restore manual text construction if response format is unsuitable

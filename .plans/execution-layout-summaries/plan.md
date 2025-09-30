# Enhance ExecutionLayout with Agent Summaries and Stable Status Indicators

## Context

The ExecutionLayout currently displays full agent outputs. This plan adds concise summaries with animated status indicators while maintaining stable rendering. The executionStateMachine already provides summary methods, and keyboard shortcuts for full outputs exist.

**Confidence**: High. The required state machine methods and helper function already exist, making this a focused display-layer modification.

## Acceptance Criteria

- Agent summaries render using `executionStateMachine.getSummary('coder')` and `getSummary('reviewer')`
- Active agent status indicator blinks green (●) ↔ gray (●) at 750ms intervals
- No visual flicker or layout shifts during animations
- Fallback text "Generating summary..." displays when summaries unavailable
- All existing state-based layout logic and keyboard shortcuts preserved

## Steps

### 1. Add blink state management
**Intent**: Track animation state for status indicator color toggling  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx` (top of component, after line 26)  
**Changes**: Add `const [blinkOn, setBlinkOn] = React.useState(true);` state hook  
**Verify**: TypeScript compiles without errors

### 2. Implement blink timer effect
**Intent**: Toggle blink state every 750ms for active agent indicator  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx` (after step 1 addition)  
**Changes**: Add `React.useEffect()` with `setInterval(() => setBlinkOn(prev => !prev), 750)` and cleanup  
**Verify**: Lint passes, effect follows React hooks patterns

### 3. Create stable status indicator component
**Intent**: Render fixed-width status that only changes color, not character/spacing  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx` (new helper function before return statement)  
**Changes**: 
```typescript
const getStatusIndicator = (agent: 'coder' | 'reviewer') => {
  const isActive = getActiveAgent(executionStateMachine) === agent;
  const color = isActive ? (blinkOn ? 'green' : 'gray') : 'gray';
  return <Text color={color}>● </Text>; // Single circle + space
};
```
**Verify**: Helper returns consistent JSX with fixed character width

### 4. Replace Coder status indicator (line 219)
**Intent**: Use animated status for Coder section header  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx:219`  
**Changes**: Replace existing status text with `{getStatusIndicator('coder')}Coder`  
**Verify**: Coder header shows blinking green circle when active, gray when inactive

### 5. Replace Coder content with summary (line 229)
**Intent**: Display concise Coder summary instead of full output  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx:229`  
**Changes**: Replace `{coderOutput}` with `{executionStateMachine.getSummary('coder') || 'Generating summary...'}`  
**Verify**: Coder pane shows summary text or fallback, no truncation artifacts

### 6. Replace Reviewer status indicator (line 242)
**Intent**: Use animated status for Reviewer section header  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx:242`  
**Changes**: Replace existing status text with `{getStatusIndicator('reviewer')}Reviewer`  
**Verify**: Reviewer header shows blinking green circle when active, gray when inactive

### 7. Replace Reviewer content with summary (line 253)
**Intent**: Display concise Reviewer summary instead of full output  
**Files**: `src/ui/ink/components/ExecutionLayout.tsx:253`  
**Changes**: Replace `{reviewerOutput}` with `{executionStateMachine.getSummary('reviewer') || 'Generating summary...'}`  
**Verify**: Reviewer pane shows summary text or fallback, no truncation artifacts

### 8. Visual stability verification
**Intent**: Confirm no layout shifts during animations  
**Files**: N/A (runtime testing)  
**Changes**: Run task and observe execution phase for consistent character positions  
**Verify**: Status indicators blink without causing text reflow, borders remain stable

## Risks & Rollbacks

**Risk**: Summary content may be excessively long despite being "summaries"  
**Mitigation**: If summaries exceed pane height, truncate with `...` at fixed line count  
**Rollback**: Revert to full outputs if summary methods don't exist or produce unusable content

**Risk**: Blink interval may cause performance issues with frequent re-renders  
**Mitigation**: 750ms is conservative; React efficiently handles color-only changes  
**Rollback**: Remove blink effect, use static green indicator for active agent

---
_Plan created after 1 iteration(s) with human feedback_

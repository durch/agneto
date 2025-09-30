# Plan: Wire Planner Streaming to UI via Live Activity

## Context

The planner agent needs to stream its output to the Ink UI in real-time. The infrastructure exists (`setLiveActivityMessage`, `inkInstance.rerender`) but the planner's streaming callback isn't wired up. This will provide immediate visual feedback during the planning phase instead of a silent wait.

## Acceptance Criteria

- Planner output appears incrementally in the UI as text is generated
- Each streaming chunk triggers `taskStateMachine.setLiveActivityMessage('Planner', text)` followed by `inkInstance.rerender()`
- Activity message is cleared when planner completes (success/error/interruption)
- No changes to planner's core logic or output format
- Existing UI rendering patterns remain intact

## Steps

### 1. Locate planner invocation in orchestrator
**Intent**: Find where the planner agent is called to understand current callback usage  
**Files**: `src/orchestrator.ts`  
**How to verify**: Grep for planner function calls and identify the streaming callback parameter

### 2. Examine planner agent implementation
**Intent**: Understand the planner's streaming callback mechanism and contract  
**Files**: `src/agents/planner.ts`  
**How to verify**: ReadFile to confirm callback signature, when it's invoked, and what data it receives

### 3. Add streaming callback to planner invocation
**Intent**: Wire planner's streaming output to update task state machine  
**Files**: `src/orchestrator.ts`  
**Changes**:
- Add callback parameter to planner call: `(chunk) => { taskStateMachine.setLiveActivityMessage('Planner', chunk); inkInstance.rerender(<App taskStateMachine={taskStateMachine} />); }`
- Ensure callback handles incremental text chunks appropriately
**How to verify**: Streaming callback compiles and matches planner's expected signature

### 4. Clear activity message after planner completes
**Intent**: Reset UI state when planning phase finishes  
**Files**: `src/orchestrator.ts`  
**Changes**:
- After planner success: `taskStateMachine.setLiveActivityMessage('Planner', null)`
- In error handlers: `taskStateMachine.setLiveActivityMessage('Planner', null)`
- Before state transitions away from planning
**How to verify**: Message clears in both success and error paths

### 5. Test with simple task
**Intent**: Verify streaming works end-to-end without breaking existing behavior  
**Command**: `npm start -- "add a comment to README"`  
**How to verify**: 
- UI shows planner output streaming in real-time during planning phase
- Activity message disappears after planning completes
- Plan is still stored correctly and shown for approval
- No console errors or UI rendering issues

## Risks & Rollbacks

**Risks**:
- Rapid re-rendering could cause UI flicker (mitigated by Ink's efficient diffing)
- Incomplete text chunks might display awkwardly (acceptable for streaming UX)
- Error during streaming could leave stale messages (addressed in step 4)

**Rollback**: Remove streaming callback parameter from planner call; system reverts to previous silent behavior

## Confidence Level

I'm confident this approach will work based on the existing `setLiveActivityMessage` API and the documented UI re-rendering pattern. The main uncertainty is the exact callback signature the planner expects, which step 2 will clarify.

---
_Plan created after 1 iteration(s) with human feedback_

# Fix Tool Status Display Timing by Clearing Only on New Information

## Context
The logging system displays ephemeral tool status lines that clear too aggressively. Currently, status clears on every agent message and tool completion, making useful status information disappear before users can read it. The solution is to only clear status when new meaningful information arrives, allowing status to persist naturally until replaced.

## Acceptance Criteria
- Tool status lines remain visible until new meaningful content arrives
- Status clearing only occurs when there's actual new information to display
- Empty messages, raw responses, and message consolidation don't clear status
- No disruption to existing logging, streaming, or message formatting functionality
- Terminal output remains clean without orphaned status lines

## Steps

1. **Modify clearToolStatus to accept content parameter**
   - **Intent**: Allow conditional clearing based on whether there's meaningful content to display
   - **Files**: `src/ui/log.ts:763-766` (clearToolStatus method)
   - **Changes**: Add optional `hasContent: boolean = true` parameter, only clear when hasContent is true
   - **Verify**: Method signature updated, existing calls work with default parameter

2. **Update agent message methods to pass content indicators**
   - **Intent**: Prevent status clearing on empty or buffered messages that don't provide user value
   - **Files**: `src/ui/log.ts:284,299,329,359,392` (agent method clearToolStatus calls)
   - **Changes**: Pass `false` for clearToolStatus on raw/empty messages, `true` only for substantive content
   - **Verify**: Status persists during message consolidation, clears only for meaningful agent responses

3. **Modify toolResult to not automatically clear status**
   - **Intent**: Let tool status persist after completion until new information arrives
   - **Files**: `src/ui/log.ts:465` (toolResult clearToolStatus call)
   - **Changes**: Remove automatic clearToolStatus call from toolResult method
   - **Verify**: Tool status remains visible after completion, doesn't interfere with subsequent output

4. **Update streaming and consolidation logic to preserve status**
   - **Intent**: Ensure status isn't cleared during message buffering and streaming operations
   - **Files**: `src/ui/log.ts:284,299` (agentMessageRaw, agentMessage methods)
   - **Changes**: Only clear status when displaying final consolidated messages, not during streaming
   - **Verify**: Status persists during streaming, clears when complete message is shown

5. **Ensure error and completion messages clear status appropriately**
   - **Intent**: Clear status when displaying error messages or final completion notifications
   - **Files**: `src/ui/log.ts:329,359,392` (agentMessageChunk, toolError, etc.)
   - **Changes**: Clear status for error messages and completion notifications that provide closure
   - **Verify**: Status clears for errors and completion, preserves for intermediate updates

## Risks & Rollbacks
- **Risk**: Status lines might persist indefinitely if no new content arrives
- **Rollback**: Add fallback timeout or revert to clearing on tool completion
- **Risk**: Status might interfere with final output formatting
- **Rollback**: Ensure status clears on process termination or critical messages

---
_Plan created after 2 iteration(s) with human feedback_

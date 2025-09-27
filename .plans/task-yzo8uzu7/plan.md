Now I understand the current architecture. Let me create a focused plan for adding real-time tool usage display:

# Real-Time Tool Usage Display Implementation

## Context
The current logging system has debug-only tool tracking via `toolUse()` and `toolResult()` methods in `src/ui/log.ts:443-467`. All agents already register callback hooks (`onToolUse` and `onToolResult`) that call these logging methods. The system needs a persistent status line that displays at all log levels, overwrites itself during tool execution, and clears when tools complete.

## Acceptance Criteria
- Single-line status display showing current tool execution: `⚙️ [Agent] → Tool: params`
- Visible at all log levels (info, verbose, debug), not just debug mode
- Uses ANSI escape codes to overwrite the same line on each tool use
- Clears cleanly when tool completes or when other logging output occurs
- Integrates with existing callback system without disrupting current functionality
- Preserves existing debug-mode tool logging behavior

## Steps

1. **Add real-time status tracking to LogUI class**
   - **Intent**: Track active tool state and provide persistent status display
   - **Files**: `src/ui/log.ts:16-63` (class properties section)
   - **Changes**: Add properties to track current tool status and display state
   - **Verify**: Properties added without compilation errors

2. **Create persistent status display method**
   - **Intent**: Implement ANSI-based overwriting status line with proper formatting
   - **Files**: `src/ui/log.ts:732` (end of class, before export)
   - **Changes**: Add method that writes status line using carriage return and escape codes
   - **Verify**: Method formats tool info correctly and uses proper ANSI sequences

3. **Create status clearing method**
   - **Intent**: Clear the persistent status line when tool completes or other output occurs
   - **Files**: `src/ui/log.ts:732` (after status display method)
   - **Changes**: Add method to clear the current line and reset status tracking
   - **Verify**: Method properly clears line and resets state

4. **Modify toolUse method to show real-time status**
   - **Intent**: Display persistent status immediately when tool starts, regardless of log level
   - **Files**: `src/ui/log.ts:443-454` (existing toolUse method)
   - **Changes**: Add persistent status display call before existing debug logging
   - **Verify**: Status appears at all log levels while preserving debug output

5. **Modify toolResult method to clear status**
   - **Intent**: Clear persistent status when tool completes
   - **Files**: `src/ui/log.ts:456-467` (existing toolResult method)
   - **Changes**: Add status clearing call before existing debug logging
   - **Verify**: Status clears properly while preserving debug output

6. **Add status clearing to other logging methods**
   - **Intent**: Ensure status line clears before any other output to prevent interference
   - **Files**: `src/ui/log.ts:282-419` (agent logging methods)
   - **Changes**: Add status clearing call at the beginning of each agent logging method
   - **Verify**: Status clears before normal output, preventing display conflicts

## Risks & Rollbacks

**Risk**: ANSI escape codes might not work correctly in all terminals
- **Mitigation**: Use widely-supported escape sequences (\r and standard clear codes)
- **Rollback**: Remove persistent status calls, system reverts to debug-only tool logging

**Risk**: Status display interferes with existing logging or streaming output
- **Mitigation**: Clear status before any other output and use isolated status tracking
- **Rollback**: Comment out status display calls in toolUse/toolResult methods

**Risk**: Performance impact from frequent status updates
- **Mitigation**: Use lightweight string operations and minimal console writes
- **Rollback**: Add conditional check to disable real-time status if needed

---
_Plan created after 1 iteration(s) with human feedback_

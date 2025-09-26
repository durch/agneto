# Enhance Logging System Readability

## Context
The logging system in src/ui/log.ts needs improved readability through log levels, reduced redundancy, and visual hierarchy while maintaining backward compatibility and streaming capabilities.

## Acceptance Criteria
- LOG_LEVEL environment variable (debug/verbose/info) controls output verbosity
- Tool JSON parameters show concise summaries instead of full JSON
- "Interpreted as" messages consolidated with their source output
- Visual section dividers mark state machine phase transitions
- Tree-style indentation groups related operations
- Status badges reflect current execution phase
- Zero breaking changes to existing log calls
- Streaming remains smooth and responsive

## Steps

1. **Add log level configuration to LogUI class**
   - Intent: Enable environment-based verbosity control
   - Files: src/ui/log.ts
   - Verify: Set LOG_LEVEL=info and confirm debug messages don't appear

2. **Create tool parameter summarizer utility**
   - Intent: Replace verbose JSON with readable summaries
   - Files: src/ui/log.ts (add private summarizeToolParams method)
   - Verify: Tool logs show "ReadFile: src/main.ts" instead of full JSON

3. **Implement message consolidation for interpretations**
   - Intent: Merge "Interpreted as" with source message on same line
   - Files: src/ui/log.ts (modify log method logic)
   - Verify: Single line shows "Coder response → interpreted as: complete"

4. **Add section divider rendering with box characters**
   - Intent: Visual separation between execution phases
   - Files: src/ui/log.ts (add private renderDivider method)
   - Verify: ═══ dividers appear at phase transitions

5. **Implement tree-style indentation tracking**
   - Intent: Show relationship hierarchy in grouped operations
   - Files: src/ui/log.ts (add indentation state and modify log method)
   - Verify: Sub-items display with "└─" prefix

6. **Integrate status badges with state machine phases**
   - Intent: Clear phase indicators in output
   - Files: src/ui/log.ts (add phase badge generation)
   - Verify: Logs show [PLANNING], [SPRINT 1/3], [COMPLETE] badges

7. **Update log method to apply all enhancements**
   - Intent: Combine all features while preserving API
   - Files: src/ui/log.ts (refactor main log method)
   - Verify: Existing code works unchanged with enhanced output

8. **Test streaming with new formatting**
   - Intent: Ensure smooth real-time output
   - Files: Run existing flows with DEBUG=true
   - Verify: No stuttering or broken progress indicators

## Risks & Rollbacks
- Risk: Breaking existing log calls - Rollback: Revert log.ts changes
- Risk: Performance impact from formatting - Rollback: Simplify or cache formatters
- Risk: Terminal compatibility issues with box chars - Rollback: Use ASCII alternatives

---
_Plan created after 1 iteration(s) with human feedback_

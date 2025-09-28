# Add Comprehensive Pretty Print Display for Curmudgeon Agent Responses

## Context
The Curmudgeon agent currently only shows brief verdict messages, but the full reasoning from responses is valuable for understanding plan review decisions. Need to implement the same logging pattern used by other agents (planner, coder, reviewer, beanCounter) with proper formatting and visual consistency.

## Acceptance Criteria
- New `curmudgeon()` method added to LogUI class with icon, color, and prettyPrint formatting
- Method properly bound in LogUI constructor alongside other agent methods  
- CURMUDGEON phase added to phase transition handling with appropriate badge styling
- Log call added in curmudgeon.ts after provider.query() response to display full formatted response
- Curmudgeon responses display with consistent visual formatting matching other agents
- No regression in existing logging functionality

## Steps

1. **Examine existing agent logging patterns**
   - Intent: Understand the exact implementation pattern for consistency
   - Files: `src/ui/log.ts` (lines 200-400 for agent methods)
   - Verify: Can identify icon/color choices and prettyPrint usage in existing methods

2. **Add curmudgeon method to LogUI class**
   - Intent: Create new agent logging method following established pattern
   - Files: `src/ui/log.ts` (add method around line 350 with other agent methods)
   - Verify: Method signature matches pattern `curmudgeon(content: string, phase?: string)` with appropriate icon and color

3. **Bind curmudgeon method in LogUI constructor**
   - Intent: Ensure method is properly bound for external usage
   - Files: `src/ui/log.ts` (add binding in constructor around lines 46-63)
   - Verify: `this.curmudgeon = this.curmudgeon.bind(this);` added alongside other bindings

4. **Add CURMUDGEON phase to phase transition handling**
   - Intent: Enable proper phase badges and transitions for curmudgeon logging
   - Files: `src/ui/log.ts` (in checkPhaseTransition method around line 100-150)
   - Verify: CURMUDGEON case added with appropriate badge styling matching other phases

5. **Integrate curmudgeon logging in agent execution**
   - Intent: Display full curmudgeon response with formatting after provider query
   - Files: `src/agents/curmudgeon.ts` (add log call after line 48)
   - Verify: `logUI.curmudgeon(response, 'CURMUDGEON');` call added to display full response

6. **Test logging integration**
   - Intent: Verify curmudgeon responses display properly with consistent formatting
   - Files: Run curmudgeon agent to see formatted output
   - Verify: Full curmudgeon reasoning displays with proper markdown formatting and visual consistency

## Risks & Rollbacks
- **Risk**: Breaking existing logging flow or phase transitions
- **Rollback**: Remove curmudgeon method binding and phase handling, revert curmudgeon.ts changes
- **Risk**: Inconsistent formatting compared to other agents  
- **Rollback**: Adjust icon/color choices to match established patterns

## Confidence Level
I'm confident this approach will work as it follows the exact established patterns used by all other agents in the codebase. The implementation is straightforward and low-risk.

---
_Plan created after 1 iteration(s) with human feedback_

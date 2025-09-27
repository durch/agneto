# Curmudgeon Natural Language Interpreter Implementation

## Context
Replace the rigid VERDICT/REASONING/SUGGESTION parsing in the Curmudgeon agent with a natural language interpreter to match the pattern used by other agents in the system. This will make the Curmudgeon more robust and able to handle flexible response formats while maintaining the same structured output interface.

## Acceptance Criteria
- Create `interpretCurmudgeonResponse` function in `src/protocol/interpreter.ts`
- Create `src/prompts/interpreter-curmudgeon.md` prompt file following existing interpreter patterns
- Replace rigid parsing logic in `src/agents/curmudgeon.ts` with interpreter call
- Curmudgeon can accept natural language responses without requiring VERDICT/REASONING/SUGGESTION format
- All existing Curmudgeon functionality preserved (verdict extraction, reasoning, suggestions)
- Implementation follows the established interpreter pattern used by other agents

## Steps

1. **Examine existing interpreter implementations**
   - Intent: Understand the natural language interpreter pattern used by other agents
   - Files: `src/protocol/interpreter.ts`, `src/prompts/interpreter-*.md`
   - Verification: Identify the common pattern for interpreter functions and prompt structure

2. **Analyze current Curmudgeon parsing logic**
   - Intent: Understand what data structures and parsing logic need to be replaced
   - Files: `src/agents/curmudgeon.ts`
   - Verification: Locate the VERDICT/REASONING/SUGGESTION parsing code and CurmudgeonResult interface

3. **Create Curmudgeon interpreter prompt**
   - Intent: Define the prompt that will guide interpretation of Curmudgeon responses
   - Files: `src/prompts/interpreter-curmudgeon.md`
   - Verification: Prompt clearly explains how to extract verdict ("approve"|"simplify"|"reject"), reasoning, and suggestions from natural language

4. **Implement interpretCurmudgeonResponse function**
   - Intent: Add the interpreter function that converts natural language to CurmudgeonResult
   - Files: `src/protocol/interpreter.ts`
   - Verification: Function returns proper CurmudgeonResult interface with verdict, reasoning, and suggestions fields

5. **Update Curmudgeon agent to use interpreter**
   - Intent: Replace string parsing with interpreter call in the agent implementation
   - Files: `src/agents/curmudgeon.ts`
   - Verification: Agent uses interpretCurmudgeonResponse instead of manual parsing, maintains same external interface

6. **Test the updated implementation**
   - Intent: Verify the Curmudgeon works with natural language responses
   - Files: Test with simple Curmudgeon calls
   - Verification: Run `DEBUG=true` test to confirm interpreter extracts correct verdict/reasoning/suggestions

## Risks & Rollbacks
- Risk: Interpreter may misinterpret natural language responses
- Rollback: Revert to original parsing logic if interpretation fails
- Mitigation: Use existing interpreter patterns proven to work with other agents

---
_Plan created after 2 iteration(s) with human feedback_

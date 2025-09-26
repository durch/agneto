Perfect! Now I have a comprehensive understanding of the current implementation. Let me create a plan to add the interpreter layer to Bean Counter.

# Add Interpreter Layer to Bean Counter for Robust Completion Detection

## Context
The Bean Counter agent currently uses fragile string matching in `parseChunkResponse()` to detect task completion, which causes false positives on partial words like 'complete' within 'completion'. This needs to be replaced with context-aware parsing using the established interpreter pattern already used by Coder and Reviewer agents.

## Acceptance Criteria
- Bean Counter completion detection eliminates false positives through context-aware interpretation
- All existing Bean Counter functionality preserved without changing public interface signatures
- Implementation follows exact same pattern as existing `interpretCoderResponse()` and `interpretReviewerResponse()` functions
- TypeScript compilation passes with no breaking changes to orchestrator integration

## Steps

1. **Add Bean Counter interpretation interface and function to interpreter.ts**
   - Intent: Define structured response format and interpretation function following established patterns
   - Files: `src/protocol/interpreter.ts`
   - Verification: Interface exported and function signature matches existing `interpretCoderResponse()` pattern
   - Add `BeanCounterInterpretation` interface with `type: "WORK_CHUNK" | "TASK_COMPLETE"` and other fields matching current `BeanCounterChunk`
   - Add `interpretBeanCounterResponse()` function following exact same structure as existing interpreter functions

2. **Create Bean Counter interpreter prompt**
   - Intent: Define interpretation keywords and examples for Sonnet to distinguish completion signals from partial words
   - Files: `src/prompts/interpreter-bean-counter.md`  
   - Verification: Prompt contains clear WORK_CHUNK vs TASK_COMPLETE distinction with examples of false positive cases
   - Follow exact format of `interpreter-coder.md` and `interpreter-reviewer.md` with specific keywords and examples

3. **Add Bean Counter keyword parsing function**
   - Intent: Convert interpreted keywords back to `BeanCounterChunk` format maintaining compatibility
   - Files: `src/protocol/interpreter.ts`
   - Verification: Function returns `BeanCounterChunk` matching current interface exactly
   - Add `parseBeanCounterKeywords()` function following pattern of existing `parseCoderKeywords()` and `parseReviewerKeywords()`

4. **Replace string matching in parseChunkResponse() with interpreter calls**
   - Intent: Replace fragile `includes('task complete')` logic with context-aware interpretation
   - Files: `src/agents/bean-counter.ts`
   - Verification: Function signature unchanged, still returns `BeanCounterChunk | null`, no compilation errors
   - Import and call `interpretBeanCounterResponse()` instead of direct string matching
   - Preserve all fallback logic and error handling behavior

5. **Integrate interpreter calls in getInitialChunk and getNextChunk functions**
   - Intent: Use interpreter-based parsing in both Bean Counter entry points
   - Files: `src/agents/bean-counter.ts` 
   - Verification: Both functions call updated `parseChunkResponse()`, maintain exact same return behavior
   - Update calls on lines 70 and 119 to use interpreter-enhanced `parseChunkResponse()`
   - Pass provider and cwd parameters needed for interpreter calls

6. **Verify TypeScript compilation and integration points**
   - Intent: Ensure no breaking changes to orchestrator or other consumers
   - Files: Check compilation and orchestrator integration
   - Verification: `npm run build` succeeds, orchestrator still receives expected `BeanCounterChunk` format
   - Run build command and verify all imports resolve correctly

## Risks & Rollbacks
- **Risk**: Interpreter calls could fail, making Bean Counter non-functional
- **Mitigation**: Preserve existing string matching as fallback in case interpreter fails
- **Rollback**: Revert `parseChunkResponse()` to original string matching implementation

---
_Plan created after 1 iteration(s) with human feedback_

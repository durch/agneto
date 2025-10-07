# Fix Curmudgeon Approval Loop with Interpreter Pattern

## Context

The Curmudgeon agent uses fragile keyword matching (`orchestrator.ts:688-697, 1264-1273`) to determine plan approval, causing infinite loops when approved plans are misinterpreted as needing simplification. Five other agents (Coder, Reviewer, BeanCounter, SuperReviewer, Refiner) use a robust interpreter pattern that reliably extracts structured verdicts from natural language responses. The Curmudgeon interpreter prompt already exists at `src/prompts/interpreter-curmudgeon.md` but is unused. This plan applies the proven interpreter pattern to Curmudgeon.

## Acceptance Criteria

- Curmudgeon responses are interpreted using stateless LLM interpreter (like other agents)
- Interpreter returns `{verdict: "APPROVE" | "SIMPLIFY" | "REJECT" | "NEEDS_HUMAN", feedback: string}`
- Orchestrator uses interpreter verdict instead of keyword matching for state transitions
- APPROVE verdict → EXECUTING state (no re-planning)
- SIMPLIFY verdict → PLANNING state with feedback
- REJECT verdict → appropriate rejection handling
- NEEDS_HUMAN verdict → user prompt for decision
- No infinite loops when Curmudgeon approves
- All existing tests pass

## Steps

### 1. Add Curmudgeon interpreter types
**Intent:** Define TypeScript types for Curmudgeon interpreter response  
**Files:** `src/protocol/types.ts`  
**Action:** Add `CurmudgeonInterpretation` interface with `verdict` and `feedback` fields matching existing interpreter response types  
**Verify:** `npm run build` succeeds, type follows pattern of `CoderInterpretation`, `ReviewerInterpretation`

### 2. Implement Curmudgeon interpreter function
**Intent:** Create stateless interpreter that extracts structured verdict from Curmudgeon's natural language response  
**Files:** `src/protocol/interpreter.ts`  
**Action:** Add `interpretCurmudgeonResponse(response: string): Promise<CurmudgeonInterpretation>` following exact pattern of `interpretCoderResponse` (~40 lines: load prompt from `interpreter-curmudgeon.md`, call Anthropic provider, parse JSON verdict)  
**Verify:** `npm run build` succeeds, function signature matches other interpreters, reads existing prompt file

### 3. Replace keyword matching in curmudgeonReview helper
**Intent:** Use interpreter verdict instead of keyword matching for feedback processing  
**Files:** `src/orchestrator-helpers.ts` (lines 688-697 in curmudgeonReview function)  
**Action:** 
- Import `interpretCurmudgeonResponse` from `src/protocol/interpreter.ts`
- Replace keyword matching logic with `const interpretation = await interpretCurmudgeonResponse(response)`
- Use `interpretation.verdict` to set `currentFeedback.type` field
- Keep `interpretation.feedback` for display purposes
**Verify:** Read modified code, confirm no keyword matching remains, verify returned feedback object structure unchanged

### 4. Replace keyword matching in orchestrator state handler
**Intent:** Use interpreter verdict for state transition logic  
**Files:** `src/orchestrator.ts` (lines 1264-1273 in TASK_CURMUDGEONING case)  
**Action:**
- Import `interpretCurmudgeonResponse` at top of file
- Replace keyword matching block with interpreter call
- Use `interpretation.verdict === "APPROVE"` instead of `curmudgeonFeedback.toLowerCase().includes('looks good')`
- Use `interpretation.verdict === "SIMPLIFY"` instead of checking for 'simplif' keyword
- Map REJECT and NEEDS_HUMAN verdicts appropriately
**Verify:** Read modified code, confirm interpreter verdict drives all state transitions, no string matching remains

### 5. Verify interpreter prompt defines verdicts correctly
**Intent:** Ensure existing prompt file instructs interpreter to return expected verdict keywords  
**Files:** `src/prompts/interpreter-curmudgeon.md`  
**Action:** Read file, confirm it defines APPROVE, SIMPLIFY, REJECT, NEEDS_HUMAN as verdict options and instructs JSON output format  
**Verify:** Prompt matches pattern of other interpreter prompts, verdict keywords align with orchestrator logic

### 6. Test approval flow
**Intent:** Verify approved plans proceed to execution without looping  
**Files:** None (runtime verification)  
**Action:** 
- Run `npm run build`
- Create simple test task that will get approved
- Observe Curmudgeon approval triggers EXECUTING state, not PLANNING
- Check no infinite loop occurs
**Verify:** Task completes without re-entering planning phase, state machine logs show CURMUDGEONING → EXECUTING transition

### 7. Test simplification flow
**Intent:** Verify plans needing simplification trigger re-planning correctly  
**Files:** None (runtime verification)  
**Action:**
- Create task with overly complex description that should trigger SIMPLIFY verdict
- Observe Curmudgeon simplification feedback triggers PLANNING state
- Verify feedback is preserved and displayed
**Verify:** State machine logs show CURMUDGEONING → PLANNING transition, feedback appears in UI

## Risks & Rollbacks

**Risk:** Interpreter misinterprets Curmudgeon responses  
**Mitigation:** Use proven interpreter pattern and existing prompt file; interpreter has high confidence based on 5 successful agent implementations  
**Rollback:** Revert changes to `interpreter.ts`, `orchestrator.ts`, `orchestrator-helpers.ts`; keyword matching logic preserved in git history

**Risk:** State transitions break due to verdict enum mismatches  
**Mitigation:** Step 5 verifies prompt defines exact verdict keywords used in orchestrator logic  
**Rollback:** Same as above

**Risk:** Performance degradation from additional LLM calls  
**Mitigation:** Interpreter calls are stateless and use fast Sonnet model (same as other 5 agents); negligible cost increase  
**Rollback:** N/A (performance impact acceptable based on existing agent interpreter usage)

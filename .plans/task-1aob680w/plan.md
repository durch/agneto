# Replace SuperReviewer String Parsing with Robust Interpreter Pattern

## Context
SuperReviewer currently uses fragile line-based string parsing in `src/agents/super-reviewer.ts:38-62` that fails when LLM response format varies, defaulting to "needs-human" with "No summary provided". The system has a proven interpreter pattern (`interpretCoderResponse`, `interpretReviewerResponse`, `interpretBeanCounterResponse`) using stateless Sonnet calls to reliably extract structured decisions from any natural language format.

## Acceptance Criteria
- SuperReviewer parsing failures eliminated
- Robust extraction of verdict ("approve" | "needs-human") and summary regardless of response format
- No change to SuperReviewer external interface or return type
- Follows exact same interpreter pattern as existing functions
- TypeScript compiles without breaking changes
- SuperReviewer no longer defaults to "needs-human" due to parsing issues

## Steps

1. **Add SuperReviewerInterpretation interface to interpreter.ts**
   - Intent: Define structure for interpreter output matching SuperReviewerResult
   - Files: `src/protocol/interpreter.ts`
   - Verify: Interface matches existing SuperReviewerResult fields (verdict, summary, issues)

2. **Create interpreter prompt file**
   - Intent: Define keywords for SuperReviewer response interpretation
   - Files: `src/prompts/interpreter-super-reviewer.md`
   - Verify: Contains APPROVE and NEEDS_HUMAN keywords matching SuperReviewer prompts

3. **Add interpretSuperReviewerResponse function**
   - Intent: Create stateless interpreter following exact pattern of existing functions
   - Files: `src/protocol/interpreter.ts`
   - Verify: Uses template loading, provider.query with sonnet model, error handling like others

4. **Add parseSuperReviewerKeywords helper function**
   - Intent: Parse interpreter keywords into SuperReviewerInterpretation structure
   - Files: `src/protocol/interpreter.ts`
   - Verify: Extracts verdict from keywords, preserves summary and issues from original response

5. **Replace string parsing in super-reviewer.ts**
   - Intent: Replace lines 38-62 with interpreter call and result mapping
   - Files: `src/agents/super-reviewer.ts`
   - Verify: Maintains same function signature, imports interpreter, handles null response

6. **Verify TypeScript compilation**
   - Intent: Ensure no breaking changes introduced
   - Files: All modified files
   - Verify: `npm run build` succeeds without errors

## Risks & Rollbacks
**Risk**: Interpreter adds latency to SuperReviewer calls
**Mitigation**: Sonnet calls are fast (~500ms), acceptable for final review step

**Risk**: Interpreter misinterprets nuanced SuperReviewer responses  
**Mitigation**: Keywords designed to match existing SuperReviewer prompt format, fallback to needs-human

**Rollback**: Git revert to restore original string parsing if critical issues emerge

---
_Plan created after 1 iteration(s) with human feedback_

# Implement Summarizer Agent for Coder/Reviewer Outputs

## Context

Agneto's Ink UI displays verbose Coder and Reviewer outputs that can overwhelm the interface. A stateless Summarizer agent will condense these outputs into 3-5 line actionable summaries for UI display, following the existing Scribe/Interpreter pattern. Full outputs are preserved - summaries are supplemental.

## Acceptance Criteria

- Two stateless summarizer functions (`summarizeCoderOutput`, `summarizeReviewerOutput`) in `src/agents/summarizer.ts` using fast Sonnet
- Prompt files (`src/prompts/summarizer-coder.md`, `src/prompts/summarizer-reviewer.md`) with clear extraction instructions
- ExecutionStateMachine extended with `coderSummary` and `reviewerSummary` fields
- Two unified methods: `setSummary(agent, summary)` and `getSummary(agent)` following existing `setAgentOutput` pattern
- Orchestrator calls summarizer after Coder/Reviewer responses and stores results
- Summaries are exactly 3-5 lines and actionable
- Full outputs remain unchanged

## Steps

**1. Research existing patterns**
- **Intent:** Understand Scribe/Interpreter structure and Anthropic provider usage
- **Files:** Read `src/agents/scribe.ts`, `src/agents/interpreter.ts`, `src/providers/anthropic.ts`
- **Verify:** Confirm Scribe uses `callWithPrompt`, takes input string, returns summary via fast Sonnet

**2. Create Coder summarization prompt**
- **Intent:** Define instructions for extracting key implementation details (files modified, approach, status)
- **Files:** Create `src/prompts/summarizer-coder.md`
- **Verify:** Prompt clearly requests 3-5 line summary format with: files touched, implementation approach, completion signal

**3. Create Reviewer summarization prompt**
- **Intent:** Define instructions for extracting review verdict and critical feedback
- **Files:** Create `src/prompts/summarizer-reviewer.md`
- **Verify:** Prompt clearly requests 3-5 line summary format with: verdict, key concerns, next action

**4. Implement summarizer functions**
- **Intent:** Create two stateless functions mirroring Scribe's structure
- **Files:** Create `src/agents/summarizer.ts` with `summarizeCoderOutput(output: string)` and `summarizeReviewerOutput(output: string)`
- **Verify:** Both functions use `callWithPrompt` with appropriate prompt paths, return string summaries, handle errors gracefully

**5. Extend ExecutionStateMachine interface**
- **Intent:** Add summary storage fields to execution context
- **Files:** Edit `src/state-machine.ts` - add `coderSummary?: string` and `reviewerSummary?: string` to context interface
- **Verify:** TypeScript compiles without errors after adding fields

**6. Add unified summary methods to ExecutionStateMachine**
- **Intent:** Provide two focused getter/setter methods following existing `setAgentOutput` pattern simplicity
- **Files:** Edit `src/state-machine.ts` - implement `setSummary(agent: 'coder' | 'reviewer', summary: string)` and `getSummary(agent: 'coder' | 'reviewer'): string | undefined`
- **Verify:** Methods correctly update/retrieve `this.context.coderSummary` or `this.context.reviewerSummary` based on agent parameter

**7. Integrate Coder summarization in orchestrator**
- **Intent:** Call summarizer after Coder responds and store result
- **Files:** Edit `src/orchestrator.ts` - find Coder response handling, call `summarizeCoderOutput(coderResponse)`, then `stateMachine.setSummary('coder', summary)`
- **Verify:** Grep for `setSummary('coder'` shows call exists; full Coder output still logged/processed unchanged

**8. Integrate Reviewer summarization in orchestrator**
- **Intent:** Call summarizer after Reviewer responds and store result
- **Files:** Edit `src/orchestrator.ts` - find Reviewer response handling, call `summarizeReviewerOutput(reviewerResponse)`, then `stateMachine.setSummary('reviewer', summary)`
- **Verify:** Grep for `setSummary('reviewer'` shows call exists; full Reviewer output still logged/processed unchanged

**9. Test with simple task**
- **Intent:** Verify summaries are generated and stored during execution
- **Files:** Run `npm start -- "add comment to README" --non-interactive`
- **Verify:** Check orchestrator logs show 3-5 line summaries for both Coder and Reviewer outputs; confirm full outputs remain intact in detailed logs

## Risks & Rollbacks

**Risk:** Summarizer produces incorrect or misleading summaries  
**Mitigation:** Summaries are supplemental only; full outputs always available  
**Rollback:** Remove summarizer calls from orchestrator; state machine changes are non-breaking

**Risk:** LLM calls add latency to execution flow  
**Mitigation:** Fast Sonnet model used; calls are async and non-blocking  
**Rollback:** Make summarization optional via environment variable

## Confidence Level

I'm confident this simplified approach is correct. The two-method pattern (`setSummary`/`getSummary`) matches the existing `setAgentOutput` simplicity while avoiding unnecessary API bloat. Concern: prompt engineering may need iteration to consistently hit 3-5 line target - recommend manual review of first few summaries.

---
_Plan created after 1 iteration(s) with human feedback_

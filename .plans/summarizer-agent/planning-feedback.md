# Planning Feedback History

Curmudgeon simplification request: Now I have a clear picture. Let me provide my curmudgeon verdict.

## My Verdict: **SIMPLIFY**

This plan is appropriately scoped but includes unnecessary complexity in state management.

### Core Issue: Four Separate Methods Are Excessive

The plan proposes:
- `getCoderSummary()`, `setCoderSummary()`, `getReviewerSummary()`, `setReviewerSummary()`

But the existing pattern (lines 150-169 in `state-machine.ts`) already shows a better approach:
```typescript
setAgentOutput(agent: 'bean' | 'coder' | 'reviewer', output: string)
getAgentOutput(agent: 'bean' | 'coder' | 'reviewer'): string | undefined
```

**Instead of four new methods, extend the existing pattern:**
- Rename parameter from `output` to `type: 'full' | 'summary'` 
- OR add separate methods: `setAgentSummary(agent, summary)` / `getAgentSummary(agent)`

This reduces boilerplate by 50% and maintains consistency with existing code.

### What Should Stay

**The good parts of this plan:**
- ✅ Two stateless summarizer functions (clean, follows Scribe pattern)
- ✅ Two prompt files (necessary - different summarization contexts)
- ✅ LLM-based summarization (smart extraction beats regex)
- ✅ Preserving full outputs (correct - summaries are supplemental)
- ✅ Fast Sonnet model (cost-efficient)

**What's right-sized:**
- 2 functions in `summarizer.ts`
- 2 prompt files
- ~50 lines of code (following Scribe's 27-line example)
- Integration at 2 orchestrator call sites

### Simplified Approach

**State Machine Changes (Option A - Simplest):**
```typescript
// Add to context interface:
coderSummary?: string;
reviewerSummary?: string;

// Add two focused methods (mirrors existing pattern simplicity):
setSummary(agent: 'coder' | 'reviewer', summary: string)
getSummary(agent: 'coder' | 'reviewer'): string | undefined
```

**State Machine Changes (Option B - Most Consistent):**
```typescript
// Extend existing getAgentOutput/setAgentOutput pattern:
setAgentOutput(agent: 'bean' | 'coder' | 'reviewer', output: string, summary?: string)
getAgentSummary(agent: 'bean' | 'coder' | 'reviewer'): string | undefined
```

Either approach cuts the API surface in half while maintaining clarity.

### Adjusted Steps

**Remove Step 6 bloat:**
- Don't create four separate methods
- Either extend the existing `setAgentOutput` pattern or add two unified methods

**Everything else is fine:**
- Steps 1-5: Perfect (research, prompts, implementation)
- Step 7-9: Good (integration and testing)

### Why This Matters

Four getters/setters for two fields violates DRY and creates unnecessary API surface. The codebase already demonstrates a cleaner pattern with `setAgentOutput(agent, ...)`. Follow it.

This is still a simple feature - just needs one small refinement to match existing patterns.

**Verdict: simplify** - Cut the four methods down to two (or extend existing pattern). Everything else is solid.
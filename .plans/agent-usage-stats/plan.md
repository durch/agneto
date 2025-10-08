# Display Per-Agent Usage Statistics with Token Counts at Task Completion

**Strategic Intent:** Aggregate and display comprehensive per-agent cost, token, and duration statistics when tasks complete.

## Context

Agneto orchestrates multiple agents that make calls to the Claude CLI. The provider already captures detailed usage statistics (`cost`, `duration`, `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`) in the result message but only passes `cost` and `duration` to the `onComplete` callback. We need to capture all metrics, accumulate them per agent across multiple calls, and display a formatted summary table at task completion.

## Acceptance Criteria

- [ ] `StreamCallbacks.onComplete` signature expanded to receive full token breakdown
- [ ] `TaskStateMachine` accumulates per-agent statistics: cost, duration, input tokens, cache creation tokens, cache read tokens, output tokens, call count
- [ ] After task completion (when `finalState === TaskState.TASK_COMPLETE`), display a colorful formatted table showing aggregated per-agent statistics
- [ ] Table appears in terminal after existing merge instructions
- [ ] `npm run build` compiles successfully
- [ ] Existing audit logging and state machine behavior unchanged

## Steps

### 1. Extend `StreamCallbacks.onComplete` signature to include token metrics

**Intent:** Capture full usage statistics from Claude CLI result messages instead of just cost and duration.

**Files:**
- `src/providers/index.ts` (StreamCallbacks interface at line 9)
- `src/providers/anthropic.ts` (query method around line 162 where result is parsed)

**Changes:**
- Add `tokens` parameter to `onComplete` callback: `{input: number, cacheCreation: number, cacheRead: number, output: number}`
- Extract token fields from result message's `usage` object
- Pass tokens object to `onComplete` alongside cost and duration

**Verification:** TypeScript compilation; check that `anthropic.ts` now passes token breakdown to callback

---

### 2. Add per-agent statistics accumulation to TaskStateMachine

**Intent:** Store and aggregate usage metrics across all agent calls during task execution.

**Files:**
- `src/task-state-machine.ts`

**Changes:**
- Add private field `agentStats: Map<string, {cost: number, duration: number, inputTokens: number, cacheCreationTokens: number, cacheReadTokens: number, outputTokens: number, calls: number}>`
- Add method `recordAgentUsage(agent: string, cost: number, duration: number, tokens: {input, cacheCreation, cacheRead, output})`
- Add getter `getAgentStats()` returning accumulated statistics

**Verification:** TypeScript compilation; grep for usage in next steps

---

### 3. Update all agent `onComplete` callbacks to pass token metrics

**Intent:** Flow token data from provider through agents to TaskStateMachine accumulator.

**Files:**
- `src/agents/planner.ts`
- `src/agents/curmudgeon.ts`
- `src/agents/beancounter.ts`
- `src/agents/coder.ts`
- `src/agents/reviewer.ts`
- `src/agents/superreviewer.ts`
- `src/agents/gardener.ts`
- `src/agents/refiner.ts`

**Changes:**
- Update `onComplete` callback signature to accept `tokens` parameter
- Call `stateMachine.recordAgentUsage(agentName, cost, duration, tokens)` in addition to `log.complete()`

**Verification:** TypeScript compilation; grep for `onComplete:` in all agent files

---

### 4. Create statistics display function in orchestrator-helpers

**Intent:** Format and output aggregated per-agent statistics table after task completion.

**Files:**
- `src/orchestrator-helpers.ts`

**Changes:**
- Add `logAgentStatistics(stateMachine: TaskStateMachine)` function
- Retrieve stats via `stateMachine.getAgentStats()`
- Format as table using chalk with columns: Agent | Cost | Input Tokens | Cache Creation | Cache Read | Output Tokens | Duration | Calls
- Include totals row
- Use colors consistent with existing log styling (e.g., cyan for headers, green for values)

**Verification:** Visual inspection of function; manual testing with output

---

### 5. Display statistics after task completion in orchestrator

**Intent:** Show usage summary in terminal after merge instructions when task completes.

**Files:**
- `src/orchestrator.ts` (around lines 1057 and 1514 where `logMergeInstructions` is called)

**Changes:**
- Call `logAgentStatistics(stateMachine)` after `logMergeInstructions()` in both locations
- Add blank line separator for readability

**Verification:** Run a task end-to-end; confirm statistics table appears after merge instructions; verify all token counts and costs are displayed

## Risks & Rollbacks

**Risk:** Breaking existing agent callbacks if signature change is incompatible.  
**Mitigation:** All agents updated atomically in step 3; TypeScript will catch missing parameters.

**Risk:** TaskStateMachine modifications affecting state transitions.  
**Mitigation:** New methods are additive only; no changes to existing state machine logic.

**Rollback:** Revert commits in reverse order: orchestrator display → helper function → agent callbacks → TaskStateMachine → provider signature.

## Confidence

Confident in approach. All changes are additive except the signature extension, which TypeScript will validate. Pattern follows existing `logMergeInstructions()` precedent.

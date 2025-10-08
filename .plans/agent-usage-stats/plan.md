# Display Per-Agent Usage Statistics After Task Completion

**Strategic Intent:** Aggregate and display per-agent cost/duration/token statistics in a formatted table after task completion.

---

## Context

Claude CLI returns rich metadata (`total_cost_usd`, `duration_ms`, token details) captured in `onComplete` callbacks at `src/providers/anthropic.ts:183`. Currently only logged at debug level. We'll aggregate this data in `TaskContext` and display it after UI exits, alongside merge instructions.

---

## Acceptance Criteria

- ✅ After task completes (success or partial), terminal displays a color-formatted table showing per-agent statistics (cost, duration, input/cache/output tokens)
- ✅ Statistics accumulate across multiple invocations of the same agent (e.g., three Planner calls → one row with summed values)
- ✅ Table appears in both interactive and non-interactive paths (after `logMergeInstructions()` at `orchestrator.ts:1057` and `1514`)
- ✅ Manual `chalk`-based formatting (no external table libraries)
- ✅ TypeScript compiles (`npm run build`)
- ✅ Existing debug logging unchanged
- ✅ Graceful handling if agent errors before `onComplete` fires (statistics show partial data)

---

## Steps

### 1. **Verify `onComplete` Signature**

*Intent:* Confirm actual callback parameters to avoid signature mismatches.

*Files:* `src/providers/anthropic.ts` (line 183)

*Actions:*
- Read `anthropic.ts:183` to verify `onComplete` receives `(cost, duration, tokens)`
- Verify `tokens` structure matches `{ input, cacheCreation, cacheRead, output }`

*Verification:*
```bash
npm run build  # Must compile
grep -A 2 "callbacks?.onComplete" src/providers/anthropic.ts  # Confirm signature
```

---

### 2. **Add Aggregation to TaskContext**

*Intent:* Store cumulative statistics per agent in shared state.

*Files:*
- `src/task-state-machine.ts` (~line 30 for `TaskContext` type, ~line 150 for methods)

*Actions:*
- Add to `TaskContext`:
  ```typescript
  agentUsageStats: Map<string, {
    cost: number;
    duration: number;
    inputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    outputTokens: number;
  }>;
  ```
- Initialize in constructor: `this.context.agentUsageStats = new Map()`
- Add method:
  ```typescript
  recordAgentUsage(
    agentName: string,
    cost: number,
    duration: number,
    tokens: { input: number; cacheCreation: number; cacheRead: number; output: number }
  ): void {
    const current = this.context.agentUsageStats.get(agentName) || {
      cost: 0, duration: 0, inputTokens: 0,
      cacheCreationTokens: 0, cacheReadTokens: 0, outputTokens: 0
    };
    current.cost += cost;
    current.duration += duration;
    current.inputTokens += tokens.input;
    current.cacheCreationTokens += tokens.cacheCreation;
    current.cacheReadTokens += tokens.cacheRead;
    current.outputTokens += tokens.output;
    this.context.agentUsageStats.set(agentName, current);
  }

  getAgentUsageStats() {
    return this.context.agentUsageStats;
  }
  ```

*Verification:*
```bash
npm run build  # Must compile
```

---

### 3. **Update Agent `onComplete` Callbacks**

*Intent:* Record usage in TaskStateMachine when provider completes.

*Files:*
- `src/agents/planner.ts` (~line 102)
- `src/agents/curmudgeon.ts` (~line 99)
- `src/agents/refiner.ts` (~line 75)
- `src/agents/bean-counter.ts` (~line 82)
- `src/agents/coder.ts` (~line 71)
- `src/agents/reviewer.ts` (~line 91)
- `src/agents/super-reviewer.ts` (~line 95)
- `src/agents/gardener.ts` (~line 107)

*Actions:*
For each file, update `onComplete` callback:
```typescript
// Before:
onComplete: (cost, duration) => log.complete("AgentName", cost, duration),

// After:
onComplete: (cost, duration, tokens) => {
  log.complete("AgentName", cost, duration);
  taskStateMachine.recordAgentUsage("AgentName", cost, duration, tokens);
},
```

*Note:* All agents except Gardener already receive `taskStateMachine` as parameter. For Gardener (`gardener.ts:107`), add `taskStateMachine: TaskStateMachine` to function signature and pass from `orchestrator.ts:1420`.

*Verification:*
```bash
npm run build  # Must compile
grep -n "recordAgentUsage" src/agents/*.ts  # Should show 8 calls
```

---

### 4. **Create Formatting Function**

*Intent:* Format statistics map into color table using existing `chalk`.

*Files:* `src/orchestrator-helpers.ts` (add after `logMergeInstructions`)

*Actions:*
Add function:
```typescript
export function logAgentUsageStats(
  stats: Map<string, { cost: number; duration: number; inputTokens: number; cacheCreationTokens: number; cacheReadTokens: number; outputTokens: number }>
): void {
  if (stats.size === 0) return;

  console.log(chalk.bold.cyan('\n📊 Agent Usage Statistics\n'));
  console.log(
    chalk.gray('Agent'.padEnd(18)) +
    chalk.yellow('Cost'.padEnd(12)) +
    chalk.blue('Duration'.padEnd(12)) +
    chalk.green('Input'.padEnd(10)) +
    chalk.magenta('Cache Cr'.padEnd(12)) +
    chalk.magenta('Cache Rd'.padEnd(12)) +
    chalk.cyan('Output'.padEnd(10))
  );
  console.log(chalk.gray('─'.repeat(90)));

  for (const [agent, data] of stats.entries()) {
    console.log(
      chalk.white(agent.padEnd(18)) +
      chalk.yellow(`$${data.cost.toFixed(4)}`.padEnd(12)) +
      chalk.blue(`${data.duration}ms`.padEnd(12)) +
      chalk.green(data.inputTokens.toString().padEnd(10)) +
      chalk.magenta(data.cacheCreationTokens.toString().padEnd(12)) +
      chalk.magenta(data.cacheReadTokens.toString().padEnd(12)) +
      chalk.cyan(data.outputTokens.toString().padEnd(10))
    );
  }

  const totals = Array.from(stats.values()).reduce(
    (acc, s) => ({
      cost: acc.cost + s.cost,
      duration: acc.duration + s.duration,
      inputTokens: acc.inputTokens + s.inputTokens,
      cacheCreationTokens: acc.cacheCreationTokens + s.cacheCreationTokens,
      cacheReadTokens: acc.cacheReadTokens + s.cacheReadTokens,
      outputTokens: acc.outputTokens + s.outputTokens
    }),
    { cost: 0, duration: 0, inputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, outputTokens: 0 }
  );

  console.log(chalk.gray('─'.repeat(90)));
  console.log(
    chalk.bold.white('Total'.padEnd(18)) +
    chalk.bold.yellow(`$${totals.cost.toFixed(4)}`.padEnd(12)) +
    chalk.bold.blue(`${totals.duration}ms`.padEnd(12)) +
    chalk.bold.green(totals.inputTokens.toString().padEnd(10)) +
    chalk.bold.magenta(totals.cacheCreationTokens.toString().padEnd(12)) +
    chalk.bold.magenta(totals.cacheReadTokens.toString().padEnd(12)) +
    chalk.bold.cyan(totals.outputTokens.toString().padEnd(10))
  );
  console.log();
}
```

*Verification:*
```bash
npm run build  # Must compile
```

---

### 5. **Display Statistics After Task Completion**

*Intent:* Call formatting function after UI exits in both completion paths.

*Files:* `src/orchestrator.ts` (lines 1057, 1514)

*Actions:*
```typescript
// Line 1057 (after logMergeInstructions in runTask):
logMergeInstructions(taskId, taskStateMachine.isMergeApproved());
logAgentUsageStats(taskStateMachine.getAgentUsageStats());

// Line 1514 (after logMergeInstructions in runRestoredTask):
logMergeInstructions(taskId, taskStateMachine.isMergeApproved());
logAgentUsageStats(taskStateMachine.getAgentUsageStats());
```

Import `logAgentUsageStats` from `orchestrator-helpers.ts` at top of file.

*Verification:*
```bash
npm run build
# Manual test:
make quick DESC="add comment to README.md"
# After completion, verify table displays with Refiner/Planner/Curmudgeon/BeanCounter/Coder/Reviewer/SuperReviewer rows
```

---

## Risks & Rollbacks

**Risk 1:** Agent errors before `onComplete` fires → partial statistics displayed  
*Mitigation:* Acceptable per requirements; table shows "best effort" data

**Risk 2:** Gardener signature change breaks orchestrator invocation  
*Mitigation:* Compiler will catch missing `taskStateMachine` parameter; fix at `orchestrator.ts:1420`

**Risk 3:** Token structure mismatch between provider and agents  
*Mitigation:* Step 1 verification catches this; adjust `recordAgentUsage` signature if needed

**Rollback:** Remove `agentUsageStats` from TaskContext, delete `logAgentUsageStats()`, revert agent callbacks to original two-parameter form.

---

**Confidence:** Concerned about Gardener integration (requires signature change at invocation site); otherwise confident.

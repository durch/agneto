# Strategic Intent

Enable project-specific, persistent prompt customizations for all 8 agent types via `.agneto.json` configuration without modifying source prompts.

---

# Extend .agneto.json for Agent Prompt Customization

## Context

Agneto loads agent prompts from static markdown files (`src/prompts/*.md`). Users need persistent, project-specific prompt customizations without modifying source files. The system already supports runtime injection (Ctrl+I), but that's single-use. This extends `.agneto.json` to support permanent, per-agent prompt additions using existing patterns from `sandbox.ts`.

## Acceptance Criteria

- `.agneto.json` accepts optional `prompts` object mapping agent names to custom instruction strings
- Custom prompts append to base prompts at runtime for all 8 agent types (planner, coder, reviewer, bean-counter, curmudgeon, super-reviewer, refiner, gardener)
- Missing/malformed config is handled gracefully (log warning, continue)
- Ctrl+I functionality remains independent and takes precedence
- System logs confirmation when config prompts are loaded
- Documentation updated with examples

## Steps

### 1. Extend type definition in `src/types.ts`
**Intent**: Add `prompts` field to existing `AgnetoConfig` interface (or create if missing)

**Files**: `src/types.ts`

**Details**:
- Add `prompts?: Record<string, string>` field to config interface
- Follows existing pattern for `filesToCopy` field

**Verify**: TypeScript compiles; interface includes new optional field

---

### 2. Add config loading helper in `src/orchestrator.ts`
**Intent**: Load agent prompts config at task initialization using existing `sandbox.ts` pattern

**Files**: `src/orchestrator.ts`

**Details**:
- Add inline `loadAgentPromptsConfig()` function after imports (lines ~20-40)
- Pattern: `fs.existsSync('.agneto.json')` → `readFileSync` → `JSON.parse` → validate `prompts` object
- Handle errors gracefully (try/catch, log warning, return undefined)
- Call immediately after `TaskStateMachine` creation (around line ~105)

**Verify**: Log output shows config loaded or warning if missing; no crashes on malformed JSON

---

### 3. Add config storage methods to `TaskStateMachine`
**Intent**: Store and retrieve agent-specific prompt additions

**Files**: `src/task-state-machine.ts`

**Details**:
- Add private field: `agentPromptsConfig?: Record<string, string>`
- Add method: `setAgentPromptsConfig(config: Record<string, string> | undefined)`
- Add method: `getAgentPromptConfig(agentName: string): string | undefined`
- No checkpoint serialization needed (loaded fresh each task)

**Verify**: Methods callable from orchestrator; getter returns undefined for missing agents

---

### 4. Integrate config prompts into `planner` agent
**Intent**: Append config-based prompt to system message before provider call

**Files**: `src/agents/planner.ts`

**Details**:
- After loading base prompt from markdown file (line ~30)
- Check `taskStateMachine?.getAgentPromptConfig?.('planner')`
- If present, append to system message: `\n\n## Project-Specific Instructions\n\n${configPrompt}`
- Log: `📝 Planner: Using project-specific prompt additions`

**Verify**: Grep `.agneto/` audit logs for config prompt content in system message

---

### 5. Integrate config prompts into remaining 7 agents
**Intent**: Apply same pattern to all other agent types

**Files**: 
- `src/agents/coder.ts`
- `src/agents/reviewer.ts`
- `src/agents/bean-counter.ts`
- `src/agents/curmudgeon.ts`
- `src/agents/super-reviewer.ts`
- `src/agents/refiner.ts`
- `src/agents/gardener.ts`

**Details**:
- Identical pattern to Step 4, using respective agent name
- Each agent checks `getAgentPromptConfig('{agent-name}')`
- Consistent log format: `{emoji} {AgentName}: Using project-specific prompt additions`

**Verify**: Run task with config; check audit logs show prompt additions for each agent called

---

### 6. Update documentation
**Intent**: Explain new `prompts` configuration option with examples

**Files**: 
- `CLAUDE.md` (section: "🔧 Environment Variables Reference" or new "Configuration" section)
- `.agneto.example.json` (add `prompts` field with commented examples)

**Details**:
- Explain structure: `{ "prompts": { "agent-name": "custom instructions" } }`
- Show example for 2-3 agents (e.g., planner, coder, reviewer)
- Note: Optional, agent names must match exactly, empty object is valid
- Clarify relationship with Ctrl+I (config is permanent, Ctrl+I is single-use)

**Verify**: Read docs; examples are clear and copy-pasteable

---

## Risks & Rollbacks

**Risk 1**: Config prompt conflicts with base prompts (contradictory instructions)
- Mitigation: Document that config appends, doesn't replace; users control content
- Rollback: Remove config entry from `.agneto.json`

**Risk 2**: Large config prompts exceed token limits
- Mitigation: System already handles token limits via provider
- Rollback: Reduce config prompt length

**Risk 3**: Invalid agent names in config silently ignored
- Mitigation: Log warnings for unrecognized agent names (not in Step 2, but should add)
- Rollback: Fix agent name spelling in config

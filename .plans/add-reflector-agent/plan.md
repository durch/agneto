# Add Reflector Agent as Post-SuperReviewer Documentation Hook

## Context

SuperReviewer already performs final quality checks. Rather than adding a full state machine state, implement Reflector as a lightweight documentation hook that runs immediately after SuperReviewer approval. This keeps the functionality non-blocking and architecturally appropriate for an optional documentation task.

## Acceptance Criteria

- Reflector agent exists at `src/agents/reflector.ts` with ReadFile/Edit/Write tools
- Reflector prompt at `src/prompts/reflector.md` provides documentation update instructions
- `documentTaskCompletion()` helper function in `src/orchestrator-helpers.ts` invokes Reflector
- Orchestrator calls `documentTaskCompletion()` after SuperReviewer approval (before TASK_FINALIZING transition)
- Reflector receives context as parameters (plan content, task description, SuperReviewer results) - no filesystem reading
- Failures are caught and logged but never block task completion
- CLAUDE.md structure and formatting preserved after updates

## Steps

1. **Create Reflector agent implementation**
   - Intent: Define agent that updates CLAUDE.md with task outcomes
   - Files: Create `src/agents/reflector.ts`
   - Actions: Export `runReflector()` function accepting (provider, workingDir, taskId, description, planContent, superReviewerResults)
   - Tools: Configure provider query with ReadFile, Edit, Write tools in default mode
   - Verification: Agent successfully reads CLAUDE.md, identifies update location, and applies edits

2. **Create Reflector prompt**
   - Intent: Instruct agent on documentation format and style
   - Files: Create `src/prompts/reflector.md`
   - Actions: Define instructions for reading CLAUDE.md structure, identifying appropriate section (likely "What Works Well" or a new "Recently Completed" section), formatting task summary, and preserving existing content
   - Verification: Prompt clearly specifies input format (task description, plan, review results) and output requirements (CLAUDE.md edits)

3. **Add orchestrator helper function**
   - Intent: Wrap Reflector invocation with error handling
   - Files: Modify `src/orchestrator-helpers.ts`
   - Actions: Create `documentTaskCompletion()` function that calls `runReflector()` with try/catch wrapper logging any errors
   - Verification: Helper function properly handles exceptions and returns gracefully on failure

4. **Integrate into orchestrator flow**
   - Intent: Call documentation hook after SuperReviewer approval
   - Files: Modify `src/orchestrator.ts` around lines 409-453 (TASK_SUPER_REVIEWING case)
   - Actions: After `verdict === "passed"` check and before `transitionTo(TaskState.TASK_FINALIZING)`, call `await documentTaskCompletion()` with plan content and SuperReviewer results
   - Verification: Orchestrator flow executes Reflector only on approval, continues to TASK_FINALIZING regardless of Reflector outcome

## Risks & Rollbacks

**Risks:**
- Reflector may misidentify update location in CLAUDE.md (mitigated by clear prompt instructions and Edit tool precision)
- Long-running documentation update delays task finalization (low risk - single file edit operation)
- Corrupted CLAUDE.md if edits fail mid-write (mitigated by Edit tool atomicity and ReadFile verification)

**Rollback:**
- Remove `documentTaskCompletion()` call from orchestrator
- Delete `src/agents/reflector.ts` and `src/prompts/reflector.md`
- CLAUDE.md reverts via git if corrupted

**Confidence:** High confidence in this simplified approach. By passing context as parameters and avoiding state machine changes, we reduce integration complexity significantly. The try/catch wrapper ensures task completion is never blocked. Main concern is prompt quality - Reflector must understand CLAUDE.md structure to insert updates appropriately.

---
_Plan created after 1 iteration(s) with human feedback_

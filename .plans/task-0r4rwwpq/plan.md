Based on my analysis of the current architecture and the Curmudgeon's feedback, I can see that the existing plan creates 15+ new files across multiple subdirectories for what should be a straightforward logging extension. Let me create a simplified plan that leverages the existing logging infrastructure more effectively.

# Simplified Audit Trail System Implementation Plan

## Context

Agneto has robust logging infrastructure (`src/ui/log.ts`) with phase tracking and agent-specific formatting, plus Anthropic provider metadata capture. Currently, all execution data is lost when worktrees are cleaned up. This plan extends the existing logging system to create a permanent `.agneto/` audit folder that survives worktree operations, providing compliance records and team learning data.

## Acceptance Criteria

- **Persistent audit data**: `.agneto/` folder survives worktree cleanup and merges to master
- **Complete execution record**: All agent interactions, decisions, and human interventions captured 
- **Human-readable format**: Simple markdown overview showing task flow and decisions
- **Queryable structure**: JSON audit log supporting analytics and debugging
- **Zero workflow disruption**: No changes to agent behavior or execution performance
- **Self-documenting**: Implementation generates example audit trail

## Steps

### 1. Create audit storage module extending existing log infrastructure
**Intent**: Add audit persistence to existing `log.ts` without changing its interface
**Files**: `src/audit/audit-logger.ts`
**Verify**: Existing log calls automatically generate audit entries in `.agneto/task-{id}/` folder

### 2. Modify LogUI class to emit audit events
**Intent**: Hook audit capture into existing log methods (`planner()`, `coder()`, `review()`, etc.)
**Files**: `src/ui/log.ts` (modify existing methods)
**Verify**: All console output also writes to audit files with timestamps and metadata

### 3. Capture provider metadata in audit trail
**Intent**: Record cost, duration, and session data from Anthropic provider calls
**Files**: `src/providers/anthropic.ts` (add audit hooks to existing `complete()` callbacks)
**Verify**: Audit includes session costs, timing, and model information for each agent interaction

### 4. Generate human-readable task summary
**Intent**: Create simple markdown overview from captured audit data
**Files**: `src/audit/summary-generator.ts`
**Verify**: `.agneto/task-{id}/overview.md` shows clear timeline of task execution with decisions

### 5. Create machine-readable audit JSON
**Intent**: Export structured data for analytics and debugging
**Files**: `src/audit/json-exporter.ts`
**Verify**: `.agneto/task-{id}/audit.json` contains queryable execution data

### 6. Preserve .agneto during git operations
**Intent**: Ensure audit data survives worktree cleanup and merges
**Files**: `src/git/sandbox.ts` (modify merge function to preserve `.agneto/`)
**Verify**: Audit data appears in master branch after task completion and worktree cleanup

## Risks & Rollbacks

**Performance Risk**: Audit writes slow down execution
- **Mitigation**: Asynchronous file writes, minimal memory usage
- **Rollback**: Environment variable `DISABLE_AUDIT=true` bypasses all audit logic

**Storage Risk**: `.agneto/` folders accumulate disk usage  
- **Mitigation**: Each task creates single folder, old tasks can be archived
- **Rollback**: Simple `rm -rf .agneto` removes all audit data

**Integration Risk**: Audit hooks break existing logging
- **Mitigation**: All audit code wrapped in try-catch blocks
- **Rollback**: Audit module is completely optional, system works without it

---
_Plan created after 1 iteration(s) with human feedback_

# Generate Task IDs Automatically

## Context
Currently users must provide an ID for each task, creating unnecessary friction. We'll modify the system to auto-generate valid git branch names when only a description is provided, while preserving backward compatibility for users who still want to specify their own IDs.

## Acceptance Criteria
- Users can run tasks with just a description (no ID required)
- Auto-generated IDs are valid git branch names
- Generated IDs are short and unique (e.g., "task-a3f2" or similar)
- Existing functionality with user-provided IDs still works
- CLI help text reflects the new optional ID parameter

## Steps

1. **Add ID generation utility function**
   - Intent: Create a helper to generate short, unique, git-safe IDs
   - Files: Create `src/utils/id-generator.ts`
   - Verify: Function generates valid branch names, no special chars, reasonably unique

2. **Update CLI argument parsing**
   - Intent: Make task ID optional, use description as first positional arg if only one provided
   - Files: `src/cli.ts`
   - Verify: `npm start -- "fix bug"` works, `npm start -- custom-id "fix bug"` still works

3. **Integrate ID generation in orchestrator**
   - Intent: Generate ID when not provided by user
   - Files: `src/orchestrator.ts`
   - Verify: Tasks create worktrees with generated IDs like `task-abc123`

4. **Update help text and examples**
   - Intent: Document the new usage pattern
   - Files: `src/cli.ts` (help section)
   - Verify: `npm start -- --help` shows ID as optional, examples use description-only format

5. **Test both usage patterns**
   - Intent: Ensure backward compatibility and new feature work
   - Files: None (manual testing)
   - Verify: Both `npm start -- "test"` and `npm start -- test-1 "test"` create appropriate worktrees

## Risks & Rollbacks
- Risk: ID collisions in generated names (mitigate with timestamp/random component)
- Risk: Breaking existing scripts that expect ID as first arg (maintain backward compatibility)
- Rollback: Git revert the changes, existing tasks unaffected since they're in worktrees

---
_Plan created after 1 iteration(s) with human feedback_

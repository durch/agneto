# Replace timestamp-based task IDs with LLM-generated meaningful names

## Context
Currently, task IDs are generated using `generateTaskId()` which creates random timestamp-based IDs like `task-a1b2c3d4`. We'll add a new function to generate meaningful 2-3 word kebab-case names using the existing Anthropic provider, with fallback to the current random ID generation.

## Acceptance Criteria
- Task names are meaningful 2-3 words in kebab-case format (e.g., `auth-login-fix`, `user-dashboard`)
- Generated names pass existing `isValidGitBranchName()` validation
- System gracefully falls back to timestamp IDs if LLM call fails
- CLI seamlessly uses new naming without breaking existing functionality
- Implementation follows existing provider patterns (like Scribe agent)

## Steps

1. **Add `generateTaskName()` function to existing `src/utils/id-generator.ts`**
   - **Intent**: Create LLM-powered naming function alongside existing ID generation
   - **Files**: `src/utils/id-generator.ts`
   - **Implementation**: Add async function that calls Anthropic provider with inline prompt, uses Sonnet model for efficiency, validates output with `isValidGitBranchName()`, falls back to `generateTaskId()` on any error
   - **Verification**: Function exists, accepts `(provider: LLMProvider, taskDescription: string)` parameters, returns Promise<string>

2. **Update CLI to use new naming function**
   - **Intent**: Replace direct `generateTaskId()` call with smart naming when provider is available
   - **Files**: `src/cli.ts` (around line 38)
   - **Implementation**: Import `generateTaskName`, pass provider and task description to new function, handle async call
   - **Verification**: CLI generates meaningful names for new tasks, still creates valid git branches

3. **Test the complete flow**
   - **Intent**: Verify naming works end-to-end and fallback is robust
   - **Files**: N/A (verification step)
   - **Implementation**: Run `npm start -- "fix authentication bug"` and verify meaningful name generation
   - **Verification**: Generated names are meaningful, git-safe, and system falls back gracefully on provider errors

## Risks & Rollbacks
- **Risk**: LLM naming fails or produces invalid names → **Mitigation**: Robust fallback to existing `generateTaskId()`
- **Risk**: Added async complexity in CLI → **Mitigation**: Proper error handling ensures CLI never crashes
- **Rollback**: Simply revert CLI change to call `generateTaskId()` directly

**Confidence Level**: High confidence this approach will work. The pattern exists in the Scribe agent, and keeping everything in the existing file structure minimizes complexity.

---
_Plan created after 1 iteration(s) with human feedback_

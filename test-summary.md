# Agneto Test Suite Summary

## Test Coverage

### ✅ Implemented Tests

1. **Provider Tests** (`test/providers/anthropic.test.ts`)
   - Real Claude CLI invocations
   - Session management testing
   - JSON output validation
   - Multiple permission modes
   - Error handling

2. **State Machine Tests**
   - `test/state-machines/coder-reviewer.test.ts` - CoderReviewerStateMachine logic
   - `test/state-machines/task-state.test.ts` - TaskStateMachine lifecycle

3. **Protocol Tests** (`test/protocol/schemas.test.ts`)
   - JSON schema validation
   - Coder response formats
   - Reviewer response formats
   - Real-world response validation

4. **Agent Integration Tests**
   - `test/agents/planner.integration.test.ts` - Real planning with Claude
   - `test/agents/coder.integration.test.ts` - Real code generation with Claude

5. **Git Operations Tests** (`test/git/worktrees.test.ts`)
   - Worktree creation and management
   - Branch isolation
   - Cleanup operations

6. **Test Fixtures**
   - Sample plans in `test/fixtures/plans/`
   - Sample repositories in `test/fixtures/repos/`

## Key Features

### Real Execution, Not Mocks
- **All Claude calls are real** - Tests use actual Claude CLI
- **Git operations are real** - Creates actual worktrees and branches
- **File operations are real** - Actually creates and modifies files
- **State transitions are real** - Uses production state machines

### What We Test (System Mechanics)
- ✅ Agents respond with valid JSON matching schemas
- ✅ State machines transition correctly
- ✅ Files get created/modified as expected
- ✅ Git worktrees provide proper isolation
- ✅ Sessions maintain continuity
- ✅ Error cases are handled gracefully

### What We DON'T Test (Solution Quality)
- ❌ Whether generated code is "good"
- ❌ Whether plans are optimal
- ❌ Whether implementations follow best practices
- ❌ Whether the code actually runs correctly

This aligns with the philosophy: **test that the system functions mechanically, not that it produces perfect solutions**.

## Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:providers    # Provider integration
npm run test:agents       # Agent integration
npm run test:git         # Git operations
npm run test:run         # Single run (no watch)

# Run with UI
npm run test:ui

# Watch mode for development
npm run test:watch
```

## Test Configuration

- **Timeout**: 30s default, 120s for complex operations
- **Retry**: 1 retry for flaky tests (Claude can timeout)
- **Sequential**: Tests run in sequence to avoid git conflicts
- **Verbose**: Detailed output for debugging

## Cost Considerations

Running the full test suite will make real Claude API calls. Each full run may cost:
- Provider tests: ~10-15 API calls
- Agent tests: ~20-30 API calls
- Estimated cost: $0.50-$1.00 per full run

## Next Steps for Enhancement

1. **Add Reviewer agent tests** - Test review verdicts with real Claude
2. **Add SuperReviewer tests** - Test final quality checks
3. **Add orchestrator integration test** - Test a mini end-to-end flow
4. **Add performance tracking** - Monitor test execution times
5. **Add cost tracking** - Track API usage per test run

## Test Philosophy

The test suite validates that Agneto's **mechanical operations work correctly**:
- Agents communicate using the right protocol
- State machines follow the right transitions
- Files end up in the right places
- Git operations maintain proper isolation

We explicitly avoid testing the **quality of AI outputs** because:
- Quality is subjective and context-dependent
- It would make tests brittle and unreliable
- The human-in-the-loop design handles quality concerns
- Focus should be on system reliability, not AI creativity
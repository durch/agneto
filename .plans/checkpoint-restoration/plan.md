# State Restoration Implementation Plan

## Context

I've analyzed the existing checkpoint system and state machine architecture. The `RestorationService` class has comprehensive validation and git state restoration capabilities, but the core state machine restoration methods are not yet implemented (marked with AIDEV-NOTE at line 464). The system uses a two-level state machine architecture with well-defined checkpoint data structures.

## Acceptance Criteria

- Task state machine restoration from checkpointed state and context
- Execution state machine restoration with proper state/context reconstruction  
- Bean Counter session restoration with progress tracking continuity
- Agent session restoration or reinitialization as needed
- Integration with orchestrator startup flow for restoration detection
- Comprehensive error handling with atomic rollback capabilities
- Backward compatibility with existing checkpoint format (version 1.0.0)

## Steps

1. **Implement core state machine restoration methods** - `src/audit/restoration-service.ts:464-474`
   - Intent: Add the four restoration methods marked as TODO in the AIDEV-NOTE
   - Files: `src/audit/restoration-service.ts` 
   - Verify: Methods exist and handle state machine restoration with proper error handling

2. **Add orchestrator startup restoration detection** - `src/orchestrator.ts:35-50`
   - Intent: Integrate restoration check into `runTask` function startup flow
   - Files: `src/orchestrator.ts`
   - Verify: Function checks for restorable checkpoints and offers restoration option before normal task execution

3. **Implement state machine restoration in TaskStateMachine class** - `src/task-state-machine.ts:111-129`
   - Intent: Add restoration method to reconstruct TaskStateMachine from checkpoint data
   - Files: `src/task-state-machine.ts`
   - Verify: Method restores state, context, and maintains proper state machine invariants

4. **Implement state machine restoration in CoderReviewerStateMachine class** - `src/state-machine.ts:88-101`
   - Intent: Add restoration method to reconstruct execution state machine from checkpoint data
   - Files: `src/state-machine.ts`
   - Verify: Method restores state, context, attempt counters, and progress tracking

5. **Add Bean Counter session restoration logic** - `src/agents/bean-counter.ts:8`
   - Intent: Enable Bean Counter to restore from checkpoint with preserved progress ledger
   - Files: `src/agents/bean-counter.ts`, potentially provider session management
   - Verify: Bean Counter can continue from checkpointed progress without losing context

6. **Add comprehensive restoration integration tests** - Create test file
   - Intent: Verify end-to-end restoration functionality with realistic checkpoint scenarios
   - Files: `test/restoration-integration.test.ts` (new file)
   - Verify: Tests cover all restoration paths, error conditions, and rollback scenarios

## Risks & Rollbacks

**Risks:**
- State machine restoration might not preserve all invariants correctly
- Session restoration could fail to maintain conversational context
- Git state restoration could conflict with concurrent changes

**Rollback strategy:**
- Each restoration method has atomic behavior with validation
- Failed restoration preserves original state and provides clear error messages
- Git operations use stash/restore pattern for safe state transitions
- Comprehensive validation prevents partial restoration states

**Confidence level:** I'm confident this approach will work. The existing validation and git restoration infrastructure is solid, and the state machine classes have well-defined state that can be reconstructed from the comprehensive checkpoint data. The main uncertainty is ensuring Bean Counter session continuity works properly with the provider system.

---
_Plan created after 1 iteration(s) with human feedback_

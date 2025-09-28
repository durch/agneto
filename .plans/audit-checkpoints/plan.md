# Audit Recovery Checkpoints Implementation Plan

## Context
The existing audit system captures agent interactions but lacks structured recovery checkpoints. This enhancement will create comprehensive state snapshots after each successful Bean Counter chunk completion, enabling task recovery and debugging without modifying the core LogUI system or agent interfaces.

## Acceptance Criteria
- Checkpoint files created after each successful chunk completion in `.agneto/task-{id}/checkpoints/`
- Checkpoints contain Bean Counter state, plan content, modified files, session metadata, and execution state
- Integration preserves existing audit functionality and maintains backwards compatibility
- System can be disabled via environment variable
- Checkpoints only generated on successful chunk approvals, not errors/retries
- Performance impact minimized during normal execution

## Steps

1. **Research existing audit and state management architecture**
   - **Intent**: Understand current audit system, Bean Counter state machine, and session management
   - **Files**: `src/audit/`, `src/state-machine.ts`, `src/task-state-machine.ts`, `src/orchestrator.ts`
   - **Verify**: Can explain current audit flow and identify integration points for checkpoints

2. **Examine Bean Counter session and progress tracking**
   - **Intent**: Understand how Bean Counter maintains progress ledger and coordinates chunks
   - **Files**: `src/agents/bean-counter.ts`, `src/orchestrator-helpers.ts`
   - **Verify**: Can identify successful chunk completion events and available state data

3. **Design checkpoint data structure and storage format**
   - **Intent**: Define comprehensive checkpoint schema that captures all necessary recovery state
   - **Files**: Create type definitions for checkpoint structure
   - **Verify**: Schema covers all acceptance criteria components and is serializable

4. **Implement checkpoint capture mechanism**
   - **Intent**: Create service to generate checkpoints after successful chunk approvals
   - **Files**: `src/audit/checkpoint-service.ts` (new)
   - **Verify**: Service can capture all required state data without modifying existing interfaces

5. **Integrate checkpoint triggers in orchestrator**
   - **Intent**: Hook checkpoint creation into successful chunk completion flow
   - **Files**: `src/orchestrator.ts`, potentially `src/state-machine.ts`
   - **Verify**: Checkpoints created only after successful Bean Counter chunk approvals

6. **Add checkpoint storage and file management**
   - **Intent**: Implement structured storage in `.agneto/task-{id}/checkpoints/` directory
   - **Files**: `src/audit/checkpoint-storage.ts` (new)
   - **Verify**: Checkpoints stored with proper naming and directory structure

7. **Add environment variable configuration**
   - **Intent**: Allow disabling checkpoint system similar to existing audit features
   - **Files**: Configuration/environment handling files
   - **Verify**: System respects disable flag and degrades gracefully

8. **Test checkpoint generation with actual task execution**
   - **Intent**: Verify checkpoints capture complete state during real Bean Counter cycles
   - **Files**: Test execution in worktree environment
   - **Verify**: Generated checkpoints contain all required data and are properly formatted

## Risks & Rollbacks
**Risks**: Performance impact from checkpoint I/O, potential race conditions with concurrent sessions, checkpoint storage consuming disk space
**Rollback**: Environment variable allows complete disabling; checkpoint service can be bypassed without affecting core functionality; file-based storage easily cleaned up

## Confidence Level
I'm moderately confident about this approach based on the existing audit architecture, but I need to examine the current Bean Counter state management and orchestrator integration points to ensure proper timing of checkpoint creation and complete state capture.

---
_Plan created after 1 iteration(s) with human feedback_

# Curmudgeon Agent Implementation Plan

## Title
Add Curmudgeon Agent as Simplicity Gatekeeper

## Context
Insert a new Curmudgeon agent between Planner and Bean Counter in the TaskStateMachine flow. The Curmudgeon will review plans for over-engineering and can request simplification up to 2 times before allowing the plan to proceed. This agent operates during the TASK_PLANNING state after plan creation but before transitioning to TASK_EXECUTING.

## Acceptance Criteria
- ✅ Curmudgeon reviews plan after successful creation in TASK_PLANNING state
- ✅ Returns 'proceed' or 'simplify' verdict with feedback
- ✅ Maximum 2 simplification attempts before proceeding regardless
- ✅ Integrates cleanly into existing TaskStateMachine transitions
- ✅ Works in both interactive and non-interactive modes
- ✅ Does not interfere with SuperReviewer retry cycles
- ✅ Clear logging shows Curmudgeon's verdict and simplification count

## Steps

1. **Create Curmudgeon agent module**
   - File: `src/agents/curmudgeon.ts`
   - Intent: Implement agent that reviews plans for over-engineering
   - Verify: File exists with `runCurmudgeon` function exported

2. **Create Curmudgeon prompt**
   - File: `src/prompts/curmudgeon.md`
   - Intent: Define prompt for reviewing plans with focus on simplicity
   - Verify: Prompt exists and contains simplicity criteria

3. **Add Curmudgeon types**
   - File: `src/types.ts`
   - Intent: Add `CurmudgeonVerdict` type and result interface
   - Verify: Types compile and include 'proceed' and 'simplify' verdicts

4. **Update TaskStateMachine for Curmudgeon state**
   - File: `src/task-state-machine.ts`
   - Intent: Add TASK_CURMUDGEONING state, events, and context tracking
   - Verify: State machine includes new state and simplification counter

5. **Integrate Curmudgeon into orchestrator flow**
   - File: `src/orchestrator.ts`
   - Intent: Add Curmudgeon review after plan creation, before Bean Counter
   - Verify: Curmudgeon executes after PLAN_CREATED event

6. **Add simplification loop handling**
   - Files: `src/orchestrator.ts`, `src/agents/planner.ts`
   - Intent: Pass Curmudgeon feedback to Planner for simplification
   - Verify: Plan regenerates with feedback, counter increments

7. **Test the implementation**
   - Intent: Verify Curmudgeon works end-to-end
   - Verify: `npm run build` succeeds, agent runs in test flow

## Risks & Rollbacks
- **Risk**: Breaking existing planning flow
  - Mitigation: Preserve all existing transitions, only intercept after PLAN_CREATED
- **Risk**: Infinite simplification loops
  - Mitigation: Hard limit of 2 simplification attempts
- **Rollback**: Remove Curmudgeon state from TaskStateMachine, revert orchestrator changes

---
_Plan created after 1 iteration(s) with human feedback_

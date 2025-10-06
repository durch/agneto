# Migrate CODE_REVIEW 'needs-human' Handler to CommandBus Pattern

## Context
The CODE_REVIEW state handler uses a legacy callback-based promise resolver for 'needs-human' verdicts. This migration aligns it with the CommandBus event-driven architecture already used in PLAN_REVIEW (line 1670) and SuperReviewer handlers. The change removes manual promise/resolver creation while preserving all existing decision logic, error handling, and state transitions.

## Acceptance Criteria
- [ ] Lines 1847-1868 (promise resolver setup) are completely removed
- [ ] Line 1867 replaced with `commandBus.waitForAnyCommand()` pattern matching line 1670
- [ ] All decision paths (approve/retry/reject) maintain identical behavior including commits, reverts, checkpoints
- [ ] Comment at lines 1863-1864 updated to reflect CommandBus instead of callback mechanism
- [ ] TypeScript compiles without errors
- [ ] Event-driven flow matches PLAN_REVIEW pattern exactly

## Steps

1. **Remove legacy promise resolver infrastructure (lines 1847-1862)**
   - Intent: Eliminate manual promise/resolver creation for callback-based interaction
   - File: `src/orchestrator.ts`
   - Delete: Lines 1847-1862 (entire promise creation and resolver variable declaration)
   - Verify: Code at line 1863 onwards has no references to `humanPromise` or `resolveHumanInput` variables; TypeScript compilation succeeds

2. **Update explanatory comment to reflect CommandBus pattern (lines 1863-1864)**
   - Intent: Clarify that UI interaction uses CommandBus instead of callback
   - File: `src/orchestrator.ts`
   - Change: Replace current comment with "// UI will detect needs-human state via stateMachine.getNeedsHumanReview() and send decision via CommandBus"
   - Verify: Comment accurately describes CommandBus event-driven flow

3. **Replace callback invocation with CommandBus wait (line 1867)**
   - Intent: Switch from callback-based to event-driven decision retrieval
   - File: `src/orchestrator.ts`
   - Delete: Line 1867 (`const codeDecision = await getHumanFeedback();`)
   - Add: `const codeDecision = await commandBus.waitForAnyCommand<HumanInteractionResult>(['humanreview:approve', 'humanreview:retry', 'humanreview:reject']);`
   - Verify: Pattern exactly matches line 1670 (PLAN_REVIEW); TypeScript type `HumanInteractionResult` is correctly inferred

4. **Remove callback creation and UI invocation (lines 1865-1866)**
   - Intent: Eliminate callback parameter passing to UI
   - File: `src/orchestrator.ts`
   - Delete: Lines 1865-1866 (entire `getHumanFeedback` callback function creation)
   - Verify: No remaining references to `getHumanFeedback` variable; decision logic at lines 1873-1908 unchanged

5. **Verify all decision paths remain intact (lines 1873-1908)**
   - Intent: Confirm approval/retry/reject logic preserved exactly
   - File: `src/orchestrator.ts`
   - Check: Lines 1873-1882 (approve + commit), 1897-1903 (retry), 1904-1908 (reject + revert) are unmodified
   - Check: Checkpoint creation logic (lines 1882-1895) intact
   - Check: Feedback combination logic preserved in all paths
   - Verify: Run `npm run build` to ensure TypeScript compilation succeeds without errors

## Risks & Rollbacks

**Risk**: CommandBus waitForAnyCommand might have different error handling than promise resolver  
**Mitigation**: Pattern proven in line 1670; no error handling changes needed  
**Rollback**: Revert commit; restore promise resolver pattern from lines 1847-1868

**Risk**: UI interaction timing could differ between callback and CommandBus  
**Mitigation**: Both patterns use same state flags (`getNeedsHumanReview()`); UI behavior unchanged  
**Rollback**: Git revert; previous callback-based flow fully functional

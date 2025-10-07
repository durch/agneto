# Migrate SuperReviewer Decision Handling to CommandBus Pattern

## Context

The SuperReviewer decision flow currently uses promise resolver callbacks passed through props (`onSuperReviewerDecision` → resolver function → callback). This pattern is deprecated in favor of the event-driven CommandBus architecture already used for plan approval. The CommandBus infrastructure is fully implemented with correct command types (`superreview:approve`, `superreview:retry`, `superreview:abandon`) and decision type (`SuperReviewerDecision`). This migration will standardize the approval flow architecture and remove manual rerender calls.

## Acceptance Criteria

- Orchestrator waits for SuperReviewer decisions via `commandBus.waitForCommand<SuperReviewerDecision>(...)` instead of promise resolver
- PlanningLayout sends decisions via `commandBus.sendCommand(...)` for approve/retry/abandon actions
- All callback-related code removed: `onSuperReviewerDecision` prop, `superReviewerResolver` state, `superReviewerCallback` function
- useEffect hook (lines 131-136) that wires callback removed from PlanningLayout
- Manual `inkInstance.rerender()` calls for SuperReviewer removed from orchestrator (lines 922-928, 937-942, 957-959)
- SuperReviewer decision menu works identically with arrow key navigation + Enter selection
- No changes to CommandBus command types or mapping (already correct)

## Steps

1. **Read orchestrator SuperReviewer implementation** (src/orchestrator.ts:909-960)
   - Intent: Understand current promise resolver pattern and identify exact code to replace
   - Files: `src/orchestrator.ts`
   - Verify: Confirm lines 912-920 create promise with resolver, lines 931-933 handle decision, lines 922-928/937-942/957-959 contain manual rerenders

2. **Read PlanningLayout SuperReviewer UI implementation** (src/ui/ink/components/PlanningLayout.tsx:58, 131-136, 752-783)
   - Intent: Understand callback wiring and menu interaction logic
   - Files: `src/ui/ink/components/PlanningLayout.tsx`
   - Verify: Confirm line 58 holds resolver state, lines 131-136 wire callback to state, lines 752-783 contain menu handlers

3. **Read plan approval CommandBus reference implementation** (orchestrator.ts:532, PlanningLayout.tsx:147-175)
   - Intent: Establish exact pattern to replicate for SuperReviewer migration
   - Files: `src/orchestrator.ts`, `src/ui/ink/components/PlanningLayout.tsx`
   - Verify: Understand how `waitForCommand` replaces promise, how `sendCommand` replaces callback invocation

4. **Replace orchestrator promise resolver with CommandBus.waitForCommand** (orchestrator.ts:909-960)
   - Intent: Replace promise creation and resolver callback with `commandBus.waitForCommand<SuperReviewerDecision>('superreview:approve')`
   - Files: `src/orchestrator.ts`
   - Changes:
     - Remove lines 912-920 (promise creation, `superReviewerResolverFunc`, `superReviewerCallback`)
     - Replace with: `const decision = await commandBus.waitForCommand<SuperReviewerDecision>('superreview:approve');`
     - Remove manual rerender calls at lines 922-928, 937-942, 957-959
   - Verify: Build passes (`npm run build`), logic reads as: await decision → switch on decision.action → handle approve/retry/abandon

5. **Replace PlanningLayout menu handlers with commandBus.sendCommand** (PlanningLayout.tsx:752-783)
   - Intent: Replace `superReviewerResolver()` invocations with `commandBus.sendCommand()` calls
   - Files: `src/ui/ink/components/PlanningLayout.tsx`
   - Changes:
     - In `handleSuperReviewerApprove`: Replace `superReviewerResolver({ action: 'approve' })` with `await commandBus.sendCommand({ type: 'superreview:approve', action: 'approve' })`
     - In `handleSuperReviewerRetry`: Replace `superReviewerResolver({ action: 'retry', feedback })` with `await commandBus.sendCommand({ type: 'superreview:retry', action: 'retry', feedback })`
     - In `handleSuperReviewerAbandon`: Replace `superReviewerResolver({ action: 'abandon' })` with `await commandBus.sendCommand({ type: 'superreview:abandon', action: 'abandon' })`
   - Verify: Build passes, handlers use `commandBus.sendCommand` not resolver function

6. **Remove superReviewerResolver state from PlanningLayout** (PlanningLayout.tsx:58)
   - Intent: Delete deprecated state now that CommandBus handles communication
   - Files: `src/ui/ink/components/PlanningLayout.tsx`
   - Changes: Remove line 58 `const [superReviewerResolver, setSuperReviewerResolver] = useState<...>`
   - Verify: Build passes, no references to `superReviewerResolver` or `setSuperReviewerResolver` remain in file

7. **Remove onSuperReviewerDecision prop wiring** (PlanningLayout.tsx:131-136)
   - Intent: Delete useEffect hook that wired callback to resolver state
   - Files: `src/ui/ink/components/PlanningLayout.tsx`
   - Changes: Remove lines 131-136 (entire useEffect block)
   - Verify: Build passes, no callback wiring logic remains

8. **Remove onSuperReviewerDecision from PlanningLayout interface** (PlanningLayout.tsx props)
   - Intent: Remove callback prop from component interface
   - Files: `src/ui/ink/components/PlanningLayout.tsx`
   - Changes: Remove `onSuperReviewerDecision` from Props interface definition
   - Verify: Build passes, interface no longer includes callback

9. **Remove onSuperReviewerDecision from App.tsx interface and prop passing** (App.tsx:19)
   - Intent: Remove callback prop from top-level component
   - Files: `src/ui/ink/App.tsx`
   - Changes:
     - Remove `onSuperReviewerDecision` from Props interface (line 19)
     - Remove prop passing to `<PlanningLayout onSuperReviewerDecision={...} />`
   - Verify: Build passes (`npm run build`), grep confirms no `onSuperReviewerDecision` references remain

10. **Verify CommandBus mapping is correct** (command-bus.ts:96-104, 160-168)
    - Intent: Confirm command types and decision type are correctly implemented (no changes needed)
    - Files: `src/ui/command-bus.ts`
    - Verify: Read lines 96-104 (command queue mapping), lines 160-168 (waitForCommand switch), confirm `superreview:approve`, `superreview:retry`, `superreview:abandon` handled correctly

11. **Final verification**
    - Intent: Ensure full migration with no remnants of old pattern
    - Commands:
      - `npm run build` - TypeScript compiles
      - `grep -r "superReviewerResolver" src/` - Returns no matches
      - `grep -r "superReviewerCallback" src/` - Returns no matches
      - `grep -r "onSuperReviewerDecision" src/` - Returns no matches
      - `grep -r "inkInstance.rerender" src/orchestrator.ts` - Confirm SuperReviewer-related rerenders removed (context search for lines 922-928, 937-942, 957-959)
    - Verify: All commands pass, no callback code remains, manual rerenders eliminated

## Risks & Rollbacks

**Risk**: CommandBus decision payloads might not match expected structure  
**Mitigation**: Command types already defined and mapped correctly in CommandBus; verify against `SuperReviewerDecision` interface  
**Rollback**: Revert orchestrator and PlanningLayout changes, restore promise resolver pattern

**Risk**: Manual rerender removal might cause UI staleness  
**Mitigation**: Event-driven architecture should auto-update via TaskStateMachine events (`superreview:complete`)  
**Rollback**: Restore manual rerender calls if UI doesn't update properly

**Confidence**: High. This is a direct replication of the proven plan approval migration pattern. CommandBus infrastructure is fully implemented and tested.

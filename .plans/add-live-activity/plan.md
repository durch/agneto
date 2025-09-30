# Add Live Activity Storage to TaskStateMachine

## Context

The TaskStateMachine already manages various task data (plan, refinement, feedback) with getter/setter patterns. We need to add similar storage for live agent activity messages that can be displayed in the Ink UI's Live Activity panel. This will enable real-time agent communication visibility during task execution.

## Research Findings

After examining the codebase:

- `TaskStateMachine` (task-state-machine.ts:71-112) uses `TaskContext` interface with properties like `planMd`, `planPath`, `pendingRefinement`, etc.
- Existing getters/setters follow pattern: `setPlan(planMd, planPath)`, `getPlanMd()`, `clearPendingRefinement()`
- `TaskContext` properties are directly accessed in checkpoint restoration (task-state-machine.ts:152-170)
- UI components (`PlanningLayout.tsx:115-125`) will read this data via prop-drilling from `App.tsx`

**Confidence level**: High. The pattern is clear and well-established in the existing code.

## Acceptance Criteria

- [ ] `TaskContext` interface has new `liveActivity` property with structure `{ agent: string; message: string } | null`
- [ ] `setLiveActivityMessage(agent: string, message: string)` method stores agent and message in context
- [ ] `getLiveActivity()` method returns current `{ agent: string; message: string } | null`
- [ ] `clearLiveActivity()` method sets `liveActivity` to `null`
- [ ] Methods follow existing naming conventions and patterns
- [ ] Checkpoint restoration handles `liveActivity` property gracefully (defaults to `null` if missing)

## Steps

1. **Update TaskContext interface to add liveActivity property**
   - **Intent**: Add storage for live agent messages
   - **Files**: `src/task-state-machine.ts` (lines 71-112)
   - **Action**: Add `liveActivity: { agent: string; message: string } | null;` property to `TaskContext` interface
   - **Verify**: TypeScript compilation succeeds without errors

2. **Initialize liveActivity to null in constructor**
   - **Intent**: Ensure property has default value when TaskStateMachine is created
   - **Files**: `src/task-state-machine.ts` (constructor, around line 118)
   - **Action**: Add `liveActivity: null` to `this.context` initialization object
   - **Verify**: TypeScript compilation succeeds; grep for "liveActivity: null" finds the initialization

3. **Add setLiveActivityMessage() method**
   - **Intent**: Allow orchestrator to store agent messages
   - **Files**: `src/task-state-machine.ts` (add after existing setter methods, around line 190)
   - **Action**: Create method `setLiveActivityMessage(agent: string, message: string): void { this.context.liveActivity = { agent, message }; }`
   - **Verify**: Method signature matches pattern of `setPlan()`, `setRefinedTask()`, etc.

4. **Add getLiveActivity() getter method**
   - **Intent**: Allow UI components to retrieve current live activity
   - **Files**: `src/task-state-machine.ts` (add after existing getter methods, around line 215)
   - **Action**: Create method `getLiveActivity(): { agent: string; message: string } | null { return this.context.liveActivity; }`
   - **Verify**: Method signature matches pattern of `getPlanMd()`, `getRefinedTask()`, etc.

5. **Add clearLiveActivity() method**
   - **Intent**: Allow clearing of live activity between phases or on completion
   - **Files**: `src/task-state-machine.ts` (add near other clear methods, around line 225)
   - **Action**: Create method `clearLiveActivity(): void { this.context.liveActivity = null; }`
   - **Verify**: Method signature matches pattern of `clearPendingRefinement()`

6. **Verify checkpoint restoration compatibility**
   - **Intent**: Ensure restored contexts handle missing liveActivity gracefully
   - **Files**: `src/task-state-machine.ts` (restoreFromCheckpoint method, lines 152-170)
   - **Action**: No changes needed - existing restoration already handles optional properties with destructuring
   - **Verify**: Grep for "restoreFromCheckpoint" and confirm it uses `this.context = { ...restored }` pattern that handles missing properties

## Risks & Rollbacks

**Risks**:
- Potential TypeScript errors if property type is incorrect
- Checkpoint restoration might fail if serialization doesn't handle nested object structure

**Rollback**:
- Remove added methods and `liveActivity` property from `TaskContext`
- Git revert is straightforward since changes are localized to one file

**Mitigation**:
- TypeScript compiler will catch type mismatches immediately
- Existing checkpoint system already handles complex nested objects (see `planPath`, `curmudgeonFeedback`)

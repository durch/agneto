**Strategic Intent:** Introduce parallel agent-specific injection storage in TaskStateMachine without altering existing single-injection behavior.

# Add Agent-Specific Injection Storage to TaskStateMachine

**Context:**  
TaskStateMachine currently maintains a single `pendingInjection` field for Ctrl+I dynamic prompt injection. This change introduces a parallel `Map<string, string>` storage layer for agent-specific injections as foundational infrastructure for future refactoring. The new Map and its methods operate independently of existing `pendingInjection` logic.

**Acceptance Criteria:**
- Private `agentInjections: Map<string, string>` field exists in TaskStateMachine
- Map initialized in constructor as empty Map
- `setAgentInjection(agent: string, content: string): void` stores injection for named agent
- `getAgentInjection(agent: string): string | undefined` retrieves injection for named agent
- `clearAgentInjection(agent: string): void` removes injection for named agent
- All three methods grouped near existing `pendingInjection` methods (lines 394-408)
- `npm run build` completes without errors
- Zero modifications to `pendingInjection` field or its four methods
- No changes outside `src/task-state-machine.ts`

**Steps:**

1. **Add private Map field**  
   *Intent:* Declare storage for agent-specific injections  
   *Files:* `src/task-state-machine.ts` (add field near line 150, alongside `pendingInjection`)  
   *Verification:* TypeScript compilation accepts new field declaration

2. **Initialize Map in constructor**  
   *Intent:* Ensure Map exists before any method calls  
   *Files:* `src/task-state-machine.ts` (constructor, likely around lines 160-180)  
   *Verification:* Constructor includes `this.agentInjections = new Map();` and compiles

3. **Implement `setAgentInjection` method**  
   *Intent:* Store injection content keyed by agent name  
   *Files:* `src/task-state-machine.ts` (add after line 408, near existing injection methods)  
   *Verification:* Method signature matches pattern; uses `Map.set(agent, content)`; compiles

4. **Implement `getAgentInjection` method**  
   *Intent:* Retrieve injection content for specified agent  
   *Files:* `src/task-state-machine.ts` (add after `setAgentInjection`)  
   *Verification:* Method returns `Map.get(agent)` with correct `string | undefined` type; compiles

5. **Implement `clearAgentInjection` method**  
   *Intent:* Remove injection for specified agent  
   *Files:* `src/task-state-machine.ts` (add after `getAgentInjection`)  
   *Verification:* Method uses `Map.delete(agent)`; compiles

6. **Verify compilation**  
   *Intent:* Confirm TypeScript accepts all changes  
   *Files:* entire codebase  
   *Verification:* `npm run build` exits 0 with no errors

**Risks & Rollbacks:**
- **Risk:** Accidental modification of `pendingInjection` logic  
  **Mitigation:** Changes isolated to new Map field and methods only; existing methods unchanged  
  **Rollback:** Revert commit removes new field and methods cleanly

- **Risk:** Type errors if Map not initialized  
  **Mitigation:** Constructor initialization ensures Map exists before use  
  **Rollback:** Compilation failure caught by step 6; easy revert

**Confidence:** Confident — scope is minimal, changes are additive-only, and verification is straightforward (compilation check).

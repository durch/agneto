# Add Task Refiner Agent

## Context
Users often provide incomplete or ambiguous task descriptions that lead to suboptimal plans. A Task Refiner agent can pre-process these descriptions to extract clear requirements, identify gaps, and structure the information before planning begins.

## Acceptance Criteria
- [ ] Task Refiner agent analyzes raw user input and identifies ambiguities
- [ ] Interactive refinement interface allows users to clarify missing information
- [ ] Refiner outputs structured specification with goal, context, constraints, and success criteria
- [ ] Orchestrator uses refined task specification for planning instead of raw input
- [ ] Existing flow remains functional if refinement is skipped or fails

## Steps

1. **Create Task Refiner agent module**
   - Intent: Establish the agent that analyzes and refines task descriptions
   - Files: Create `src/agents/refiner.ts`
   - Verify: File exists with exported `RefinerAgent` class containing `refine()` method

2. **Write Task Refiner prompt**
   - Intent: Define how the refiner should analyze tasks and identify gaps
   - Files: Create `src/prompts/refiner.md`
   - Verify: Prompt file exists with instructions for analyzing clarity, completeness, and outputting structured format

3. **Create refinement interface**
   - Intent: Enable interactive clarification of ambiguous requirements
   - Files: Create `src/ui/refinement-interface.ts`
   - Verify: Interface exports `interactiveRefinement()` function with options similar to planning interface

4. **Add refinement types**
   - Intent: Define TypeScript types for refined task structure
   - Files: Edit `src/types.ts`
   - Verify: `RefinedTask` type exists with goal, context, constraints, and successCriteria fields

5. **Integrate refiner into orchestrator**
   - Intent: Insert refinement step before planning
   - Files: Edit `src/orchestrator.ts`
   - Verify: Orchestrator calls refiner before planner, using refined output for planning

6. **Update CLI to handle refinement flow**
   - Intent: Pass refined task through the pipeline
   - Files: Edit `src/index.ts`
   - Verify: CLI passes task through refiner when available, falls back to raw input if refinement fails

7. **Test refinement with simple task**
   - Intent: Ensure refiner processes tasks and produces structured output
   - Files: TODO - Determine test approach (manual or automated)
   - Verify: Running `npm start -- test-refiner "vague task"` triggers refinement interface

## Risks & Rollbacks
- **Risk**: Refiner adds friction to simple tasks → Add bypass flag `--skip-refinement`
- **Risk**: Circular refinement loops → Limit refinement rounds to 3
- **Rollback**: Remove refiner calls from orchestrator, system continues with original flow

---
_Plan created after 1 iteration(s) with human feedback_

# Ink Terminal UI Foundation Implementation Plan

## Context

Establish foundational Ink terminal UI infrastructure with phase-aware layout switching for Agneto's orchestrator system. The existing system uses TaskState enum phases and has a console-based logging system in `src/ui/log.ts` with phase tracking capabilities. The CLI uses Commander.js with boolean options, and the orchestrator manages task execution flow through TaskStateMachine.

## Acceptance Criteria

- Package.json contains `ink` and `react` dependencies with appropriate versions
- Directory structure `src/ui/ink/` exists with organized components  
- CLI accepts `--ui ink` flag and defaults to classic console mode
- `App.tsx` component detects current phase from TaskStateMachine
- `PhaseLayout.tsx` renders different layouts for the three main phase groups:
  - Planning Layout (TASK_PLANNING, TASK_REFINING, TASK_CURMUDGEONING)
  - Execution Layout (TASK_EXECUTING)
  - Review Layout (TASK_SUPER_REVIEWING, TASK_FINALIZING)
- Proof of concept displays phase-appropriate content without breaking functionality
- TypeScript compilation succeeds with new Ink components
- Integration works with existing orchestrator events without requiring orchestrator changes

## Steps

1. **Add Ink dependencies to package.json**
   - Intent: Install required Ink React framework and related packages for terminal UI
   - Files: `package.json`
   - Verify: Check dependencies section contains `ink`, `react`, `@types/react` with compatible versions

2. **Create Ink UI directory structure**
   - Intent: Establish organized component structure following existing UI patterns
   - Files: `src/ui/ink/` directory with subdirectories
   - Verify: Directory exists with `components/`, `layouts/`, and root files

3. **Create core App.tsx component with phase detection**
   - Intent: Main Ink application entry point that integrates with existing TaskStateMachine
   - Files: `src/ui/ink/App.tsx`
   - Verify: Component imports TaskStateMachine, displays current phase, renders without errors

4. **Implement PhaseLayout.tsx with conditional rendering**
   - Intent: Phase-aware layout switcher that shows different UIs based on TaskState
   - Files: `src/ui/ink/components/PhaseLayout.tsx`
   - Verify: Component switches layouts correctly for each phase group, shows phase-specific content

5. **Create individual phase components**
   - Intent: Specific UI components for each phase group with placeholder content
   - Files: `src/ui/ink/components/PlanningLayout.tsx`, `ExecutionLayout.tsx`, `ReviewLayout.tsx`
   - Verify: Each component renders appropriate phase-specific text and layout

6. **Add --ui ink CLI option**
   - Intent: CLI flag to switch between classic console and Ink terminal UI modes
   - Files: `src/cli.ts`
   - Verify: Command accepts `--ui ink` option, defaults to classic mode, passes option to orchestrator

7. **Integrate Ink UI with orchestrator conditionally**
   - Intent: Modify orchestrator to use Ink UI when flag is set while preserving existing functionality
   - Files: `src/orchestrator.ts`
   - Verify: When `--ui ink` is used, Ink UI launches; otherwise classic logging continues unchanged

8. **Create TypeScript configuration for React JSX**
   - Intent: Ensure TypeScript can compile Ink React components correctly
   - Files: `tsconfig.json` (if modifications needed)
   - Verify: `npm run build` succeeds with no TypeScript errors for Ink components

## Risks & Rollbacks

**Risk**: Ink dependencies conflict with existing Node.js/TypeScript setup
- **Rollback**: Remove Ink dependencies from package.json, restore original dependencies

**Risk**: TSX/React compilation issues in existing TypeScript configuration  
- **Rollback**: Revert tsconfig.json changes, remove Ink components directory

**Risk**: CLI option breaks existing command parsing
- **Rollback**: Remove `--ui` option from CLI configuration, restore original CLI structure

**Risk**: Orchestrator integration interferes with existing logging/audit systems
- **Rollback**: Remove orchestrator modifications, keep existing log calls unchanged

**Confidence Level**: I'm confident about the approach based on existing code patterns, but I'm moderately concerned about potential TypeScript/React configuration issues that might require fine-tuning the TSConfig for JSX compilation.

---
_Plan created after 1 iteration(s) with human feedback_

# Dynamic Prompt Injection via Ctrl+I

## Context

Users need the ability to inject custom instructions during task execution without interrupting agent operations. This enables dynamic behavior adjustments for Planner, Bean Counter, Coder, Reviewer, and SuperReviewer agents by appending to their system prompts at runtime.

## Acceptance Criteria

- User presses Ctrl+I during any execution phase and pause request is registered
- Current agent operation completes before showing injection modal
- TextInputModal displays with current context (agent, phase, chunk info)
- User enters custom instructions via multi-line text input
- Injection is stored targeting next agent invocation only (simplified scope)
- When target agent runs, provider appends injection to system prompt as additional context
- Injection automatically clears after single use
- UI shows visual feedback: "🎯 Injection Pending" status indicator
- Pressing Ctrl+I while injection pending immediately shows modal (override pattern)
- Checkpoint system captures and restores injection state for recovery

## Steps

### 1. Add injection state to TaskStateMachine
**Intent:** Store pending injections and pause requests  
**Files:** `src/task-state-machine.ts`  
**Actions:**
- Add fields: `private injectionPauseRequested: boolean = false`, `private pendingInjection: string | null = null`
- Add methods: `requestInjectionPause()`, `isInjectionPauseRequested()`, `setPendingInjection(content: string)`, `getPendingInjection()`, `clearPendingInjection()`, `hasPendingInjection()`
- Add to checkpoint data structure in `createCheckpoint()` method
- Add to restoration logic in `static fromCheckpoint()` method

**Verify:** TypeScript compiles, methods return expected types, grep for checkpoint serialization includes new fields

### 2. Add injection pause check to orchestrator
**Intent:** Prevent starting new agent calls when injection pause is requested  
**Files:** `src/orchestrator.ts`  
**Actions:**
- Before each agent function call (planner, bean counter, coder, reviewer, super reviewer), check `taskStateMachine.isInjectionPauseRequested()`
- If true, break execution loop and allow UI to display injection modal
- After injection modal resolves, clear pause flag and resume execution

**Verify:** Add `DEBUG=true` logging at pause check points, grep for all agent call sites covered, test pause → modal → resume flow

### 3. Add global Ctrl+I keyboard handler to App.tsx
**Intent:** Capture injection shortcut without conflicts  
**Files:** `src/ui/ink/App.tsx`  
**Actions:**
- Add `useInput` hook listening for Ctrl+I keypresses (input.ctrl && input === 'i')
- On detection, call `taskStateMachine.requestInjectionPause()`
- Trigger re-render to propagate pause state to layouts

**Verify:** Press Ctrl+I during execution, check `isInjectionPauseRequested()` returns true, verify no conflict with Ctrl+Q/W/E/Escape/Enter shortcuts

### 4. Add injection modal state to PlanningLayout
**Intent:** Display injection form with context during planning/curmudgeon phases  
**Files:** `src/ui/ink/components/PlanningLayout.tsx`  
**Actions:**
- Add state: `const [showInjectionModal, setShowInjectionModal] = useState(false)`
- Add `useEffect` watching `taskStateMachine.isInjectionPauseRequested() && currentAgentComplete`
- When true, set `setShowInjectionModal(true)` and clear pause flag
- Render `<TextInputModal isOpen={showInjectionModal} onSubmit={handleInjectionSubmit} onCancel={handleInjectionCancel} />`
- Add context display: current state (PLANNING/CURMUDGEONING), agent type, task description

**Verify:** Pause during planning, modal appears with correct context, TextInputModal accepts input, onSubmit/onCancel callbacks fire

### 5. Add injection modal state to ExecutionLayout
**Intent:** Display injection form with context during execution phase  
**Files:** `src/ui/ink/components/ExecutionLayout.tsx`  
**Actions:**
- Add state: `const [showInjectionModal, setShowInjectionModal] = useState(false)`
- Add `useEffect` watching `taskStateMachine.isInjectionPauseRequested() && currentChunkComplete`
- When true, set `setShowInjectionModal(true)` and clear pause flag
- Render `<TextInputModal isOpen={showInjectionModal} onSubmit={handleInjectionSubmit} onCancel={handleInjectionCancel} />`
- Add context display: current chunk number, agent type (Bean Counter/Coder/Reviewer), chunk description

**Verify:** Pause during execution, modal appears with chunk context, input submission works, cancel clears modal

### 6. Thread TaskStateMachine to agent functions
**Intent:** Make injection state accessible to provider wrapper  
**Files:** `src/agents/planner.ts`, `src/agents/bean-counter.ts`, `src/agents/coder.ts`, `src/agents/reviewer.ts`, `src/agents/super-reviewer.ts`  
**Actions:**
- Add optional parameter: `taskStateMachine?: TaskStateMachine` to each agent's main function
- Pass through to `provider.query()` calls (existing parameter, new usage)

**Verify:** TypeScript compiles, grep for all `provider.query()` call sites accept optional taskStateMachine parameter, existing calls without parameter still work (backward compatibility)

### 7. Integrate injection into provider wrapper
**Intent:** Append pending injections to system prompts during agent calls  
**Files:** `src/providers/anthropic.ts`  
**Actions:**
- In `query()` method, check `stateMachine?.getPendingInjection?.()`
- If injection exists, append to systemPrompt with clear delimiter: `\n\n## Dynamic User Instruction\n\n${injection}\n\n`
- After appending, call `stateMachine?.clearPendingInjection?.()`
- Add debug logging showing injection application and auto-clear

**Verify:** Set injection, run agent, grep debug logs for "Dynamic User Instruction" in prompt, verify injection cleared after single use, test without injection (no errors)

### 8. Add visual feedback to PlanningLayout UI
**Intent:** Show injection status during planning phases  
**Files:** `src/ui/ink/components/PlanningLayout.tsx`  
**Actions:**
- Add status indicator component checking `taskStateMachine.hasPendingInjection()`
- Display: "🎯 Injection Pending (Next Agent)" when true
- Position below task description, above plan content

**Verify:** Set injection, check UI shows status, clear injection, status disappears, visual indicator does not break layout

### 9. Add visual feedback to ExecutionLayout UI
**Intent:** Show injection status during execution phases  
**Files:** `src/ui/ink/components/ExecutionLayout.tsx`  
**Actions:**
- Add status indicator component checking `taskStateMachine.hasPendingInjection()`
- Display: "🎯 Injection Pending (Next Agent)" when true
- Position in status bar next to current chunk info

**Verify:** Set injection, check UI shows status in execution layout, clear injection, status disappears, does not interfere with chunk progress display

### 10. Implement injection submission handlers
**Intent:** Store user-provided instructions in TaskStateMachine  
**Files:** `src/ui/ink/components/PlanningLayout.tsx`, `src/ui/ink/components/ExecutionLayout.tsx`  
**Actions:**
- In `handleInjectionSubmit(content: string)`, call `taskStateMachine.setPendingInjection(content)`
- Close modal: `setShowInjectionModal(false)`
- In `handleInjectionCancel()`, just close modal without storing: `setShowInjectionModal(false)`
- Trigger re-render to show status indicator

**Verify:** Submit injection via modal, check `getPendingInjection()` returns content, cancel modal, check no injection stored, verify TextInputModal API matches (onSubmit signature, onCancel callback)

### 11. Handle override pattern for pending injections
**Intent:** Allow Ctrl+I to override existing pending injection  
**Files:** `src/ui/ink/App.tsx`  
**Actions:**
- In Ctrl+I handler, check if `taskStateMachine.hasPendingInjection()` is already true
- If true, immediately show modal (skip waiting for agent completion)
- Modal submission overwrites previous injection via `setPendingInjection()`

**Verify:** Set injection, press Ctrl+I again before agent runs, modal appears immediately, new content replaces old, provider uses latest injection only

### 12. Verify checkpoint restoration includes injection state
**Intent:** Ensure task recovery preserves injection data  
**Files:** `src/task-state-machine.ts`  
**Actions:**
- Review `createCheckpoint()` serialization includes `injectionPauseRequested` and `pendingInjection`
- Review `fromCheckpoint()` restoration applies these fields
- Add test: create checkpoint with pending injection, restore, verify injection persists

**Verify:** Set injection, create checkpoint, restore from checkpoint, check `getPendingInjection()` returns original content, grep checkpoint JSON files contain injection fields

## Risks & Rollback

**Risk 1: TextInputModal API mismatch**  
Step 10 assumes `onSubmit(content: string)` and `onCancel()` signatures. If incorrect, check `src/ui/ink/components/TextInputModal.tsx` lines 8-9 for actual prop types and adjust handlers.

**Risk 2: Threading TaskStateMachine breaks existing agent calls**  
Step 6 makes parameter optional to maintain backward compatibility. If call sites break, verify optional parameter syntax: `taskStateMachine?: TaskStateMachine`.

**Risk 3: Checkpoint restoration doesn't apply injection fields**  
Step 12 verification catches this. If restoration fails, manually add field assignments in `fromCheckpoint()` method after line 642.

**Risk 4: Ctrl+I conflicts with terminal/shell shortcuts**  
Step 3 captures at App.tsx level. If terminal intercepts first, consider alternative shortcuts (Ctrl+Shift+I) or document terminal configuration requirements.

**Risk 5: Injection content contains special characters breaking prompt formatting**  
Step 7 delimiter pattern should handle this. If issues occur, sanitize injection content before appending (escape backticks, quotes).

**Rollback:** All changes are additive (new methods, new state fields). To rollback, remove Ctrl+I handler, revert provider wrapper injection logic, remove modal displays. Existing functionality unaffected.

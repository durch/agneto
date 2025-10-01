# Silent Mode for LogUI

## Context

LogUI currently writes to console/stdout unconditionally, causing visual conflicts when Ink UI is rendering. We need a runtime-toggleable silent mode to suppress console output when Ink manages the display, while preserving all other functionality.

## Acceptance Criteria

- LogUI has a `silent` boolean flag (default `false`) and toggle methods
- All `console.log` and `process.stdout.write` calls check the silent flag before outputting
- Orchestrator enables silent mode immediately after Ink UI renders successfully
- Orchestrator disables silent mode in non-interactive mode or when Ink UI is not used
- Existing behavior unchanged when silent mode is off
- Audit logging continues to function independently (uses direct file writes, not LogUI)

## Steps

### 1. Add silent mode flag and methods to LogUI
**Intent**: Create the core silent mode mechanism in LogUI  
**Files**: `src/ui/log.ts`  
**Actions**:
- Add private `silent: boolean = false` property to LogUI class
- Add `setSilent(value: boolean): void` method
- Add `isSilent(): boolean` getter method

**Verify**: Read `src/ui/log.ts`, confirm new property and methods exist

### 2. Wrap all console output with silent checks
**Intent**: Suppress console/stdout when silent mode is active  
**Files**: `src/ui/log.ts`  
**Actions**:
- Wrap every `console.log()` call: `if (!this.silent) { console.log(...) }`
- Wrap every `process.stdout.write()` call: `if (!this.silent) { process.stdout.write(...) }`
- Apply to all LogUI methods: `info()`, `error()`, `success()`, `agent()`, `phase()`, `progress()`, etc.

**Verify**: Grep for `console.log` and `process.stdout.write` in log.ts, confirm all calls are guarded by `!this.silent` check

### 3. Enable silent mode after Ink UI initialization
**Intent**: Activate silent mode when Ink UI takes over display  
**Files**: `src/orchestrator.ts`  
**Actions**:
- Locate the line `const inkInstance = render(<App ... />)` (in the `if (useInkUI)` block)
- Immediately after this line, add: `LogUI.setSilent(true);`
- Ensure this happens before any subsequent logging calls

**Verify**: Read orchestrator.ts, confirm `LogUI.setSilent(true)` appears immediately after `render()` call, inside the `if (useInkUI)` conditional

### 4. Ensure silent mode stays off in non-interactive mode
**Intent**: Preserve normal logging when Ink UI is not active  
**Files**: `src/orchestrator.ts`  
**Actions**:
- Locate the `if (!useInkUI)` or `if (nonInteractive)` branches
- Confirm no `setSilent(true)` calls exist in these paths
- Default `false` value already handles this, but verify no accidental enabling

**Verify**: Grep orchestrator.ts for `setSilent`, confirm only called in Ink UI path, not in non-interactive paths

### 5. Verify audit logging independence
**Intent**: Confirm audit system doesn't depend on LogUI console output  
**Files**: `src/audit/audit-logger.ts`  
**Actions**:
- Read audit-logger.ts implementation
- Confirm AuditLogger writes directly to files (via `fs.writeFileSync` or similar)
- Verify no dependencies on LogUI's `console.log` or `stdout.write` methods

**Verify**: Read audit-logger.ts, confirm it uses `fs` module for writes, not LogUI console methods

## Risks & Rollbacks

**Risk**: Silent mode breaks existing log filtering or redirects  
**Mitigation**: Silent flag defaults to `false`, existing behavior unchanged unless explicitly enabled

**Risk**: Orchestrator edge cases (Ink init failure) leave silent mode stuck on  
**Mitigation**: Silent mode only enabled after successful `render()`, failures skip the `setSilent(true)` call

**Rollback**: Remove silent flag, unwrap conditionals, delete `setSilent()` calls in orchestrator

## Confidence

High confidence. This is a simple boolean flag with conditional wrapping. The only assumption is that Ink UI's `render()` returns synchronously - if it throws, `setSilent(true)` never executes, preserving safe default behavior. No new dependencies, no complex state management, no event coordination.

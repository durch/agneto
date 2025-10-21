# Enable File-Based Task Descriptions via `--file` Flag

## Strategic Intent
Add a `--file` option to load task descriptions from markdown files while preserving all existing CLI invocation patterns.

## Context
The CLI currently accepts task descriptions as positional string arguments. Users need a way to provide complex, multi-line specifications from files. The implementation must integrate cleanly with Commander.js option parsing, existing ID/description logic, and all current flags (`--auto-merge`, `--non-interactive`, `--base-branch`). File loading patterns already exist in the codebase (orchestrator.ts uses `node:fs`).

## Acceptance Criteria
- `npm start -- --file spec.md` → auto-generated ID, file content as task description
- `npm start -- custom-id --file spec.md` → explicit ID, file content as task description
- Error cases handled with exit code 1:
  - File not found: `"Task file not found: <path>"`
  - File empty (after trim): `"Task file is empty: <path>"`
  - Conflicting input: both `--file` and positional description provided
- All existing options work with `--file`
- `npm run build` succeeds
- Help text documents `--file` usage with examples
- Backward compatibility: existing inline patterns unchanged

## Steps

### 1. Add `--file` option to Commander.js program definition
**Intent:** Register new option before argument parsing begins  
**Files:**
- `src/cli.ts` (lines 116-140, option definitions section)

**Changes:**
- Add `.option('--file <path>', 'Load task description from markdown file')` after existing options (around line 139)

**Verification:**
- `npm run build` succeeds
- No TypeScript errors

### 2. Implement file loading and validation helper
**Intent:** Encapsulate file read, error handling, and validation logic  
**Files:**
- `src/cli.ts` (new function near top of file, after imports)

**Changes:**
- Add function `loadTaskFile(filePath: string): string` using `node:fs`:
  - `readFileSync(filePath, 'utf-8')` with try/catch
  - Trim result and validate non-empty
  - Throw clear errors for: ENOENT (`Task file not found: ${filePath}`), empty content (`Task file is empty: ${filePath}`)
  - Return trimmed content on success

**Verification:**
- `npm run build` succeeds
- Function signature matches usage in next step

### 3. Integrate file loading into task parsing logic
**Intent:** Modify argument handling to support `--file` while preserving existing patterns  
**Files:**
- `src/cli.ts` (lines 141-156, task argument parsing block)

**Changes:**
- Extract `options.file` from parsed Commander options
- Add validation: if `options.file` and positional description both present → throw error: `"Cannot specify both --file and inline task description"`
- Modify logic (currently lines 141-156):
  - **If `options.file` provided:**
    - `taskDescription = loadTaskFile(options.file)`
    - `taskId = taskDescriptionOrId || generateTaskName(taskDescription)` (first arg becomes optional ID)
  - **Else:** keep existing inline logic unchanged
- Wrap file operations in try/catch; exit with code 1 on error (matching existing error handling pattern)

**Verification:**
- `npm run build` succeeds
- Logic paths clearly separated: file-based vs inline

### 4. Update help text with `--file` examples
**Intent:** Document new invocation patterns for users  
**Files:**
- `src/cli.ts` (lines 125-140, `.description()` and `.usage()` sections)

**Changes:**
- Add to existing examples:
  ```
  agneto --file task-spec.md
  agneto my-task --file task-spec.md
  agneto --file spec.md --auto-merge --non-interactive
  ```
- Add brief note: `"Task description can be provided inline or loaded from a file with --file"`

**Verification:**
- `npm run build` succeeds
- Help text readable: `npm start -- --help` (visual inspection)

### 5. Add Makefile convenience target (optional)
**Intent:** Provide ergonomic shorthand for file-based tasks  
**Files:**
- `Makefile` (inspect existing targets around lines 10-30 to match style)

**Changes:**
- Add target:
  ```makefile
  task-file:
  	@test -n "$(FILE)" || (echo "Usage: make task-file FILE=<path> [ID=<id>]" && exit 1)
  	npm start -- $(if $(ID),$(ID)) --file $(FILE)
  ```
- Add to `.PHONY` if present

**Verification:**
- `make task-file FILE=test.md` shows correct error/help if test.md missing
- `make task-file` without FILE shows usage message

## Risks & Rollbacks

**Risks:**
- **File path resolution ambiguity:** Commander.js resolves relative paths from CWD by default; if user runs from unexpected directory, file not found errors may surprise them  
  *Mitigation:* Error messages include full path attempted (`filePath` variable)

- **Encoding assumptions:** UTF-8 may not cover all user file encodings  
  *Mitigation:* Document in help text; UTF-8 covers 99% use cases; can extend later if needed

- **Conflicting input detection:** Logic could miss edge cases where both inline and file are "truthy"  
  *Mitigation:* Explicit validation check before any processing

**Rollback:**
- Changes isolated to `src/cli.ts` and `Makefile` (optional)
- Remove `--file` option definition, remove `loadTaskFile()`, revert task parsing block to original lines 141-156
- `npm run build` confirms clean state

## Confidence
**Confident** — Changes are localized, patterns already established in codebase, no new dependencies, clear integration points. Only uncertainty is whether "recover" mode mentioned in prior plan exists; if so, needs same file-loading treatment, but not found in current cli.ts audit.

**TODO for implementation:** Grep for "recover" or "recovery" in src/ to confirm whether this mode exists and needs updating.

# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript source. Key areas: `agents/` (agent logic), `ui/ink/` (CLI UI with Ink/React), `protocol/` (schemas), `providers/`, `git/`, `prompts/`, `utils/`, `dashboard/`.
- `test/`: Vitest specs (`**/*.test.ts`, `**/*.integration.test.ts`) plus fixtures.
- `dist/`: Compiled JS output (published via `bin` entry).
- `scripts/`: Task and release helpers. `.worktrees/` holds Git worktrees. `.agneto/` and `.plans/` track agent tasks and plans.

## Build, Test, and Development Commands
- `npm run build`: Compile TS to `dist/`, copy prompts, add shebang.
- `npm start`: Run the CLI from source (`src/cli.ts`).
- `npm run dashboard`: Start the dashboard server.
- `npm test` | `npm run test:watch` | `npm run test:ui`: Run Vitest (watch/UI variants).
- `make build` / `make test`: Convenience targets; `test` runs a build first.
- Task helpers: `make task ID="feature-x" DESC="what to do"`, `make quick DESC="non interactive"`, `make auto DESC="auto merge"`, `make merge ID=...`, `make cleanup ID=...`.

## Coding Style & Naming Conventions
- Language: TypeScript (ES2022, ESM, strict). JSX via `react-jsx` for Ink UI.
- Indentation: 2 spaces; filenames: kebab-case (e.g., `state-machine.ts`); React components: PascalCase.
- Exports: prefer named exports; group types in `types.ts`; use alias `@/...` for `src/...` paths.
- Keep modules cohesive (orchestrator, state machines, UI components, providers separated).

## Testing Guidelines
- Framework: Vitest (`environment: node`). Include patterns: `test/**/*.test.ts`, `test/**/*.integration.test.ts`.
- Naming: mirror source paths under `test/` (e.g., `test/state-machines/task-state.test.ts`).
- Running: `make test` for full run; target suites with `vitest test/git` or `vitest -t "keyword"`.
- Coverage: v8 configured (text/json/html). Keep tests deterministic (Git operations run sequentially).

## Commit & Pull Request Guidelines
- Commits: imperative mood, concise subject, optional scope prefix (e.g., `ui:`, `orchestrator:`). Example: `ui: improve planning layout focus`.
- Before PR: `make build` and `npm test` must pass; include updated `dist/` when applicable.
- PRs: clear description, linked issues, and screenshots/GIFs for Ink UI or dashboard changes.
- Note: Task flows create worktrees and files under `.agneto/` and `.plans/`; avoid manual edits—use `make` targets instead.


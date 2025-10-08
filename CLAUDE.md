Below is a tight, meaning‑preserving cheat sheet of **CLAUDE.md**.

---

## ⚠️ Golden rules

* **Before any change:** `npm run build` (TS must compile)
* **Use `DEBUG=true`** when anything looks off
* **Interactive by default** (you’ll be asked to approve plans)
* **All work in worktrees:** `.worktrees/<task-id>` (main is safe)
* **Check/rebase worktrees** (`git rebase master`) before continuing

## 🚀 Quick start

**Always:** `npm run build`
**Makefile (preferred):**
`make build` · `make task ID=… DESC=…` · `make merge ID=…` (auto‑merge/cleanup) · `make list` · `make check` · `make debug ID=… DESC=…` · `make quick DESC=…` (non‑interactive, auto ID) · `make auto DESC=…` (non‑interactive + auto‑merge) · `make continue ID=… DESC=…` · `make commit MSG=…` · `make status` · `make test` · `make provider`

## ⚙️ Config (`.agneto.json`)

* Optional, repo root.
* `prompts.{planner|curmudgeon|beancounter|coder|reviewer|superreviewer|gardener|refiner}` to tweak behaviors.
* Prompts inject into agent system prompts at task start and persist.
* One‑off edits during execution: **Ctrl+I** (dynamic injection).

## 🎯 How Agneto works

* Human‑in‑loop team of agents: **Refiner → Planner ↔ Curmudgeon → Bean Counter → Coder → Reviewer → SuperReviewer → Gardener** (+ **Scribe** for commits).
* **Key:** everything in isolated git worktrees.
* **Flow:** describe task → (optional refine) → plan → Curmudgeon simplification cycles → single user approval → chunk loop (Bean Counter/Coder/Reviewer) → SuperReviewer → Gardener → UI exits; terminal prints merge cmds. On retry: SuperReviewer feedback becomes the task; Planner focuses only on fixes.
* **Defaults:** interactive planning ON; runs all steps; manual merge after review; conservative reviewer may ask for human input.

## 🤖 Core principle: LLM‑first I/O

* **NEVER parse natural language programmatically.**
* Pattern: **Natural text → Stateless LLM Interpreter → JSON decision**.
* DO: communicate naturally; rely on interpreter.
* DON’T: regex/JSON‑required outputs/schemas/string scraping.

## 🔧 Common tasks

**Output legend:** Refiner/Planner/Bean Counter/Coder/Reviewer status lines show progress.
**Worktrees:**

```bash
git worktree list
cd .worktrees/<task-id>
git log --oneline -5
git diff master --stat
npm run build
npm run merge-task <task-id>    # merge + cleanup
npm run cleanup-task <task-id>  # cleanup only
```

## 📊 Audit & monitoring

* Logs agent comms, tools, phases; checkpoints; rich metadata.
* Stored under `.agneto/task-{id}/` (JSON events + `summary.md`).
* Review: `cat .agneto/task-{id}/summary.md`.

## 📱 Web dashboard

* Realtime stream (WebSocket), history, filters, cost/duration; in‑memory ≤1000 events/task.
* Start: `PORT=8080 npm run dashboard` then `AGNETO_DASHBOARD_ENDPOINT=http://localhost:8080 npm start -- "task"`
* Arch: EventEmitter → Express → WebSocket → Browser.

## 🔧 Env vars (key)

* Core: `DEBUG=false`, `LOG_LEVEL=info`.
* Audit: `DISABLE_AUDIT=false`, `DISABLE_CHECKPOINTS=false`, `MAX_CHECKPOINTS=10`, `CHECKPOINT_COMPRESSION=false`, `CHECKPOINT_NAMING=hybrid`.
* Dashboard: `AGNETO_DASHBOARD_ENDPOINT=http://localhost:3000`, `PORT=3000`.
* Push: `NTFY_TOPIC` (req’d), `NTFY_SERVER=https://ntfy.sh`.
  **Examples:**
  Debug: `DEBUG=true LOG_LEVEL=debug npm start -- "task"`
  CI: `DISABLE_AUDIT=true DISABLE_CHECKPOINTS=true npm start -- "task" --non-interactive`

## 🏗️ Architecture

* **Task state machine:** INIT → REFINING → PLANNING → CURMUDGEONING → EXECUTING → SUPER_REVIEWING → GARDENING → COMPLETE (exits UI, prints merge cmds).
* **Execution state machine:** BEAN_COUNTING → PLANNING → PLAN_REVIEW → IMPLEMENTING → CODE_REVIEW.
  
### Key files

| Area | File | Purpose |
| --- | --- | --- |
| Orchestrator | `src/orchestrator.ts` | Main control flow tying agents, state machines, UI |
| Orchestrator helpers | `src/orchestrator-helpers.ts` | Merge/cleanup helpers, commit/document utilities, usage stats display |
| Task state | `src/task-state-machine.ts` | High-level task lifecycle, command bus coordination |
| Execution state | `src/state-machine.ts` | Bean Counter ↔ Coder ↔ Reviewer loop management |
| Agents | `src/agents/` | Planner/Curmudgeon/BeanCounter/Coder/Reviewer/etc. implementations |
| Prompts | `src/prompts/` | Agent/system prompts injected at runtime |
| Provider | `src/providers/anthropic.ts` | Claude CLI wrapper, session/tool orchestration |
| Interpreter | `src/protocol/interpreter.ts` | Natural language → structured decision extraction |
| Audit | `src/audit/` | Logging, checkpointing, restoration services |
| Dashboard | `dashboard/`, `src/dashboard/` | Real-time monitoring server and event emitter |
| UI | `src/ui/` | Ink components, command bus, logging utilities |
| Git sandbox | `src/git/` | Worktree management and merge/cleanup helpers |
* **Data format:** agents speak natural language; interpreter outputs structured decisions for each agent type.

## 🧰 Provider & Claude CLI

* Headless Claude CLI; `--output-format json`.
* **plan mode** (read‑only): Planner/Curmudgeon/Refiner/Interpreter.
* **default mode** (tools): Coder (ReadFile/ListDir/Grep/Bash/Write/Edit/MultiEdit), Reviewer (ReadFile/Grep/Bash), SuperReviewer (ReadFile/Grep/Bash).
* Separate sessions per role; prompts injected once; metadata (cost/duration/session) captured and aggregated per agent in TaskContext.

## 🛠️ Development guide

* Add agent: create file, add prompt, integrate in orchestrator (follow existing patterns).
* Modify behavior: edit `src/prompts/<agent>.md`; test with `DEBUG=true`.
* **Never test by running full tasks.** Use:

```bash
npm run build
npx tsx src/agents/planner.ts
npx tsx test-provider.ts
npx tsx src/protocol/interpreter.ts
npm test [-- --grep "..."]
```

* Debug shows prompts, raw responses, command construction, formatting.

## 💡 Design philosophy

* **Worktrees** for isolation/review/cleanup.
* **Interactive planning** to refine and avoid waste.
* **Conservative reviewer** to protect quality.
* **Natural language → Interpreter** (no parsing failures).
* **Focused changes** (multi‑file ok; keep scope tight).

## 📊 Current state & gotchas

* Works well: interactive planning; auto Planner↔Curmudgeon loop + one user approval; safe sandbox; coordinated small chunks; retries; needs‑human flow; squash merge; comprehensive audit; live dashboard; terminal bell; env controls; NPX dist; state‑machine UIs; dynamic Ctrl+I injection; robust event‑driven flows; clean non‑interactive completion; responsive terminal panes; focused retry planning (SuperReviewer feedback becomes sole planning input, not full task replan); per‑agent usage statistics (cost/duration/tokens displayed in color table after task completion).
* Gotchas: Refiner Q&A max 3; role‑scoped sessions (Refiner/BeanCounter/Coder/Reviewer/SuperReviewer); Bean Counter owns chunking/memory; Coder executes only; small chunks preferred; interpreter adds low‑cost calls; **Ctrl+I** single‑use and cleared; injection modal shows immediately on keypress.

## 🖥️ Ink (terminal) UI

* UI created once; event‑driven via **TaskStateMachine (EventEmitter)** + **CommandBus**.
* Events: `state:changed`, `plan:ready`, `refinement:ready`, `question:asked`, `question:answering`, `superreview:complete`, `gardener:complete`, `execution:phase:changed`, `injection:pause:requested`.
* Commands: `refinement:approve/reject`, `plan:approve/reject`, `question:answer`, `superreview:approve/retry/abandon`, `merge:approve/skip`.
* Auto re‑render on events; common pitfalls: missing subscriptions/cleanup, stale props—read live state.
* Implementation checklist covers state getters/setters, event emits, CommandBus waits/sends, conditional rendering.
* **Ctrl+I injection:** pause → modal → stored → appended to next agent → auto‑clear; override by pressing again.

## 📦 NPX

```bash
npx agneto "fix authentication bug"
# or
npm i -g agneto && agneto "your task"
```

Repo: GitHub `durch/agneto` · NPM `agneto`.

## ✅ Remember

* **Be conservative.**
* **“needs‑human” is normal.**
* **Retries (3) are intentional.**
* **Worktrees keep main safe.**
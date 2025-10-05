# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with Agneto - an agentic development system.

## ⚠️ GOLDEN RULES - READ FIRST
1. **ALWAYS run `npm run build` before making any changes** - TypeScript must compile
3. **DEBUG=true is your friend** - Use it whenever something seems wrong
4. **Interactive mode is DEFAULT** - The system will ask for your input on plans
5. **Worktrees are isolated** - Changes happen in `.worktrees/<task-id>`, not main branch
6. **Check worktree state before continuing** - Old worktrees may be on outdated master
7. **Rebase worktrees when needed** - `git rebase master` to get latest fixes

## 🚀 Quick Start

### CRITICAL: Before Any Changes
```bash
npm run build  # ALWAYS verify TypeScript compiles first
```

### With the new Makefile (easier!)
```bash
make build     # Build TypeScript
make task ID=fix-1 DESC="fix the bug"  # Start a task
make merge ID=fix-1  # Auto-merge and cleanup (non-interactive!)
make list      # See all worktrees
make check     # System health check
make debug ID=fix-1 DESC="task"  # Run with debug output
make quick DESC="task"  # Non-interactive with auto-generated ID
make auto DESC="task"  # Non-interactive with auto-merge
make continue ID=fix-1 DESC="next steps"  # Continue existing task
make commit MSG="message"  # Commit with Claude Code attribution
make status    # Show git status
make test      # Run all tests
make provider  # Test Claude provider connection
```

## 🎯 How Agneto Works (Essential Understanding)

Agneto is a **human-in-the-loop AI development system** with seven main personas and one utility agent acting as an **Agile AI Development Team**:

1. **Task Refiner** → Pre-processes vague task descriptions (interactive mode only)
2. **Planner** → Creates high-level strategic plans from your task description
3. **Curmudgeon** → Reviews plans for over-engineering and unnecessary complexity (NEW!)
4. **Bean Counter** → "Scrum Master" - breaks plans into small chunks, tracks progress, coordinates sprints
5. **Coder** → Pure implementation executor - implements pre-defined chunks from Bean Counter
6. **Reviewer** → Validates chunk implementations against requirements
7. **SuperReviewer** → Final quality gate checking acceptance criteria and tests
8. **Gardener** → Maintaines CLAUDE.md
9. **Scribe** (utility) → Generates commit messages using fast Sonnet model

**Key Concept:** Everything happens in isolated git worktrees (`.worktrees/<task-id>`), so the main branch is never at risk.

### The Complete Flow (With Curmudgeon Gate)
```
You describe task → Task refinement (optional) → Planner generates plan →
Planner ↔ Curmudgeon cycles automatically (simplify if needed) →
Curmudgeon approves → Single user approval prompt →
Bean Counter: First chunk → Coder: Implements chunk → Reviewer: Approves →
Bean Counter: Next chunk → Coder: Implements → Reviewer: Approves → [repeat] →
Bean Counter: Task complete → SuperReviewer final check → Gardener updates docs →
Task complete! UI exits → Terminal shows merge commands → Manual review and merge
```

### Default Behavior (Important!)
- ✅ **Interactive planning ON** - You refine the plan before execution
- ✅ **Runs ALL steps** - Executes through Gardener automatically
- ✅ **Non-interactive completion** - UI exits after Gardener, logs merge commands to terminal
- ✅ **Manual merge** - Execute displayed commands after reviewing worktree
- ✅ **Conservative** - Reviewer often asks for human input

## 🤖 Core Principle: LLM-First Communication

**CRITICAL: Agneto is LLM-first by design. This is a fundamental architectural principle.**

### The Golden Rule of Agent Communication

**⚠️ NEVER attempt to parse natural language responses programmatically. This ALWAYS fails.**

Agneto uses **raw text/natural language as the ONLY reliable protocol** for all communication:
- Agent ↔ Agent communication
- Agent ↔ User communication
- Agent ↔ Orchestrator communication

### Why Parsing Always Fails

Attempts to implement parsers for natural language agent responses **fail without exception** because:
- LLMs produce varied response formats and styles
- Response structure changes based on context and prompt variations
- JSON extraction from natural language is inherently unreliable
- Schema validation errors cascade into system failures
- Regex and string pattern matching is brittle and breaks unexpectedly

### The Interpreter Pattern (Correct Approach)

Instead of parsing, Agneto uses a **stateless LLM interpreter**:

```
Agent Response (Natural Language) → Interpreter (LLM) → Structured Decision (JSON)
```

**Key Components:**
1. **Agents write natural language** - No format requirements, no JSON constraints
2. **Stateless interpreter extracts intent** - Fast Sonnet model understands and structures the response
3. **Orchestrator receives structured data** - Reliable decisions without parsing failures

### What This Means for Development

**DO:**
- ✅ Let agents communicate in natural, readable language
- ✅ Use LLM interpreter to extract structured decisions
- ✅ Trust the interpreter to handle format variations
- ✅ Keep prompts focused on natural communication

**DON'T:**
- ❌ Implement regex parsers for agent responses
- ❌ Require JSON output from agents
- ❌ Validate response formats with schemas
- ❌ Extract data with string manipulation
- ❌ Assume consistent response structure

### Example: Why This Works

**Agent says (natural language):**
> "I approve this implementation. The authentication logic is solid and follows best practices. Let's proceed to the next chunk."

**Interpreter extracts (structured):**
```json
{
  "verdict": "approve",
  "feedback": "The authentication logic is solid and follows best practices",
  "continueNext": true
}
```

No parsing required. No failures. Just reliable LLM-to-LLM communication.

## 🔧 Common Tasks

### Understanding the Output
```
🔍 Refiner: Clarifying question asked...      # Gathering missing information (if vague)
📝 Planner: Planning "your task"...           # Creating high-level plan
🧮 Bean Counter: Determining work chunk...    # Breaking down into small chunks
🤖 Coder: Proposing implementation...         # Planning how to implement chunk
👀 Reviewer: ✅ approve - correct approach     # Reviewing chunk implementation
🧮 Bean Counter: Next chunk - feature Y...    # Coordinating next sprint
🙋 Orchestrator: ✅ Change applied successfully # System applying changes
```

### Managing Worktrees
```bash
# See all worktrees
git worktree list

# After task completion, Agneto displays these commands:
# Review a worktree before merging
cd .worktrees/<task-id>
git log --oneline -5       # Recent commits
git diff master --stat      # Files changed
npm run build              # Verify it compiles

# Merge and auto-cleanup (non-interactive!)
npm run merge-task <task-id>

# Or cleanup without merging
npm run cleanup-task <task-id>
```

## 📊 Audit System & Task Monitoring

Agneto includes a comprehensive audit system that logs all agent interactions, providing detailed insights for debugging, compliance, and task analysis.

### Audit Features

- **Comprehensive Logging**: All agent communications, tool usage, and phase transitions captured
- **Persistent Storage**: Events stored in `.agneto/task-{id}/` directories
- **Checkpoint System**: State snapshots for recovery and restoration
- **Rich Metadata**: Cost tracking, duration metrics, and execution context
- **Human-Readable Output**: Both JSON events and markdown summaries generated
- **Non-Intrusive**: Zero changes to existing code - wraps LogUI transparently

### Audit Directory Structure

Every task creates an audit trail:
```
.agneto/task-{id}/
├── events/               # Individual JSON event files
│   ├── 1727462285785-uuid.json
│   └── ...
├── metadata.json         # Task metadata and summary
└── summary.md           # Human-readable execution summary
```

### Checkpoint & Recovery System

The audit system includes sophisticated checkpoint and recovery capabilities:

**Checkpoint Service**
- Captures comprehensive state snapshots during execution
- Includes agent session state, progress ledger, file modifications
- Configurable naming formats and compression
- Automatic cleanup of old checkpoints

**Recovery Service**
- Restores task execution from any checkpoint
- Filters and searches checkpoints efficiently
- Provides detailed recovery status reporting

**Restoration Service**
- Startup-only restoration from previous executions
- Preserves session continuity and progress state
- Graceful handling of corrupted or missing data

### Audit Event Types

The system captures:

- **Agent Messages**: All planner, coder, reviewer communications
- **Tool Usage**: ReadFile, Write, Edit, Bash command executions
- **Phase Transitions**: PLANNING → CODING → REVIEW cycles
- **Completion Metrics**: Cost, duration, success/failure status
- **Context Data**: Chunk numbers, sprint tracking, session IDs

### Usage Examples

**Review audit trail for a task:**
```bash
# View all events
ls .agneto/task-abc123/events/

# Read human-readable summary
cat .agneto/task-abc123/summary.md

# Check task metadata
cat .agneto/task-abc123/metadata.json
```

**Debug using audit data:**
```bash
# Find all coder events
grep -r "\"agent\": \"coder\"" .agneto/task-abc123/events/

# Check for errors
grep -r "error\|failed" .agneto/task-abc123/events/
```

## 📱 Web Dashboard Interface

Agneto includes a real-time web dashboard for monitoring task execution, providing a visual interface to track agent interactions and progress.

### Dashboard Features

- **Real-time Event Streaming**: Live updates as agents communicate and execute tasks
- **Task History**: Complete audit trail visualization with filtering and search
- **Agent Activity Monitoring**: See planner, coder, and reviewer interactions in real-time
- **Performance Metrics**: Cost tracking, duration analysis, and execution statistics
- **WebSocket Integration**: Instant updates without page refreshes
- **Event Storage**: In-memory storage for up to 1000 events per task
- **Cross-Platform**: Works in any modern web browser

### Dashboard Architecture

The dashboard integrates seamlessly with Agneto's audit system:

```
┌─────────────────┐    HTTP POST     ┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Agneto Task   │ ──────────────→ │ Dashboard Server│ ──────────────→ │  Web Interface  │
│   (EventEmitter)│    /events       │   (Express)     │   Real-time     │   (Browser)     │
└─────────────────┘                  └─────────────────┘                 └─────────────────┘
```

**Components:**
- **EventEmitter** (`src/dashboard/event-emitter.ts`): Sends audit events to dashboard
- **Express Server** (`dashboard/server.ts`): Receives events via HTTP, serves WebSocket
- **Web Interface** (`dashboard/public/`): Real-time visualization and controls

### Environment Configuration

```bash
# Set custom dashboard endpoint (default: http://localhost:3000)
AGNETO_DASHBOARD_ENDPOINT=http://localhost:8080 npm start -- "your task"

# Enable dashboard debug output
DEBUG=true npm run dashboard
```

### Dashboard API

The dashboard provides HTTP and WebSocket APIs:

**HTTP Endpoints:**
- `POST /events` - Receive audit events from EventEmitter
- `GET /tasks/{taskId}` - Retrieve task history and metadata
- `GET /` - Serve dashboard interface

**WebSocket Events:**
- `task_started` - New task execution began
- `agent_message` - Agent communication event
- `tool_usage` - Tool execution event
- `phase_transition` - Execution phase change
- `task_completed` - Task finished successfully

### Dashboard Benefits

1. **Real-time Monitoring**: See execution progress as it happens
2. **Visual Debugging**: Understand agent decision-making and tool usage
3. **Performance Analysis**: Track costs and execution times across tasks
4. **Team Collaboration**: Share task progress with stakeholders via web interface
5. **Historical Analysis**: Review past executions and identify patterns
6. **Compliance Visibility**: Real-time audit trail for regulatory requirements

## 🔧 Environment Variables Reference

Agneto supports various environment variables to control execution, debugging, and system behavior.

### Core System Variables

| Variable | Default | Description | Example |
|----------|---------|-------------|---------|
| `DEBUG` | `false` | Enable verbose debugging output showing prompts, responses, and command construction | `DEBUG=true npm start` |
| `LOG_LEVEL` | `info` | Control logging verbosity (`debug`, `info`, `warn`, `error`) | `LOG_LEVEL=debug npm start` |

### Audit System Variables

| Variable | Default | Description | Example |
|----------|---------|-------------|---------|
| `DISABLE_AUDIT` | `false` | Disable all audit logging and event capture | `DISABLE_AUDIT=true npm start` |
| `DISABLE_CHECKPOINTS` | `false` | Disable checkpoint creation during execution | `DISABLE_CHECKPOINTS=true npm start` |
| `MAX_CHECKPOINTS` | `10` | Maximum number of checkpoints to retain per task | `MAX_CHECKPOINTS=5 npm start` |
| `CHECKPOINT_COMPRESSION` | `false` | Enable compression for checkpoint files | `CHECKPOINT_COMPRESSION=true npm start` |
| `CHECKPOINT_NAMING` | `hybrid` | Checkpoint naming format (`hybrid`, `timestamp`, `sequential`) | `CHECKPOINT_NAMING=timestamp npm start` |

### Dashboard Integration Variables

| Variable | Default | Description | Example |
|----------|---------|-------------|---------|
| `AGNETO_DASHBOARD_ENDPOINT` | `http://localhost:3000` | Dashboard server endpoint for event streaming | `AGNETO_DASHBOARD_ENDPOINT=http://localhost:8080 npm start` |
| `PORT` | `3000` | Dashboard server port (when running dashboard) | `PORT=8080 npm run dashboard` |

### Push Notification Variables

| Variable | Default | Description | Example |
|----------|---------|-------------|---------|
| `NTFY_TOPIC` | (required) | The ntfy topic to send push notifications to when tasks complete or require human input | `NTFY_TOPIC=agneto-alerts npm start` |
| `NTFY_SERVER` | `https://ntfy.sh` | Custom ntfy server URL for sending notifications | `NTFY_SERVER=https://my-ntfy.com npm start` |

### Usage Examples

**Full debugging setup:**
```bash
# Maximum verbosity with all debugging enabled
DEBUG=true LOG_LEVEL=debug npm start -- "debug task" --non-interactive
```

**Minimal setup for CI/CD:**
```bash
# Disable all extra features for clean CI runs
DISABLE_AUDIT=true DISABLE_CHECKPOINTS=true npm start -- "ci task" --non-interactive
```

**Development with dashboard:**
```bash
# Terminal 1: Start dashboard with custom port
PORT=8080 npm run dashboard

# Terminal 2: Run task with dashboard integration
AGNETO_DASHBOARD_ENDPOINT=http://localhost:8080 DEBUG=true npm start -- "development task"
```

**Checkpoint management:**
```bash
# Keep only 3 checkpoints with compression enabled
MAX_CHECKPOINTS=3 CHECKPOINT_COMPRESSION=true npm start -- "large task"
```

**Production deployment:**
```bash
# Production-ready configuration
LOG_LEVEL=warn MAX_CHECKPOINTS=5 CHECKPOINT_COMPRESSION=true npm start -- "production task" --non-interactive
```

**Push notifications setup:**
```bash
# Enable ntfy notifications for task completion and human review prompts
NTFY_TOPIC=my-agneto-alerts npm start -- "important task"

# With custom ntfy server
NTFY_TOPIC=agneto-team NTFY_SERVER=https://ntfy.company.com npm start -- "team task"
```

### Variable Precedence

Environment variables can be set in multiple ways:

1. **Command line** (highest precedence): `DEBUG=true npm start`
2. **Shell export**: `export DEBUG=true && npm start`
3. **`.envrc` file** (if using direnv): `echo "export DEBUG=true" > .envrc`
4. **System defaults** (lowest precedence): Built-in defaults

## 🏗️ Architecture Reference

### State Machine Architecture

Agneto uses a two-level state machine architecture:

1. **Task State Machine** (`task-state-machine.ts`):
   - Manages the overall task lifecycle
   - States: INIT → REFINING → PLANNING → CURMUDGEONING → EXECUTING → SUPER_REVIEWING → GARDENING → COMPLETE
   - Handles high-level task flow and agent coordination
   - COMPLETE state triggers UI exit and merge command display (no interactive merge approval)

2. **Execution State Machine** (`state-machine.ts`):
   - Manages the Bean Counter/Coder/Reviewer loop
   - States: BEAN_COUNTING → PLANNING → PLAN_REVIEW → IMPLEMENTING → CODE_REVIEW
   - Handles chunk-by-chunk implementation cycles

### Key Files to Know

| File | Purpose | Modify when... |
|------|---------|----------------|
| **Core Orchestration** |
| `src/orchestrator.ts` | Main control flow | Changing the task flow |
| `src/orchestrator-helpers.ts` | Helper functions for orchestration | Utility functions |
| `src/state-machine.ts` | Bean Counter execution state machine | Chunk execution flow |
| `src/task-state-machine.ts` | Parent task state machine | Overall task lifecycle; stores injection state for Ctrl+I prompt modifications |
| **Agents** |
| `src/agents/planner.ts` | High-level planning logic | Improving strategic plan generation |
| `src/agents/bean-counter.ts` | Work chunking & progress tracking | Adjusting chunking strategy |
| `src/agents/coder.ts` | Implementation execution | Changing implementation logic |
| `src/agents/reviewer.ts` | Review logic | Adjusting approval criteria |
| `src/agents/curmudgeon.ts` | Plan simplification logic | Preventing over-engineering |
| `src/agents/super-reviewer.ts` | Final quality gate | Changing acceptance criteria |
| `src/agents/refiner.ts` | Task description refinement | Pre-processing vague descriptions |
| `src/agents/scribe.ts` | Commit message generation | Auto-generating commits |
| **Protocol & Communication** |
| `src/providers/anthropic.ts` | Claude CLI integration | Fixing LLM communication |
| `src/protocol/interpreter.ts` | Natural language interpreter | Changing response interpretation |
| `src/protocol/schemas.ts` | JSON schemas (still used for validation) | Schema definitions |
| `src/protocol/validators.ts` | Input validation | Validation logic |
| `src/protocol/prompt-template.ts` | Template rendering | Changing prompt injection |
| `src/prompts/interpreter-*.md` | Interpreter prompts | Improving response interpretation |
| `src/prompts/*.md` | Agent instructions | Improving agent behavior |
| **Audit & Monitoring System** |
| `src/audit/audit-logger.ts` | Main audit logging implementation | Capturing agent interactions |
| `src/audit/checkpoint-service.ts` | State snapshot creation | Task recovery capabilities |
| `src/audit/recovery-service.ts` | Checkpoint restoration | Recovery from failures |
| `src/audit/restoration-service.ts` | Startup restoration | Session continuity |
| `src/audit/summary-generator.ts` | Human-readable summaries | Report generation |
| `src/audit/json-exporter.ts` | Structured data export | Data analysis integration |
| **Dashboard & UI** |
| `src/dashboard/event-emitter.ts` | Real-time event streaming | Dashboard integration |
| `dashboard/server.ts` | Web dashboard server | Monitoring interface |
| `src/ui/planning-interface.ts` | Interactive prompts | Changing feedback types |
| `src/ui/human-review.ts` | Human interaction prompts | Review workflows |
| `src/ui/refinement-interface.ts` | Task refinement prompts | Description improvement |
| `src/ui/log.ts` | Logging and display | Output formatting |
| `src/ui/pretty.ts` | Pretty printing utilities | Display formatting |
| **Utilities** |
| `src/utils/terminal-bell.ts` | Audio notifications | Terminal bell alerts |
| `src/utils/id-generator.ts` | Task ID generation | Unique identifier creation |
| `src/utils/json-cleaner.ts` | JSON sanitization | Data cleaning |
| **Git Integration** |
| `src/git/sandbox.ts` | Git worktree management | Sandbox isolation |
| `src/git/worktrees.ts` | Worktree operations | Repository management |

### Data Formats (Natural Language → Interpreter Protocol)

**AIDEV-NOTE:** The system uses natural language communication between agents, with a stateless interpreter converting responses to structured decisions. This eliminates JSON parsing failures and makes agent responses more readable and debuggable.

**⚠️ CRITICAL WARNING: DO NOT implement parsers for natural language responses!** Any attempt to parse agent responses with regex, string manipulation, or programmatic extraction WILL FAIL. This has been tried repeatedly and fails every single time without exception. The ONLY reliable approach is LLM-based interpretation (see interpreter pattern below). If you find yourself writing code to parse agent responses, STOP immediately - you are making a fundamental architectural mistake.

**Agent Communication Flow:**
```
Agent Response (Natural Language) → Interpreter (Stateless Sonnet) → Structured Decision (JSON)
```

**Coder Natural Language Examples:**
```
"I need to implement user authentication by adding middleware to src/auth.ts..."
"All the planned features have been implemented successfully."
"I've added the authentication middleware to src/middleware/auth.ts"
```

**Reviewer Natural Language Examples:**
```
"I approve this approach. The steps are logical and files make sense."
"Please add error handling for expired tokens in the validation logic."
"This requires human review because of security compliance concerns."
```

**Interpreter Output (Internal):**
- Refiner: `{type: "question|refinement", question?: string, content?: string}`
- Coder: `{action: "continue|complete|implemented", description, steps, files}`
- Reviewer: `{verdict: "approve|revise|reject|needs_human", feedback, continueNext}`
- Curmudgeon: `{verdict: "APPROVE|SIMPLIFY|REJECT|NEEDS_HUMAN", feedback: string}`

**Key Features:**
- Natural language responses from agents (no JSON requirements)
- Stateless interpreter extracts decisions using fast Sonnet calls
- Robust handling of any response format or style
- Same structured data delivered to orchestrator
- Enhanced logging shows both raw responses and interpretations

### Provider & Claude CLI

The system uses Claude CLI in headless mode with natural language interpretation:
- **JSON output**: All calls use `--output-format json` for structured metadata
- **plan mode**: Read-only for Planner, Curmudgeon, Task Refiner, and Interpreter
- **default mode**: With tools for Coder, Reviewer, and SuperReviewer
  - Coder tools: ReadFile, ListDir, Grep, Bash, Write, Edit, MultiEdit
  - Reviewer tools: ReadFile, Grep, Bash (to verify file state)
  - SuperReviewer tools: ReadFile, Grep, Bash (for tests/build)
  - Interpreter: No tools needed (stateless interpretation)
- **Session separation**: Coder and Reviewer maintain independent sessions
- **Token efficiency**: System prompts sent only once per session via template injection
- **Natural interpretation**: Responses interpreted by stateless Sonnet calls
- **Metadata capture**: Automatic cost, duration, and session ID tracking
- Tools are Claude's built-in - no custom implementation needed

## 🛠️ Development Guide

### Adding a New Agent
1. Create `src/agents/newagent.ts`
2. Add prompt in `src/prompts/newagent.md`
3. Integrate in `src/orchestrator.ts`
4. Follow existing patterns from planner/coder/reviewer

### Modifying Agent Behavior
1. Edit the prompt in `src/prompts/<agent>.md`
2. Keep instructions clear and concise
3. Test with `DEBUG=true` to see actual prompts/responses

### Testing Changes

**⚠️ CRITICAL: NEVER test by running tasks (npm start)!**

Running `npm start` to test changes is **NOT ACCEPTABLE** because:
- Full task execution is complex and unreliable for testing
- Creates worktrees and git state that needs cleanup
- Wastes time and LLM API calls
- Cannot isolate what you're testing

**ONLY use these testing approaches:**

```bash
# 1. Build verification (ALWAYS do this first)
npm run build

# 2. Test specific components directly
npx tsx src/agents/planner.ts          # Test individual agent
npx tsx test-provider.ts               # Test provider wrapper
npx tsx src/protocol/interpreter.ts    # Test interpreter logic

# 3. Use existing test suite
npm test                               # Run unit tests
npm test -- --grep "specific test"     # Run specific test

# 4. Read and verify code manually
# - Review the changes you made
# - Check TypeScript compiles
# - Verify logic matches requirements
```

**There is NO exception to this rule. Do not run end-to-end tasks for testing.**

### Debug Mode
Set `DEBUG=true` to see:
- Exact prompts being sent
- Raw responses from Claude CLI
- Command construction
- Message formatting

## 💡 Design Philosophy

### Why These Choices?

**Git Worktrees Instead of Branches**
- Complete isolation from main codebase
- Can review entire change in separate directory
- No risk of polluting main branch
- Easy cleanup

**Interactive Planning by Default**
- Plans often need refinement
- Human expertise shapes approach
- Prevents wasted execution on bad plans
- Builds trust through transparency

**Conservative Reviewer**
- Better to ask than break things
- Human can always override
- Catches potential issues early
- Maintains code quality

**Natural Language → Interpreter Protocol (LLM-First Architecture)**
- Agents communicate naturally in readable language
- Stateless LLM interpreter extracts structured decisions
- **NEVER parse agent responses programmatically** - This fundamental rule has no exceptions
- No JSON parsing failures or schema validation errors
- Robust handling of any response format variations
- Better debugging through readable agent responses
- **Why this works**: LLMs understand LLMs better than regex ever will
- **Why parsing fails**: Response formats vary, structure changes, brittle string matching breaks

**Focused Changes**
- Multi-file support available
- Easier to review when related
- Clear git history
- Reduces blast radius

## 📊 Current State

### What Works Well
- ✅ Interactive planning with feedback loop
- ✅ **Streamlined approval flow** - Automatic Planner ↔ Curmudgeon cycles, single user approval
- ✅ **Task Refiner clarifying questions** - Interactive Q&A loop for vague task descriptions with promise-based resolver pattern
- ✅ Safe sandbox execution with git worktrees
- ✅ Bean Counter coordinated work breakdown (prevents loops!)
- ✅ Small chunk implementation with frequent review cycles
- ✅ Session-based progress tracking and memory
- ✅ Clear separation of concerns (strategy vs. execution)
- ✅ Good retry mechanism
- ✅ Human interaction for needs-human verdict
- ✅ Reject handling with enhanced feedback
- ✅ Bash tool for testing and verification
- ✅ Squash merge tooling for clean history
- ✅ **Comprehensive audit system** - Full logging and checkpoint recovery
- ✅ **Real-time web dashboard** - Live monitoring and visualization
- ✅ **Terminal bell notifications** - Audio feedback for task completion
- ✅ **Environment variable controls** - Flexible configuration options
- ✅ **NPX package distribution** - No installation required
- ✅ **State machine architecture** - Clear task and execution lifecycle
- ✅ **Natural language protocol** - Robust agent communication
- ✅ **Menu-based UI navigation** - Arrow key + Enter selection for all approvals, no shortcut conflicts
- ✅ **Separate SuperReviewer and Gardener states** - Independent `TASK_GARDENING` state ensures documentation update results are visible before task finalization; split-pane UI shows SuperReviewer (left) and Gardener (right) results
- ✅ **Dynamic prompt injection** - Ctrl+I keyboard shortcut enables real-time agent behavior modification during execution
- ✅ **Curmudgeon interpreter pattern** - Structured verdict extraction prevents approval loop bugs
- ✅ **Non-interactive task completion** - UI exits cleanly after Gardener, terminal displays copy-pasteable merge commands for manual execution


### Common Gotchas
- **Refiner Q&A has hard limit** - Maximum 3 clarifying questions before forcing final refinement
- **Refiner maintains session** - Context persists across question/answer iterations
- **Bean Counter drives all work chunking** - Coder no longer decides what to work on
- **Five separate sessions** - Refiner, Bean Counter, Coder, Reviewer, and SuperReviewer each have their own context
- **Bean Counter maintains progress memory** - Its session accumulates all completed work
- **Coder is now pure executor** - Receives pre-defined chunks, focuses only on implementation
- **Small chunks are the goal** - Bean Counter breaks work into frequent review cycles
- Agents communicate in natural language, interpreter extracts decisions
- System prompt sent only once per session, subsequent calls use conversation continuity
- Multi-file changes supported but Bean Counter prefers focused chunks
- Interpreter uses additional Sonnet calls (minimal cost) for decision extraction
- **Ctrl+I injections are single-use only** - Automatically cleared after next agent call
- **Injection pause is graceful** - Current agent operation completes before modal appears

## 🖥️ Ink UI Integration (Terminal UI)

Agneto includes an Ink-based Terminal User Interface that provides real-time visualization of task execution phases. This section documents the architecture, patterns, and critical implementation details learned during development.

### Core Architecture Principles

**UI-First Approach:** The Ink UI is created immediately after task initialization and observes state changes throughout the entire lifecycle. The UI is not a helper - it IS the application interface.

```typescript
// CORRECT: Create UI once, early in the flow
const inkInstance = render(<App taskStateMachine={taskStateMachine} />);
inkInstance.waitUntilExit(); // Keep alive for entire session

// WRONG: Creating UI only during specific phases
if (state === TASK_PLANNING) {
  const inkInstance = render(...); // Don't do this!
}
```

### Event-Driven Architecture

Agneto uses an **event-driven architecture** to completely decouple the UI from the orchestrator logic. This follows the same pattern as the web dashboard and eliminates the complexity of promise resolver callbacks.

**Core Concepts:**
1. **TaskStateMachine extends EventEmitter** - Emits events on all state and data changes
2. **CommandBus** - Handles UI→Orchestrator commands via event queue
3. **UI is purely reactive** - Listens to events for display, sends commands for interaction
4. **Single source of truth** - State lives in TaskStateMachine, UI reads it dynamically

```typescript
// TaskStateMachine emits events on data changes
export class TaskStateMachine extends EventEmitter {
  setPlan(planMd: string | undefined, planPath: string) {
    this.context.planMd = planMd;
    this.context.planPath = planPath;
    this.emit('plan:ready', { planMd, planPath });  // UI auto-updates
  }

  setAnsweringQuestion(isAnswering: boolean) {
    this.answeringQuestion = isAnswering;
    this.emit('question:answering', { isAnswering });  // Modal visibility control
  }
}

// UI subscribes to events for automatic re-rendering
React.useEffect(() => {
  const handleStateChange = () => forceUpdate({});
  taskStateMachine.on('state:changed', handleStateChange);
  taskStateMachine.on('plan:ready', handleDataUpdate);
  taskStateMachine.on('question:asked', handleDataUpdate);
  taskStateMachine.on('question:answering', handleDataUpdate);

  return () => {
    taskStateMachine.off('state:changed', handleStateChange);
    // ... cleanup
  };
}, [taskStateMachine]);

// UI sends commands to orchestrator via CommandBus
const handleApprove = async () => {
  await commandBus.sendCommand({ type: 'refinement:approve' });
};

// Orchestrator waits for commands
const feedback = await commandBus.waitForCommand<RefinementFeedback>('refinement:approve');
```

**Event Types Emitted:**
- `state:changed` - TaskStateMachine state transitions
- `plan:ready` - Plan markdown ready for display
- `refinement:ready` - Refinement awaiting approval
- `question:asked` - Clarifying question from Refiner
- `question:answering` - Processing answer (modal visibility control)
- `superreview:complete` - SuperReviewer results ready
- `gardener:complete` - Documentation update results ready

**Command Types:**
- `refinement:approve` / `refinement:reject` - Refinement approval
- `plan:approve` / `plan:reject` - Plan approval
- `question:answer` - Answer to clarifying question
- `superreview:approve` / `superreview:retry` / `superreview:abandon` - Final review decisions
- `merge:approve` / `merge:skip` - Merge approval

**Benefits of Event-Driven Architecture:**
1. **No prop drilling** - CommandBus and events eliminate deep prop chains
2. **Decoupled components** - UI doesn't know about orchestrator internals
3. **Same pattern as dashboard** - Reuses proven architecture
4. **Easier debugging** - Events are observable and traceable
5. **Extendible** - Adding new features doesn't require rewiring callbacks
6. **No resolver hell** - Eliminates promise resolver race conditions

### Automatic Re-rendering via Events

With the event-driven architecture, **manual re-renders are mostly eliminated**. The UI automatically updates when TaskStateMachine emits events:

```typescript
// ✅ CORRECT: Event-driven - No manual rerender needed
taskStateMachine.setPlan(planMd, planPath);
// Event 'plan:ready' is emitted → UI auto-updates

taskStateMachine.transition(TaskEvent.REFINEMENT_COMPLETE);
// Event 'state:changed' is emitted → UI auto-updates

taskStateMachine.setAnsweringQuestion(true);
// Event 'question:answering' is emitted → Modal auto-hides
```

**Rare Cases for Manual Rerender:**
Only needed when state changes don't trigger events (legacy code during migration):

```typescript
// ❌ AVOID: Manual rerender (only if events aren't wired yet)
inkInstance.rerender(<App taskStateMachine={taskStateMachine} />);
```

### State and Data Management

**Key Concepts:**
- `currentQuestion`: Current clarifying question from Refiner (if any)
- `pendingRefinement`: Temporary storage for refinement awaiting approval
- `plan`: Directly stored (no "pending" state)
- State transitions only occur AFTER user approval
- `setRefinedTask()` automatically clears `pendingRefinement`
- `clearCurrentQuestion()` clears question after answer received

**UI Display Logic:**
```typescript
// Check BOTH state AND data existence
{currentState === TaskState.TASK_PLANNING && !planMd ? (
  <Text>Creating strategic plan...</Text>  // Still generating
) : planMd ? (
  <Text>{planMd}</Text>  // Show the plan
) : (
  <Text>No plan available</Text>
)}
```

### Common Pitfalls and Solutions

**Problem 1: UI Not Updating After State Change**
- **Cause:** Event subscription not properly set up in useEffect
- **Solution:** Ensure all relevant events are subscribed with proper cleanup in return function

**Problem 2: CommandBus Commands Not Working**
- **Cause:** Orchestrator not listening for the command type
- **Solution:** Add `commandBus.waitForCommand<Type>('command:type')` in orchestrator

**Problem 3: Modal Doesn't Close After Submit**
- **Cause:** State not managed via events (e.g., `answeringQuestion` state)
- **Solution:** TaskStateMachine should own the state and emit events; UI reads state dynamically

**Problem 4: UI Shows Wrong Phase**
- **Cause:** Component reading stale props instead of live state
- **Solution:** Always read from `taskStateMachine.getCurrentState()` dynamically, not from props

**Problem 5: Event Listeners Not Cleaned Up**
- **Cause:** Missing cleanup in useEffect return function
- **Solution:** Always use `taskStateMachine.off()` to remove listeners on unmount

### Implementation Checklist

When adding UI interaction for a new phase using event-driven architecture:

**In TaskStateMachine:**
- [ ] Add getter/setter methods for any new state (e.g., `getAnsweringQuestion()`, `setAnsweringQuestion()`)
- [ ] Emit appropriate events in setter methods (e.g., `this.emit('question:answering', { isAnswering })`)
- [ ] Ensure state is serialized in checkpoint if needed

**In Orchestrator:**
- [ ] Set state via TaskStateMachine methods (not directly on context)
- [ ] Use `commandBus.waitForCommand<Type>('command:type')` to wait for user input
- [ ] Update state after command received (e.g., clear flags, transition states)

**In UI Components:**
- [ ] Subscribe to relevant events in useEffect with cleanup
- [ ] Read state dynamically from `taskStateMachine.getXxx()`, not props
- [ ] Send commands via `commandBus.sendCommand({ type: 'command:type', ... })`
- [ ] Conditionally render based on state (e.g., `!isAnswering && <Modal />`)

**Testing:**
- [ ] Verify events are emitted when state changes
- [ ] Confirm UI updates automatically without manual rerenders
- [ ] Test cleanup: unmount component, verify no memory leaks

### Dynamic Prompt Injection (Ctrl+I)

Agneto supports real-time agent behavior modification via the Ctrl+I keyboard shortcut. This allows users to inject custom instructions during execution without interrupting current operations.

**How It Works:**
1. User presses Ctrl+I during any execution phase
2. System registers pause request in TaskStateMachine
3. Current agent operation completes gracefully
4. TextInputModal appears with execution context (agent, phase, chunk info)
5. User enters custom instructions via multi-line text input
6. Injection is stored and displayed in UI status indicator ("🎯 Injection Pending")
7. When next agent runs, provider appends injection to system prompt
8. Injection automatically clears after single use (no persistence)

**Override Pattern:**
- Pressing Ctrl+I while injection is pending immediately shows modal
- New content replaces previous pending injection

**Integration Points:**
- `App.tsx`: Global `useInput` hook captures Ctrl+I keypresses
- `TaskStateMachine`: Stores injection state with methods `setPendingInjection()`, `getPendingInjection()`, `clearPendingInjection()`
- `PlanningLayout` and `ExecutionLayout`: Display injection modal and status indicators
- `providers/anthropic.ts`: Appends injection to system prompt before agent calls
- Checkpoint system: Injection state is serialized for recovery

**Visual Feedback:**
- Status indicator shows "🎯 Injection Pending (Next Agent)" when active
- Context display shows current agent type, phase, and chunk information
- Modal uses existing TextInputModal component for consistent UX

### File Organization

- `src/ui/ink/App.tsx` - Main Ink app component; subscribes to TaskStateMachine events
- `src/ui/ink/components/PlanningLayout.tsx` - Planning phase UI with menu-based approval via CommandBus; displays SuperReviewer results (left pane) during `TASK_SUPER_REVIEWING`, then shows both SuperReviewer + Gardener results (split view) during `TASK_GARDENING` state
- `src/ui/ink/components/ExecutionLayout.tsx` - Execution phase UI with menu-based human review; injection modal integration
- `src/ui/command-bus.ts` - CommandBus class for UI→Orchestrator communication
- `src/task-state-machine.ts` - Extends EventEmitter, emits events on all state changes
- State read dynamically from `taskStateMachine.getXxx()`, not props
- Commands sent via `commandBus.sendCommand()`, not callback props
- Uses `ink-select-input` for menu navigation (arrow keys + Enter)

**Deprecated Patterns:**
- ❌ Promise resolver callbacks passed as props - Replaced by CommandBus
- ❌ Manual `inkInstance.rerender()` calls - Replaced by automatic event-driven updates
- ❌ Local state for orchestrator interaction - Replaced by TaskStateMachine-owned state


## 📦 NPX Usage

Agneto is available as an NPM package! You can use it without installation:

```bash
# Use directly with npx (no installation needed)
npx agneto "fix authentication bug"

# Or install globally
npm install -g agneto
agneto "your task description"
```

**Repository**: https://github.com/durch/agneto.git
**NPM Package**: https://www.npmjs.com/package/agneto

### Remember
- **Conservative is GOOD** - Prevents breaking changes
- **"needs-human" is NORMAL** - Not an error
- **Retry mechanism exists** - 3 attempts is intentional
- **Worktrees protect you** - Main branch is always safe
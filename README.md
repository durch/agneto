# Agneto

[![npm version](https://img.shields.io/npm/v/agneto.svg)](https://www.npmjs.com/package/agneto)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: Source-Available](https://img.shields.io/badge/License-Source--Available-blue.svg)](./LICENCE.md)

An AI-powered development system that actually writes code for you - with human oversight where it matters.

## Table of Contents

- [What to Expect](#what-to-expect)
- [Quick Start](#quick-start)
- [Real Examples](#real-examples)
- [System Requirements](#system-requirements)
- [Features](#features)
- [How It Works](#how-it-works)
- [Monitoring & Debugging](#monitoring--debugging)
- [Configuration](#configuration)
- [Release Process](#release-process)
- [Contributing](#contributing)
- [License](#license)

## What to Expect

Agneto is like having a junior developer who:
- **Plans before coding** - Shows you the implementation plan for approval
- **Works in small steps** - Makes focused changes that are easy to review
- **Asks when uncertain** - Requests human input for critical decisions
- **Never touches main** - All work happens in isolated git worktrees
- **Provides full audit trail** - Every action is logged for debugging and compliance
- **Offers real-time monitoring** - Web dashboard shows progress as it happens

Perfect for: bug fixes, new features, refactoring, test writing, and routine development tasks.

## Quick Start

### Prerequisites

Before using Agneto, ensure you have:
- **Node.js >= 18.0.0**
- **Git repository** (initialized in your project)
- **Claude CLI** configured:
  ```bash
  npm install -g @anthropic-ai/claude-code
  # Follow setup instructions to authenticate
  ```

### No Installation Needed

Just use npx to get started immediately:

```bash
npx agneto "describe your task"
```

You'll be prompted to review the plan, then Agneto handles the implementation.

### Alternative: Global Installation

If you prefer to install globally:

```bash
npm install -g agneto
agneto "your task description"
```

## Real Examples

```bash
# Fix a bug
npx agneto "fix authentication bug in login flow"
# → Agneto analyzes code, creates fix plan, implements, and tests

# Add a feature
npx agneto "add dark mode toggle to settings page"
# → Agneto plans UI changes, state management, and styling

# Write tests
npx agneto "add unit tests for payment processing"
# → Agneto analyzes code and writes comprehensive tests

# Refactor code
npx agneto "refactor database module to use connection pooling"
# → Agneto identifies changes needed and refactors safely
```

### Advanced Usage

```bash
# Skip interactive planning (CI/automation)
npx agneto "update dependencies" --non-interactive

# Auto-merge to main when complete
npx agneto "fix typo in README" --auto-merge

# Use custom task ID for tracking
npx agneto auth-fix-1 "fix authentication bug"

# Run with debugging output
DEBUG=true npx agneto "complex task"
```

### Makefile Commands

For frequent users, Agneto includes a Makefile with convenient shortcuts:

```bash
# Build TypeScript (always run first)
make build

# Start a new task
make task ID=fix-auth DESC="fix authentication bug"

# Quick task with auto-generated ID
make quick DESC="add dark mode"

# Auto-merge task (non-interactive)
make auto DESC="fix typo in README"

# Debug mode
make debug ID=test-task DESC="complex feature"

# Continue existing task
make continue ID=fix-auth DESC="address review feedback"

# List all worktrees
make list

# Merge completed task
make merge ID=fix-auth

# Clean up task worktree
make cleanup ID=fix-auth

# Run tests
make test

# Check system health
make check
```

## System Requirements

- **Node.js**: Version 18.0.0 or higher
- **Git**: Initialized repository (any version)
- **Claude CLI**: Configured and authenticated
- **Terminal**: Any modern terminal with UTF-8 support
- **Operating System**: macOS, Linux, or Windows

## Features

### Core Capabilities
- ✅ **Interactive planning** with human feedback
- ✅ **Safe sandbox execution** in git worktrees
- ✅ **Automatic work breakdown** into small chunks
- ✅ **Built-in code review** process
- ✅ **Test execution** and verification
- ✅ **Non-interactive mode** for automation

### Advanced Features
- ✅ **Comprehensive audit system** - Full logging and checkpoint recovery
- ✅ **Real-time web dashboard** - Live monitoring and visualization
- ✅ **Push notifications** - Get notified via ntfy.sh when tasks complete
- ✅ **Interactive refinement** - AI asks clarifying questions (up to 3 rounds)
- ✅ **Gardener cleanup** - Final optimization and polishing after review
- ✅ **Terminal bell notifications** - Audio feedback for task completion
- ✅ **Environment variable controls** - Flexible configuration options
- ✅ **NPX package distribution** - No installation required
- ✅ **State machine architecture** - Clear task and execution lifecycle
- ✅ **Natural language protocol** - Robust agent communication

## How It Works

### AI Agent Team Architecture

Think of Agneto as a self-organizing AI development team with specialized roles:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Refiner   │ →  │   Planner   │ ↔  │ Curmudgeon  │ →  │Bean Counter │
│(Clarifies)  │    │ (Strategy)  │    │(Simplifies) │    │(Coordinates)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                   ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Gardener  │ ←  │SuperReviewer│ ←  │  Reviewer   │ ←  │    Coder    │
│ (Cleanup)   │    │(Final Check)│    │ (Validates) │    │(Implements) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                           │
                   ┌───────┴────────┐
                   │     Scribe     │
                   │   (Commits)    │
                   └────────────────┘
```

### Execution Flow

1. **You describe** what needs to be done
2. **Refiner** clarifies vague descriptions through Q&A (up to 3 rounds, interactive mode)
3. **Planner** creates the implementation approach
4. **Curmudgeon** reviews for over-engineering and simplifies (automatic back-and-forth with Planner)
5. **You approve** (or request changes to the plan)
6. **Bean Counter** breaks work into small, manageable chunks
7. **Coder** implements each chunk using file operations and shell commands
8. **Scribe** creates clean commit messages for each chunk
9. **Reviewer** validates each implementation
10. **SuperReviewer** performs final quality check (can request retry if issues found)
11. **Gardener** performs final cleanup and optimization
12. **You merge** when satisfied with the result

All work happens in isolated git worktrees (`.worktrees/<task-id>/`), so your main branch is always safe.

### After Task Completion

When Agneto finishes, you'll get clear instructions for merging:
```bash
# Review changes
cd .worktrees/<task-id>
git diff master

# If satisfied, merge to master
git checkout master
git merge sandbox/<task-id> --squash
git commit -m "Your commit message"

# Clean up
git worktree remove .worktrees/<task-id>
git branch -D sandbox/<task-id>
```

## Monitoring & Debugging

### Web Dashboard

Launch the real-time dashboard to monitor task execution:

```bash
# Start dashboard (default port 3000)
npm run dashboard

# Or specify custom port
PORT=8080 npm run dashboard

# Connect Agneto to dashboard
AGNETO_DASHBOARD_ENDPOINT=http://localhost:3000 npx agneto "your task"
```

The dashboard provides:
- **Live task monitoring** with agent communications
- **Performance metrics** including cost and duration tracking
- **Event history** with search and filtering
- **WebSocket updates** for real-time progress
- **In-memory storage** - Retains up to 1000 events per task

**Architecture:**
```
Task Events → EventEmitter → Express Server → WebSocket → Browser
```

### Audit System

Every task creates a comprehensive audit trail:

```
.agneto/task-{id}/
├── events/               # Individual JSON event files
├── metadata.json         # Task metadata and summary
└── summary.md           # Human-readable execution summary
```

**Useful audit commands:**
```bash
# View task summary
cat .agneto/task-abc123/summary.md

# Find specific agent events
grep -r "agent.*coder" .agneto/task-abc123/events/

# Check for errors
grep -r "error\|failed" .agneto/task-abc123/events/
```

### Debug Mode

Enable verbose debugging to see exactly what's happening:

```bash
DEBUG=true npx agneto "your task"
```

This shows:
- Exact prompts sent to Claude
- Raw agent responses
- Command construction details
- File system operations

## Advanced Features Explained

### Task Refinement (Interactive Mode)

In interactive mode, the **Refiner** agent helps clarify vague task descriptions through Q&A:

```bash
# Interactive mode (default)
npx agneto "improve authentication"

# Refiner might ask:
# → "What specific aspects of authentication need improvement?"
# → "Are there any specific security concerns to address?"
# → "Should this include both login and registration flows?"
```

- Up to 3 rounds of questions
- Helps ensure the task is well-understood before planning
- Can be skipped with `--non-interactive` flag

### Gardener Cleanup

After **SuperReviewer** approves the implementation, the **Gardener** agent performs final cleanup:

- Removes unnecessary comments or debug code
- Optimizes imports and dependencies
- Ensures consistent code formatting
- Validates all changes compile and pass tests
- Creates polished, production-ready code

### Push Notifications

Get notified when long-running tasks complete using [ntfy.sh](https://ntfy.sh):

```bash
# Set up notifications (one-time)
export NTFY_TOPIC=my-unique-topic-name

# Subscribe on your phone via ntfy.sh app or web
# Topic: my-unique-topic-name

# Run task - you'll get notified when complete
npx agneto "refactor entire codebase" --non-interactive
```

**Custom server:**
```bash
# Use self-hosted ntfy server
export NTFY_SERVER=https://ntfy.mycompany.com
export NTFY_TOPIC=agneto-notifications
```

## Configuration

### Environment Variables

#### Core Settings
| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `false` | Enable verbose debugging output |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |

#### Audit & Checkpoints
| Variable | Default | Description |
|----------|---------|-------------|
| `DISABLE_AUDIT` | `false` | Disable audit logging completely |
| `DISABLE_CHECKPOINTS` | `false` | Disable checkpoint creation |
| `MAX_CHECKPOINTS` | `10` | Maximum checkpoints to retain |
| `CHECKPOINT_COMPRESSION` | `false` | Enable gzip compression for checkpoints |
| `CHECKPOINT_NAMING` | `hybrid` | Naming strategy: `hybrid`, `timestamp`, `sequential`, or `semantic` |

#### Dashboard & Notifications
| Variable | Default | Description |
|----------|---------|-------------|
| `AGNETO_DASHBOARD_ENDPOINT` | `http://localhost:3000` | Dashboard server URL |
| `PORT` | `3000` | Dashboard server port |
| `NTFY_TOPIC` | - | Ntfy.sh topic for push notifications (required to enable) |
| `NTFY_SERVER` | `https://ntfy.sh` | Custom ntfy server URL |

### Agent Prompt Customization

Create a `.agneto.json` file in your project root to customize agent behaviors:

```json
{
  "prompts": {
    "refiner": "Focus on clarifying technical specifications and API requirements.",
    "planner": "Prefer small, incremental changes. Always consider backward compatibility.",
    "curmudgeon": "Be extra strict about avoiding unnecessary dependencies.",
    "bean-counter": "Keep chunks very small - maximum 50 lines of code per chunk.",
    "coder": "Follow our team's coding style guide in docs/STYLE.md.",
    "reviewer": "Pay special attention to error handling and edge cases.",
    "super-reviewer": "Verify all database migrations are reversible.",
    "gardener": "Ensure all TODO comments reference Jira tickets."
  }
}
```

**Available agents to customize:**
- `refiner` - Initial task clarification (read-only mode)
- `planner` - Implementation strategy (read-only mode)
- `curmudgeon` - Simplification review (read-only mode)
- `bean-counter` - Work breakdown coordination
- `coder` - Code implementation (has file/shell tools)
- `reviewer` - Code validation (has read/shell tools)
- `super-reviewer` - Final quality check (has read/shell tools)
- `gardener` - Cleanup and optimization

**Notes:**
- Prompts are injected into agent system prompts at task start
- They persist throughout the entire task execution
- Keep prompts concise and focused on specific behaviors
- Changes take effect on next task start

### Common Configurations

**Development setup:**
```bash
# Full monitoring with debugging
DEBUG=true npm run dashboard &
AGNETO_DASHBOARD_ENDPOINT=http://localhost:3000 npx agneto "development task"
```

**CI/CD setup:**
```bash
# Minimal, non-interactive mode
DISABLE_AUDIT=true npx agneto "ci task" --non-interactive
```

**Production deployment:**
```bash
# Optimized with checkpoints
LOG_LEVEL=warn MAX_CHECKPOINTS=5 npx agneto "production task" --non-interactive
```

**With push notifications:**
```bash
# Get notified when tasks complete
NTFY_TOPIC=my-agneto-tasks npx agneto "long running task" --non-interactive
```

## What Makes Agneto Different

- **Not a copilot** - Agneto handles entire tasks, not just line completions
- **Safe by default** - Never touches your main branch directly
- **Human-in-the-loop** - You stay in control of important decisions
- **Real code review** - Built-in review process catches issues early
- **Learns your codebase** - Understands your patterns and conventions
- **Comprehensive monitoring** - Full audit trail and real-time dashboard
- **Checkpoint recovery** - Resume from any point if something goes wrong

## Release Process

### For Maintainers

Agneto uses an automated CI/CD pipeline for publishing releases to NPM and creating GitHub releases. The process is triggered by semantic version tags.

#### Quick Release Commands

Use these NPM scripts to bump versions and trigger automated publishing:

```bash
# Patch release (bug fixes): 0.1.0 → 0.1.1
npm run version:patch

# Minor release (new features): 0.1.0 → 0.2.0
npm run version:minor

# Major release (breaking changes): 0.1.0 → 1.0.0
npm run version:major
```

Each command will:
1. Bump the version in `package.json`
2. Create a git tag (e.g., `v0.1.1`)
3. Push the tag to GitHub
4. Trigger the automated release workflow

#### Automated Release Workflow

When a version tag is pushed, GitHub Actions automatically:

1. **Validates Environment** - Checks for required secrets
2. **Runs Tests** - Ensures code quality before publishing
3. **Builds Project** - Compiles TypeScript and prepares distribution
4. **Generates Changelog** - Creates release notes from git commits
5. **Publishes to NPM** - Uploads package to npmjs.org (with retry logic)
6. **Creates GitHub Release** - Publishes release with changelog

#### Repository Setup Requirements

Before using the automated release system, ensure these GitHub repository secrets are configured:

```bash
# Required secrets in GitHub repository settings:
NPM_TOKEN=npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxx    # NPM automation token
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx # GitHub PAT (usually auto-provided)
```

**Setting up NPM_TOKEN:**
1. Log into [npmjs.com](https://www.npmjs.com/)
2. Go to **Account Settings** → **Access Tokens**
3. Create new token with **Automation** permissions
4. Copy token to GitHub repository **Settings** → **Secrets and variables** → **Actions**
5. Add as `NPM_TOKEN` secret

#### Troubleshooting Common Issues

**Empty changelog generated:**
- Ensure commits follow conventional format: `feat:`, `fix:`, `docs:`, etc.
- Check that there are commits between the previous tag and current tag

**NPM publish fails:**
- Verify `NPM_TOKEN` secret is correctly configured
- Check that the version doesn't already exist on NPM
- Ensure package name is available (if first publish)

**GitHub release creation fails:**
- Verify `GITHUB_TOKEN` has sufficient permissions
- Check that the tag was pushed successfully
- Ensure repository settings allow release creation

**Tests fail during workflow:**
- All tests must pass before publishing
- Fix failing tests and re-run version command

**Tag format rejected:**
- Tags must follow semantic versioning: `v1.2.3`
- Avoid additional suffixes like `v1.2.3-beta`

## Contributing

Thanks for your interest in Agneto!

**Current Status**: This project is **not accepting code contributions or pull requests** at this time.

**What you can do:**
- ✅ **Report bugs** by opening issues
- ✅ **Request features** via GitHub issues
- ✅ **Ask questions** in discussions
- 🚫 **Pull requests** will not be merged

**Commercial Use**: If you're interested in commercial licensing, please contact [drazen@urch.eu](mailto:drazen@urch.eu).

For more details, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Documentation

For detailed documentation, troubleshooting, and configuration options:
- **Complete Guide**: [CLAUDE.md](./CLAUDE.md) - Comprehensive documentation
- **License Details**: [LICENCE.md](./LICENCE.md) - Full license terms
- **Contributing**: [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines

## License

This software is **source-available** under a custom license.

**Permitted**: Personal, educational, and research use
**Prohibited**: Commercial use without separate license

Copyright (c) 2025 Dražen Urch

See [LICENCE.md](./LICENCE.md) for complete terms.

---

**Repository**: https://github.com/durch/agneto
**NPM Package**: https://www.npmjs.com/package/agneto
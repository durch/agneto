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
│   Planner   │ →  │ Curmudgeon  │ →  │Bean Counter │ →  │    Coder    │
│ (Strategy)  │    │(Simplifies) │    │(Coordinates)│    │(Implements) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                   ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│SuperReviewer│ ←  │ Task Refiner│ ←  │  Reviewer   │ ←  │   Scribe    │
│(Final Check)│    │(Clarifies)  │    │ (Validates) │    │(Commits)    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Execution Flow

1. **You describe** what needs to be done
2. **Task Refiner** clarifies vague descriptions (interactive mode)
3. **Planner** creates the approach and shows you
4. **Curmudgeon** reviews for over-engineering and simplifies
5. **You approve** (or request changes to the plan)
6. **Bean Counter** breaks work into small, manageable chunks
7. **Coder** implements each chunk with built-in tools
8. **Reviewer** validates each implementation
9. **SuperReviewer** performs final quality check
10. **You merge** when satisfied with the result

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
# Start dashboard (opens on http://localhost:3000)
npm run dashboard

# Or if using Agneto globally
agneto-dashboard
```

The dashboard provides:
- **Live task monitoring** with agent communications
- **Performance metrics** including cost and duration tracking
- **Event history** with search and filtering
- **WebSocket updates** for real-time progress

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

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `false` | Enable verbose debugging output |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `DISABLE_AUDIT` | `false` | Disable audit logging completely |
| `DISABLE_CHECKPOINTS` | `false` | Disable checkpoint creation |
| `MAX_CHECKPOINTS` | `10` | Maximum checkpoints to retain |
| `AGNETO_DASHBOARD_ENDPOINT` | `http://localhost:3000` | Dashboard server URL |

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

## What Makes Agneto Different

- **Not a copilot** - Agneto handles entire tasks, not just line completions
- **Safe by default** - Never touches your main branch directly
- **Human-in-the-loop** - You stay in control of important decisions
- **Real code review** - Built-in review process catches issues early
- **Learns your codebase** - Understands your patterns and conventions
- **Comprehensive monitoring** - Full audit trail and real-time dashboard
- **Checkpoint recovery** - Resume from any point if something goes wrong

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
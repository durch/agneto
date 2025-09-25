# Agneto

AI-powered autonomous coding agent with human-in-the-loop planning.

## Quick Start

No installation needed! Just use npx:

```bash
npx agneto "describe your task"
```

## Examples

```bash
# Fix a bug
npx agneto "fix authentication bug in login flow"

# Add a feature
npx agneto "add dark mode toggle to settings page"

# Refactor code
npx agneto "refactor database connection to use connection pooling"

# With custom task ID
npx agneto auth-fix-1 "fix authentication bug"

# Non-interactive mode (for CI/automation)
npx agneto "update dependencies" --non-interactive

# Auto-merge when complete
npx agneto "fix typo in README" --auto-merge
```

## Installation (Optional)

If you prefer to install globally:

```bash
npm install -g agneto
agneto "your task description"
```

## How It Works

Agneto uses an AI development team approach with specialized agents:

1. **Task Refiner** - Clarifies vague task descriptions
2. **Planner** - Creates high-level strategic plans
3. **Bean Counter** - Breaks work into small, reviewable chunks
4. **Coder** - Implements the code changes
5. **Reviewer** - Reviews each implementation
6. **SuperReviewer** - Final quality check

All work happens in isolated git worktrees (`.worktrees/`), keeping your main branch safe.

## Requirements

- Node.js >= 18.0.0
- Git repository
- Claude CLI configured (`npm install -g @anthropic-ai/claude-code`)

## Features

- ✅ Interactive planning with human feedback
- ✅ Safe sandbox execution in git worktrees
- ✅ Automatic work breakdown into small chunks
- ✅ Built-in code review process
- ✅ Test execution and verification
- ✅ Non-interactive mode for automation

## Documentation

For detailed documentation and configuration options, see [CLAUDE.md](https://github.com/yourusername/agneto/blob/main/CLAUDE.md) in the repository.

## License

MIT
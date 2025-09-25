# Agneto

An AI-powered development system that actually writes code for you - with human oversight where it matters.

## What to Expect

Agneto is like having a junior developer who:
- **Plans before coding** - Shows you the implementation plan for approval
- **Works in small steps** - Makes focused changes that are easy to review
- **Asks when uncertain** - Requests human input for critical decisions
- **Never touches main** - All work happens in isolated git worktrees

Perfect for: bug fixes, new features, refactoring, test writing, and routine development tasks.

## Quick Start

No installation needed! Just use npx:

```bash
npx agneto "describe your task"
```

You'll be prompted to review the plan, then Agneto handles the implementation.

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
```

## Installation (Optional)

If you prefer to install globally:

```bash
npm install -g agneto
agneto "your task description"
```

## How It Works

Think of Agneto as a self-organizing AI development team:

1. **You describe** what needs to be done
2. **Agneto plans** the approach and shows you
3. **You approve** (or request changes)
4. **Agneto implements** in small, reviewable chunks
5. **Built-in review** catches issues before they reach you
6. **You merge** when satisfied with the result

All work happens in isolated git worktrees (`.worktrees/<task-id>/`), so your main branch is always safe. Review the changes, run tests, and merge only when you're ready.

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

## What Makes Agneto Different

- **Not a copilot** - Agneto handles entire tasks, not just line completions
- **Safe by default** - Never touches your main branch directly
- **Human-in-the-loop** - You stay in control of important decisions
- **Real code review** - Built-in review process catches issues early
- **Learns your codebase** - Understands your patterns and conventions

## Documentation

For detailed documentation and configuration options, see [CLAUDE.md](https://github.com/durch/agneto/blob/main/CLAUDE.md) in the repository.

## License

MIT
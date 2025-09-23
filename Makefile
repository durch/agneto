# Agneto - Agentic Development System
# Usage: make [target]

.PHONY: help build test task merge cleanup list debug provider commit

# Default target - show help
help:
	@echo "🤖 Agneto Development System"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "Common commands:"
	@echo "  make build       - Build TypeScript (always do this first)"
	@echo "  make task ID=\"name\" DESC=\"description\" - Run a new task"
	@echo "  make merge ID=\"name\" - Merge a completed task"
	@echo "  make cleanup ID=\"name\" - Clean up a task worktree"
	@echo "  make list        - List all worktrees"
	@echo ""
	@echo "Testing & Debugging:"
	@echo "  make test        - Run tests"
	@echo "  make debug ID=\"name\" DESC=\"description\" - Run task with debug output"
	@echo "  make provider    - Test the Claude provider"
	@echo ""
	@echo "Git operations:"
	@echo "  make commit MSG=\"message\" - Commit current changes"
	@echo "  make status      - Show git status"
	@echo ""
	@echo "Quick tasks:"
	@echo "  make quick DESC=\"description\" - Run non-interactive task"
	@echo "  make auto DESC=\"description\" - Run with auto-merge"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Build TypeScript - ALWAYS DO THIS FIRST
build:
	@echo "🔨 Building TypeScript..."
	@npm run build
	@echo "✅ Build complete"

# Run tests
test: build
	@echo "🧪 Running tests..."
	@npm test

# Start a new task (interactive by default)
task: build
	@if [ -z "$(ID)" ]; then \
		echo "❌ Error: ID is required. Usage: make task ID=task-name DESC=\"task description\""; \
		exit 1; \
	fi
	@if [ -z "$(DESC)" ]; then \
		echo "❌ Error: DESC is required. Usage: make task ID=task-name DESC=\"task description\""; \
		exit 1; \
	fi
	@echo "🚀 Starting task: $(ID)"
	@npm start -- $(ID) "$(DESC)"

# Quick non-interactive task
quick: build
	@if [ -z "$(DESC)" ]; then \
		echo "❌ Error: DESC is required. Usage: make quick DESC=\"task description\""; \
		exit 1; \
	fi
	@ID=$$(echo "$$DESC" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-20); \
	echo "🚀 Starting quick task: $$ID"; \
	npm start -- $$ID "$(DESC)" --non-interactive

# Auto-merge task
auto: build
	@if [ -z "$(DESC)" ]; then \
		echo "❌ Error: DESC is required. Usage: make auto DESC=\"task description\""; \
		exit 1; \
	fi
	@ID=$$(echo "$$DESC" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-20); \
	echo "🚀 Starting auto-merge task: $$ID"; \
	npm start -- $$ID "$(DESC)" --non-interactive --auto-merge

# Debug task with verbose output
debug: build
	@if [ -z "$(ID)" ]; then \
		echo "❌ Error: ID is required. Usage: make debug ID=task-name DESC=\"task description\""; \
		exit 1; \
	fi
	@if [ -z "$(DESC)" ]; then \
		echo "❌ Error: DESC is required. Usage: make debug ID=task-name DESC=\"task description\""; \
		exit 1; \
	fi
	@echo "🐛 Starting task with debug output: $(ID)"
	@DEBUG=true npm start -- $(ID) "$(DESC)"

# Test the Claude provider
provider:
	@echo "🧪 Testing Claude provider..."
	@DEBUG=true npx tsx test-provider.ts

# Merge a completed task
merge:
	@if [ -z "$(ID)" ]; then \
		echo "❌ Error: ID is required. Usage: make merge ID=task-name"; \
		exit 1; \
	fi
	@echo "🔀 Merging task: $(ID)"
	@npm run merge-task $(ID)

# Clean up a task
cleanup:
	@if [ -z "$(ID)" ]; then \
		echo "❌ Error: ID is required. Usage: make cleanup ID=task-name"; \
		exit 1; \
	fi
	@echo "🧹 Cleaning up task: $(ID)"
	@npm run cleanup-task $(ID)

# List all worktrees
list:
	@echo "📋 Active worktrees:"
	@git worktree list | grep -v "bare" || echo "  (none)"
	@echo ""
	@echo "📁 Worktree directories:"
	@ls -1 .worktrees/ 2>/dev/null || echo "  (none)"

# Git status
status:
	@echo "📊 Git status:"
	@git status -s || echo "✨ Working tree clean"

# Commit changes
commit:
	@if [ -z "$(MSG)" ]; then \
		echo "❌ Error: MSG is required. Usage: make commit MSG=\"commit message\""; \
		exit 1; \
	fi
	@echo "💾 Committing changes..."
	@git add -A
	@git commit -m "$(MSG)" -m "🤖 Generated with Claude Code" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
	@echo "✅ Changes committed"

# Continue an existing task
continue:
	@if [ -z "$(ID)" ]; then \
		echo "❌ Error: ID is required. Usage: make continue ID=task-name DESC=\"what to do next\""; \
		exit 1; \
	fi
	@if [ -z "$(DESC)" ]; then \
		echo "❌ Error: DESC is required. Usage: make continue ID=task-name DESC=\"what to do next\""; \
		exit 1; \
	fi
	@echo "➡️  Continuing task: $(ID)"
	@npm start -- $(ID) "$(DESC)"

# Clean all worktrees (DANGER!)
clean-all:
	@echo "⚠️  WARNING: This will remove ALL worktrees!"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	echo ""; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		git worktree prune; \
		rm -rf .worktrees/*; \
		echo "✅ All worktrees removed"; \
	else \
		echo "❌ Cancelled"; \
	fi

# Check system health
check:
	@echo "🏥 System health check:"
	@echo -n "  TypeScript: "; npm run build > /dev/null 2>&1 && echo "✅" || echo "❌"
	@echo -n "  Claude CLI: "; echo "OK" | claude -p > /dev/null 2>&1 && echo "✅" || echo "❌"
	@echo -n "  Git worktrees: "; git worktree list > /dev/null 2>&1 && echo "✅" || echo "❌"
	@echo -n "  Node modules: "; [ -d node_modules ] && echo "✅" || echo "❌"

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@npm install
	@echo "✅ Dependencies installed"

# Watch for TypeScript changes
watch:
	@echo "👀 Watching TypeScript files..."
	@npx tsc -w

.DEFAULT_GOAL := help
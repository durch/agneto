#!/usr/bin/env bash

# Script to merge a worktree branch to master
# Usage: ./scripts/merge-worktree.sh <task-id>

set -e

if [ -z "$1" ]; then
    echo "Usage: npm run merge-task <task-id>"
    echo ""
    echo "Available worktrees:"
    git worktree list | grep -v "bare" | awk '{print "  - " $1}' | sed 's|.*/.worktrees/||'
    exit 1
fi

TASK_ID=$1
BRANCH="sandbox/$TASK_ID"
WORKTREE_PATH=".worktrees/$TASK_ID"

# Check if worktree exists
if [ ! -d "$WORKTREE_PATH" ]; then
    echo "❌ Worktree not found: $WORKTREE_PATH"
    echo ""
    echo "Available worktrees:"
    ls -1 .worktrees/ 2>/dev/null || echo "  (none)"
    exit 1
fi

# Check if branch exists
if ! git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "❌ Branch not found: $BRANCH"
    exit 1
fi

echo "📊 Changes to be merged from $BRANCH:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Show diff stats
git diff master...$BRANCH --stat

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ask for confirmation
read -p "🔄 Merge $BRANCH to master? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Merge cancelled"
    exit 0
fi

# Save current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Switch to master
echo "📍 Switching to master..."
git checkout master

# Merge the branch with squash
echo "🔀 Squash merging $BRANCH..."
if git merge "$BRANCH" --squash; then
    # Extract plan title if it exists
    PLAN_TITLE=""
    if [ -f "$WORKTREE_PATH/.plans/$TASK_ID/plan.md" ]; then
        PLAN_TITLE=$(grep "^# " "$WORKTREE_PATH/.plans/$TASK_ID/plan.md" | head -1 | sed 's/^# //')
    fi

    # Create a meaningful commit message
    echo "📝 Creating squashed commit..."
    if [ -n "$PLAN_TITLE" ]; then
        COMMIT_MSG="$PLAN_TITLE"
    else
        COMMIT_MSG="Task $TASK_ID completed"
    fi

    # Add files changed summary
    FILES_CHANGED=$(git diff --cached --name-only | wc -l | tr -d ' ')
    COMMIT_BODY="Squashed $FILES_CHANGED file changes from branch $BRANCH"

    git commit -m "$COMMIT_MSG" -m "$COMMIT_BODY"
    echo "✅ Successfully squash merged $BRANCH to master"

    # Ask about cleanup
    echo ""
    read -p "🧹 Remove worktree and branch? (y/N) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Removing worktree..."
        git worktree remove "$WORKTREE_PATH" --force

        echo "🗑️  Deleting branch..."
        git branch -D "$BRANCH"

        echo "✨ Cleanup complete!"
    else
        echo "ℹ️  Worktree and branch preserved. To clean up later, run:"
        echo "    npm run cleanup-task $TASK_ID"
    fi
else
    echo "❌ Merge failed. Resolving conflicts..."
    echo ""
    echo "After resolving conflicts:"
    echo "  1. git add <resolved files>"
    echo "  2. git commit"
    echo "  3. npm run cleanup-task $TASK_ID (if desired)"

    # Return to original branch if merge failed
    git checkout "$CURRENT_BRANCH"
    exit 1
fi

echo ""
echo "🎉 Task $TASK_ID successfully integrated!"
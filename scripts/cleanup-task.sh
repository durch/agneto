#!/usr/bin/env bash
set -euo pipefail
task="${1:?usage: npm run cleanup-task -- <task-id>}"
branch="sandbox/$task"
dir=".worktrees/$task"

git worktree remove "$dir" || { echo "Worktree not removed (uncommitted changes?)."; exit 1; }
git branch -D "$branch" || true
echo "Cleaned $task"

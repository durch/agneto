#!/usr/bin/env bash
set -euo pipefail
task="${1:?usage: npm run new-task -- <task-id> [base-branch]}"
base="${2:-origin/main}"
branch="sandbox/$task"
dir=".worktrees/$task"

git fetch origin || true
git branch -f "$branch" "$base" || git switch -c "$branch" "$base"
mkdir -p .worktrees
git worktree add "$dir" "$branch"
echo "Created worktree at $dir for branch $branch"

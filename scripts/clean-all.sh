#!/bin/bash

ls .worktrees | xargs -I {} scripts/cleanup-task.sh {}
git worktree prune
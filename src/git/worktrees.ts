import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { copyConfiguredFilesToWorktree } from "./sandbox";

export function pathFor(taskId: string) { return `.worktrees/${taskId}`; }
export function branchFor(taskId: string) { return `sandbox/${taskId}`; }

// Detect the default branch to use as base for new worktrees
function detectOriginDefault(): string {
    // First, try to get the origin's default branch
    try {
        const ref = execSync(`git symbolic-ref --quiet --short refs/remotes/origin/HEAD`, { encoding: "utf8" }).trim();
        if (ref) return ref; // e.g., "origin/main" or "origin/master"
    } catch {}

    // If no origin, try to get the current repo's default branch
    try {
        // Get the branch that HEAD points to (usually main or master)
        const currentBranch = execSync(`git symbolic-ref --short HEAD`, { encoding: "utf8" }).trim();
        if (currentBranch) return currentBranch;
    } catch {}

    // Try common branch names
    const commonBranches = ['main', 'master'];
    for (const branch of commonBranches) {
        if (branchExists(branch)) {
            return branch;
        }
    }

    // Last resort: use HEAD
    return "HEAD";
}

function branchExists(branch: string): boolean {
    try {
        execSync(`git rev-parse --verify ${branch}`, { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

function worktreeForBranchExists(branch: string): boolean {
    try {
        const out = execSync(`git worktree list --porcelain`, { encoding: "utf8" });
        // entries have lines like: "branch refs/heads/sandbox/t-001"
        return out.split("\n").some(l => l.trim() === `branch refs/heads/${branch}`);
    } catch {
        return false;
    }
}

export function ensureWorktree(taskId: string, base?: string) {
    const dir = pathFor(taskId);
    const branch = branchFor(taskId);
    const baseRef = base || detectOriginDefault();

    // Validate that the base branch exists if explicitly provided
    if (base && !branchExists(base)) {
        throw new Error(`Base branch '${base}' does not exist. Please specify a valid branch.`);
    }

    // If the worktree directory already exists, just reuse it.
    if (existsSync(dir)) {
        return { dir: resolve(dir), branch };
    }

    // Make sure we have latest refs (best-effort)
    try { execSync(`git fetch --all --prune`, { stdio: "ignore" }); } catch {}

    // Create the sandbox branch if it doesn't exist yet.
    if (!branchExists(branch)) {
        execSync(`git branch ${branch} ${baseRef}`, { stdio: "inherit" });
    } else {
        // If branch exists AND is already attached to a worktree, don't try to force-update it.
        if (worktreeForBranchExists(branch)) {
            // nothing to do; we'll just add (or reuse) the path below
        } else {
            // Branch exists but no worktree yet — keep its current tip; don't -f while not attached.
        }
    }

    // Add the worktree at the desired path (idempotent-ish: will fail only if path exists)
    execSync(`mkdir -p .worktrees`, { stdio: "ignore" });
    execSync(`git worktree add "${dir}" "${branch}"`, { stdio: "inherit" });

    // Copy configured files to the new worktree
    copyConfiguredFilesToWorktree(taskId, resolve(dir));

    return { dir: resolve(dir), branch };
}

// Remove a worktree and its associated branch
export function removeWorktree(taskId: string): void {
    const dir = pathFor(taskId);
    const branch = branchFor(taskId);

    // Remove worktree if it exists
    if (existsSync(dir)) {
        try {
            execSync(`git worktree remove "${dir}" --force`, { stdio: "ignore" });
        } catch {
            // Fallback: manual removal if git command fails
            try {
                execSync(`rm -rf "${dir}"`, { stdio: "ignore" });
            } catch {}
        }
    }

    // Delete the branch if it exists
    if (branchExists(branch)) {
        try {
            execSync(`git branch -D ${branch}`, { stdio: "ignore" });
        } catch {
            // Branch might be checked out elsewhere or protected
        }
    }

    // Prune worktree list to clean up any stale entries
    try {
        execSync(`git worktree prune`, { stdio: "ignore" });
    } catch {}
}

// List all worktrees with their paths and branches
export function listWorktrees(): Array<{ path: string; branch: string }> {
    try {
        const output = execSync(`git worktree list --porcelain`, { encoding: "utf8" });
        const worktrees: Array<{ path: string; branch: string }> = [];

        let currentPath = "";
        const lines = output.split("\n");

        for (const line of lines) {
            if (line.startsWith("worktree ")) {
                currentPath = line.substring(9);
            } else if (line.startsWith("branch ")) {
                const branchRef = line.substring(7);
                // Convert refs/heads/sandbox/task-1 to sandbox/task-1
                const branch = branchRef.replace("refs/heads/", "");
                if (currentPath) {
                    worktrees.push({ path: currentPath, branch });
                }
                currentPath = "";
            }
        }

        return worktrees;
    } catch {
        return [];
    }
}

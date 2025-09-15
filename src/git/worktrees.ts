import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

export function pathFor(taskId: string) { return `.worktrees/${taskId}`; }
export function branchFor(taskId: string) { return `sandbox/${taskId}`; }

// Detect origin default branch (origin/main vs origin/master)
function detectOriginDefault(): string {
    try {
        const ref = execSync(`git symbolic-ref --quiet --short refs/remotes/origin/HEAD`, { encoding: "utf8" }).trim();
        // ref looks like "origin/main" or "origin/master"
        return ref || "origin/main";
    } catch {
        return "origin/main";
    }
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

    // If the worktree directory already exists, just reuse it.
    if (existsSync(dir)) {
        return { dir, branch };
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

    return { dir, branch };
}

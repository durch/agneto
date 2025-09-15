import { execSync } from "node:child_process";

export function pathFor(taskId: string) { return `.worktrees/${taskId}`; }
export function branchFor(taskId: string) { return `sandbox/${taskId}`; }

export function ensureWorktree(taskId: string, base = "origin/main") {
    const dir = pathFor(taskId), branch = branchFor(taskId);
    execSync(`git fetch origin || true`, { stdio: "inherit" });
    execSync(`git branch -f "${branch}" "${base}" || git switch -c "${branch}" "${base}"`, { stdio: "inherit" });
    execSync(`mkdir -p .worktrees && git worktree add "${dir}" "${branch}"`, { stdio: "inherit" });
    return { dir, branch };
}

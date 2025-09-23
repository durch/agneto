import { execSync } from "node:child_process";

// AIDEV-NOTE: Removed dangerous applyProposal function - Coder now uses Claude's built-in file tools
// The old implementation was causing file truncation bugs by treating partial content as complete files

export function revertLast(cwd: string) {
    execSync(`git -C "${cwd}" revert --no-edit HEAD`, { stdio: "inherit" });
}

export function mergeToMaster(taskId: string, worktreePath: string) {
    const branch = `sandbox/${taskId}`;

    try {
        // Ensure we have latest master
        execSync(`git fetch origin master`, { stdio: "inherit" });

        // Check if there are any changes to merge
        const diffOutput = execSync(`git -C "${worktreePath}" diff master...HEAD --stat`, { encoding: "utf8" });
        if (!diffOutput.trim()) {
            console.log(`ℹ️ No changes to merge from ${branch}`);
            return;
        }

        // Ensure working directory is clean before switching
        const statusOutput = execSync(`git status --porcelain`, { encoding: "utf8" });
        if (statusOutput.trim()) {
            throw new Error("Working directory is not clean. Please commit or stash changes first.");
        }

        // Switch to master and merge the sandbox branch
        execSync(`git checkout master`, { stdio: "inherit" });
        execSync(`git merge ${branch} --no-ff -m "Merge ${branch}: Task ${taskId} completed"`, { stdio: "inherit" });

        console.log(`✅ Merged ${branch} to master`);

        // Optional: Push to origin if desired
        // execSync(`git push origin master`, { stdio: "inherit" });
    } catch (error) {
        console.error(`❌ Failed to merge: ${error}`);
        // Try to switch back to original branch
        try { execSync(`git checkout -`, { stdio: "ignore" }); } catch {}
        throw error;
    }
}

export function cleanupWorktree(taskId: string, worktreePath: string) {
    const branch = `sandbox/${taskId}`;

    // Remove the worktree
    execSync(`git worktree remove "${worktreePath}" --force`, { stdio: "inherit" });

    // Delete the branch
    execSync(`git branch -D ${branch}`, { stdio: "inherit" });

    console.log(`🧹 Cleaned up worktree and branch for ${taskId}`);
}

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export function applyProposal(cwd: string, proposal: string): boolean {
    // AIDEV-NOTE: Critical function - handles file writes from Coder proposals
    // Check for no-op case first (when implementation is already complete)
    if (proposal.includes("FILE: NOTHING")) {
        console.log(`✔️ Step already complete - no changes needed`);
        return false; // false indicates no changes were made (no-op)
    }

    // Expect "FILE: <path>\n---8<---\n<patch>\n---8<---"
    const m = proposal.match(/FILE:\s*(.+)\n---8<---\n([\s\S]*?)\n---8<---/);
    if (!m) throw new Error("Malformed proposal");
    const file = m[1].trim(), patch = m[2];

    const fullPath = `${cwd}/${file}`;
    const fileExists = existsSync(fullPath);

    // Log when we're modifying vs creating files
    if (fileExists) {
        console.log(`📝 Modifying existing file: ${file}`);
    } else {
        console.log(`✨ Creating new file: ${file}`);
    }

    // Create directory structure if needed
    mkdirSync(dirname(fullPath), { recursive: true });

    // AIDEV-NOTE: Must use overwrite mode - append caused duplicate content bug
    // Write the complete file contents (overwrite, not append)
    writeFileSync(fullPath, patch.includes("\n") ? patch : `${patch}\n`);

    execSync(`git -C "${cwd}" add -A && git -C "${cwd}" commit -m "agent: apply proposal for ${file}"`, { stdio: "inherit" });

    return true; // true indicates changes were made
}

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

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// AIDEV-NOTE: Removed dangerous applyProposal function - Coder now uses Claude's built-in file tools
// The old implementation was causing file truncation bugs by treating partial content as complete files

/**
 * Recursively copy a directory and its contents
 */
function copyDirectoryRecursive(src: string, dest: string): void {
    if (!fs.existsSync(src)) {
        return;
    }

    // Create destination directory
    fs.mkdirSync(dest, { recursive: true });

    // Read directory contents
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirectoryRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Preserve audit data from worktree to master branch
 */
function preserveAuditData(worktreePath: string): void {
    const worktreeAuditPath = path.join(worktreePath, '.agneto');
    const masterAuditPath = '.agneto';

    try {
        // Check if audit data exists in the worktree
        if (fs.existsSync(worktreeAuditPath)) {
            console.log('📋 Preserving audit data...');

            // Copy .agneto folder to master branch working directory
            copyDirectoryRecursive(worktreeAuditPath, masterAuditPath);

            // Add and commit the audit data
            execSync('git add .agneto/', { stdio: 'inherit' });

            // Check if there are changes to commit
            const statusOutput = execSync('git status --porcelain .agneto/', { encoding: 'utf8' });
            if (statusOutput.trim()) {
                execSync('git commit -m "Add audit data from completed task"', { stdio: 'inherit' });
                console.log('✅ Audit data preserved to master branch');
            } else {
                console.log('ℹ️ No new audit data to preserve');
            }
        } else {
            console.log('ℹ️ No audit data found in worktree');
        }
    } catch (error) {
        console.warn(`⚠️ Failed to preserve audit data: ${error}`);
        console.warn('Continuing with merge process...');
    }
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

        // Preserve audit data from the worktree to master branch
        preserveAuditData(worktreePath);

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

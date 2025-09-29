import { log } from "./ui/log.js";
import { promptHumanReview } from "./ui/human-review.js";
import type { HumanInteractionResult } from "./types.js";
import type { CoderPlanProposal } from "./types.js";
import { execSync } from "child_process";

/**
 * Handle human review for plan proposals
 */
export async function handlePlanHumanReview(
  proposal: CoderPlanProposal,
  reviewerFeedback: string
): Promise<{ decision: 'approve' | 'revise' | 'reject', feedback?: string }> {
  const humanResult = await promptHumanReview(
    proposal.description,
    "Proposed implementation approach",
    reviewerFeedback
  );

  if (humanResult.decision === 'approve') {
    log.orchestrator("Human approved the plan");
    return { decision: 'approve' };
  } else if (humanResult.decision === 'retry') {
    log.orchestrator("Human requested plan revision");

    // Combine reviewer feedback with human feedback for complete context
    let combinedFeedback = "";
    if (reviewerFeedback) {
      combinedFeedback += `Reviewer feedback: ${reviewerFeedback}`;
    }
    if (humanResult.feedback) {
      if (combinedFeedback) combinedFeedback += "\n\n";
      combinedFeedback += `Human feedback: ${humanResult.feedback}`;
    }

    return {
      decision: 'revise',
      feedback: combinedFeedback || "Human requested changes to the approach"
    };
  } else {
    log.orchestrator("Human rejected the plan");
    return { decision: 'reject' };
  }
}

/**
 * Handle human review for code changes
 */
export async function handleCodeHumanReview(
  changeDescription: string,
  reviewerFeedback: string
): Promise<{ decision: 'approve' | 'revise' | 'reject', feedback?: string }> {
  const humanResult = await promptHumanReview(
    changeDescription,
    "Code implementation",
    reviewerFeedback
  );

  if (humanResult.decision === 'approve') {
    log.orchestrator("Human approved the code changes");
    return { decision: 'approve' };
  } else if (humanResult.decision === 'retry') {
    log.orchestrator("Human requested code revision");

    // Combine reviewer feedback with human feedback for complete context
    let combinedFeedback = "";
    if (reviewerFeedback) {
      combinedFeedback += `Reviewer feedback: ${reviewerFeedback}`;
    }
    if (humanResult.feedback) {
      if (combinedFeedback) combinedFeedback += "\n\n";
      combinedFeedback += `Human feedback: ${humanResult.feedback}`;
    }

    return {
      decision: 'revise',
      feedback: combinedFeedback || "Human requested changes to the implementation"
    };
  } else {
    log.orchestrator("Human rejected the code changes");
    return { decision: 'reject' };
  }
}

/**
 * Commit current changes with a descriptive message
 */
export async function commitChanges(cwd: string, description: string): Promise<void> {
  try {
    // Check if there are changes to commit
    if (!hasUncommittedChanges(cwd)) {
      log.orchestrator("No changes to commit");
      return;
    }

    // Stage all changes
    execSync(`git -C "${cwd}" add -A`, { stdio: "inherit" });

    // Create commit with chunk description
    const commitMessage = `Chunk: ${description}`;
    execSync(`git -C "${cwd}" commit -m "${commitMessage}"`, { stdio: "inherit" });

    log.orchestrator(`✅ Committed: ${description}`);
  } catch (error) {
    log.warn(`Failed to commit changes: ${error}`);
    throw new Error("Could not commit changes");
  }
}

/**
 * Revert the last commit or clean uncommitted changes
 * AIDEV-NOTE: Added baseline commit check to prevent reverting pre-task commits
 */
export async function revertLastCommit(cwd: string, baselineCommit?: string): Promise<void> {
  try {
    // Get current HEAD to compare with baseline
    const currentHead = (() => {
      try {
        return execSync(`git -C "${cwd}" rev-parse HEAD`, { encoding: "utf8" }).trim();
      } catch {
        return null;
      }
    })();

    // If we have a baseline and we're at the baseline, nothing to revert
    if (baselineCommit && currentHead === baselineCommit) {
      log.orchestrator("🔒 No task-specific changes to revert (at baseline commit)");
      return;
    }

    // Check if we have commits to revert
    const hasCommits = (() => {
      try {
        execSync(`git -C "${cwd}" rev-parse HEAD~1`, { stdio: "pipe" });
        return true;
      } catch {
        return false;
      }
    })();

    if (hasCommits) {
      // We have commits, revert the last one
      log.orchestrator("Reverting last commit...");
      execSync(`git -C "${cwd}" revert --no-edit HEAD`, { stdio: "inherit" });
    } else {
      // No commits, just clean uncommitted changes
      log.orchestrator("Cleaning uncommitted changes...");
      execSync(`git -C "${cwd}" checkout -- .`, { stdio: "inherit" });
      execSync(`git -C "${cwd}" clean -fd`, { stdio: "inherit" });
    }
  } catch (error) {
    log.warn(`Failed to revert changes: ${error}`);
    // Try harder to clean up
    try {
      if (hasUncommittedChanges(cwd)) {
        execSync(`git -C "${cwd}" reset --hard HEAD`, { stdio: "inherit" });
        execSync(`git -C "${cwd}" clean -fd`, { stdio: "inherit" });
        log.orchestrator("Used reset to clean changes");
      }
    } catch (resetError) {
      log.warn(`Failed to reset: ${resetError}`);
      throw new Error("Could not undo changes");
    }
  }
}

/**
 * Check if there are uncommitted changes
 */
export function hasUncommittedChanges(cwd: string): boolean {
  try {
    const result = execSync(`git -C "${cwd}" status --porcelain`, { encoding: 'utf8' });
    return result.trim().length > 0;
  } catch (error) {
    log.warn(`Failed to check git status: ${error}`);
    return false;
  }
}

/**
 * Get a summary of recent changes
 */
export function getChangesSummary(cwd: string): string {
  try {
    const diff = execSync(`git -C "${cwd}" diff HEAD --stat`, { encoding: 'utf8' });
    return diff.trim() || "No changes";
  } catch (error) {
    return "Could not get changes summary";
  }
}
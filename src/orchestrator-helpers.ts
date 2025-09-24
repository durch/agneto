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
    return {
      decision: 'revise',
      feedback: humanResult.feedback || "Human requested changes to the approach"
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
    return {
      decision: 'revise',
      feedback: humanResult.feedback || "Human requested changes to the implementation"
    };
  } else {
    log.orchestrator("Human rejected the code changes");
    return { decision: 'reject' };
  }
}

/**
 * Revert the last commit in the given directory
 */
export async function revertLastCommit(cwd: string): Promise<void> {
  try {
    log.orchestrator("Reverting last commit...");
    execSync(`git -C "${cwd}" revert --no-edit HEAD`, { stdio: "inherit" });
  } catch (error) {
    log.warn(`Failed to revert commit: ${error}`);
    // Try to reset if revert fails
    try {
      execSync(`git -C "${cwd}" reset --hard HEAD~1`, { stdio: "inherit" });
      log.orchestrator("Used reset instead of revert");
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
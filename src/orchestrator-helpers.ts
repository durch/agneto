import { log } from "./ui/log.js";
import { execSync } from "child_process";
import chalk from "chalk";
import { runGardener, type GardenerParams } from "./agents/gardener.js";
import type { LLMProvider } from "./providers/index.js";
import type { GardenerResult } from "./types.js";
import type { TaskStateMachine } from "./task-state-machine.js";

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

/**
 * Document task completion by updating CLAUDE.md with reflections
 * This is a non-blocking operation that never throws errors
 */
export async function documentTaskCompletion(
  provider: LLMProvider,
  workingDir: string,
  taskId: string,
  description: string,
  planContent: string,
  taskStateMachine?: TaskStateMachine
): Promise<GardenerResult | null> {
  try {
    const params: GardenerParams = {
      taskId,
      taskDescription: description,
      planSummary: planContent,
      workingDirectory: workingDir,
      taskStateMachine
    };

    const result = await runGardener(provider, params);
    return result;
  } catch (error) {
    // Log errors but never throw - documentation updates should never block task completion
    log.warn(`Failed to update documentation: ${error}`);
    return null;
  }
}

/**
 * Log merge instructions to terminal after task completion
 * Called after UI exits to display copy-pasteable commands
 */
export function logMergeInstructions(taskId: string): void {
  log.setSilent(false); // Ensure stdout is visible
  log.info("\n📋 Task complete! Review the changes before merging:\n");
  log.info(`cd .worktrees/${taskId}`);
  log.info("git log --oneline -5");
  log.info("git diff master --stat");
  log.info("To merge:");
  log.info(`git merge sandbox/${taskId}\n`);
}

/**
 * Log agent usage statistics table to terminal after task completion
 * Displays cost, duration, and token usage per agent with totals
 */
export function logAgentUsageStats(
  stats: Map<string, {
    cost: number;
    duration: number;
    inputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    outputTokens: number;
  }>
): void {
  // Early return if no stats
  if (stats.size === 0) {
    return;
  }

  log.setSilent(false); // Ensure stdout is visible

  // Calculate column widths
  const agentWidth = Math.max(
    10,
    ...Array.from(stats.keys()).map(name => name.length)
  );

  // Format number with commas
  const formatNumber = (num: number): string => {
    return Math.round(num).toLocaleString();
  };

  // Format currency
  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(2)}`;
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Build header
  const header = [
    chalk.bold.cyan('Agent'.padEnd(agentWidth)),
    chalk.bold.cyan('Cost'.padStart(8)),
    chalk.bold.cyan('Duration'.padStart(10)),
    chalk.bold.cyan('Input'.padStart(10)),
    chalk.bold.cyan('Cache Cr'.padStart(10)),
    chalk.bold.cyan('Cache Rd'.padStart(10)),
    chalk.bold.cyan('Output'.padStart(10))
  ].join('  ');

  log.info('\n' + header);
  log.info('─'.repeat(header.length - 20)); // Subtract ANSI code overhead

  // Build rows and calculate totals
  let totalCost = 0;
  let totalDuration = 0;
  let totalInput = 0;
  let totalCacheCr = 0;
  let totalCacheRd = 0;
  let totalOutput = 0;

  for (const [agent, data] of stats) {
    const row = [
      agent.padEnd(agentWidth),
      formatCost(data.cost).padStart(8),
      formatDuration(data.duration).padStart(10),
      formatNumber(data.inputTokens).padStart(10),
      formatNumber(data.cacheCreationTokens).padStart(10),
      formatNumber(data.cacheReadTokens).padStart(10),
      formatNumber(data.outputTokens).padStart(10)
    ].join('  ');

    log.info(row);

    totalCost += data.cost;
    totalDuration += data.duration;
    totalInput += data.inputTokens;
    totalCacheCr += data.cacheCreationTokens;
    totalCacheRd += data.cacheReadTokens;
    totalOutput += data.outputTokens;
  }

  // Totals row
  log.info('─'.repeat(header.length - 20));
  const totalsRow = [
    chalk.bold('TOTAL'.padEnd(agentWidth)),
    chalk.bold(formatCost(totalCost).padStart(8)),
    chalk.bold(formatDuration(totalDuration).padStart(10)),
    chalk.bold(formatNumber(totalInput).padStart(10)),
    chalk.bold(formatNumber(totalCacheCr).padStart(10)),
    chalk.bold(formatNumber(totalCacheRd).padStart(10)),
    chalk.bold(formatNumber(totalOutput).padStart(10))
  ].join('  ');

  log.info(totalsRow);
  log.info(''); // Empty line after table
}
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  TaskCheckpoint,
  TaskStateCheckpoint,
  ExecutionStateCheckpoint,
  BeanCounterCheckpoint,
  SessionCheckpoint,
  FileSystemCheckpoint
} from './types.js';
import { RecoveryService } from './recovery-service.js';
import type { TaskStateMachine } from '../task-state-machine.js';
import type { CoderReviewerStateMachine } from '../state-machine.js';

/**
 * RestorationService - Simplified startup-only restoration system for Agneto
 *
 * AIDEV-NOTE: This service provides startup-only restoration functionality that restores
 * Agneto's execution state from checkpoints. It validates checkpoint compatibility,
 * restores state machines, session contexts, and git working directory state.
 * The simplified approach only supports restoration at startup and discards
 * uncommitted changes for operational safety.
 */
export class RestorationService {
  private recoveryService: RecoveryService;
  private taskId: string;
  private workingDirectory: string;

  constructor(taskId: string, workingDirectory: string = process.cwd()) {
    if (!taskId || typeof taskId !== 'string' || taskId.trim().length === 0) {
      throw new Error('RestorationService requires a valid taskId parameter');
    }

    this.taskId = taskId.trim();
    this.workingDirectory = path.resolve(workingDirectory);
    this.recoveryService = new RecoveryService(this.taskId);
  }

  /**
   * Check if restoration is possible for the current task
   */
  canRestore(): {
    possible: boolean;
    reason?: string;
    latestCheckpoint?: {
      checkpointNumber: number;
      description: string;
      timestamp: string;
    };
  } {
    try {
      // Check if any checkpoints exist
      if (!this.recoveryService.hasCheckpoints()) {
        return {
          possible: false,
          reason: `No checkpoints found for task ${this.taskId}`
        };
      }

      // Find the latest recoverable checkpoint
      const latestRecoverable = this.recoveryService.getLatestRecoverableCheckpoint();
      if (!latestRecoverable) {
        return {
          possible: false,
          reason: 'No recoverable checkpoints available'
        };
      }

      // Validate the checkpoint file exists
      const validation = this.recoveryService.validateCheckpointExists(latestRecoverable.checkpointNumber);
      if (!validation.exists) {
        return {
          possible: false,
          reason: `Latest checkpoint file missing: ${validation.error}`
        };
      }

      return {
        possible: true,
        latestCheckpoint: {
          checkpointNumber: latestRecoverable.checkpointNumber,
          description: latestRecoverable.description,
          timestamp: latestRecoverable.timestamp
        }
      };

    } catch (error) {
      return {
        possible: false,
        reason: `Restoration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate checkpoint compatibility with current Agneto version
   */
  async validateCheckpointCompatibility(checkpoint: TaskCheckpoint): Promise<{
    compatible: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      // Check schema version compatibility
      const checkpointVersion = checkpoint.metadata.version;
      const supportedVersions = ['1.0.0']; // Add supported versions as schema evolves

      if (!supportedVersions.includes(checkpointVersion)) {
        issues.push(`Unsupported checkpoint version: ${checkpointVersion}. Supported versions: ${supportedVersions.join(', ')}`);
      }

      // Validate essential checkpoint structure
      if (!checkpoint.taskState) {
        issues.push('Missing task state data in checkpoint');
      }

      if (!checkpoint.beanCounter) {
        issues.push('Missing Bean Counter data in checkpoint');
      }

      if (!checkpoint.sessions) {
        issues.push('Missing session data in checkpoint');
      }

      if (!checkpoint.fileSystem) {
        issues.push('Missing file system data in checkpoint');
      }

      // Validate task ID compatibility
      if (checkpoint.taskState?.taskId !== this.taskId) {
        issues.push(`Task ID mismatch: checkpoint is for task '${checkpoint.taskState?.taskId}', but attempting restoration for task '${this.taskId}'`);
      }

      // Validate working directory compatibility
      if (checkpoint.taskState?.workingDirectory &&
          path.resolve(checkpoint.taskState.workingDirectory) !== this.workingDirectory) {
        warnings.push(`Working directory mismatch: checkpoint from '${checkpoint.taskState.workingDirectory}', currently in '${this.workingDirectory}'`);
      }

      // Check if checkpoint can be used for recovery
      if (!checkpoint.recovery?.canRecover) {
        issues.push('Checkpoint is marked as non-recoverable');
      }

      // Validate git state compatibility
      if (checkpoint.fileSystem) {
        const gitStateValidation = await this.validateGitStateCompatibility(checkpoint.fileSystem);
        if (!gitStateValidation.compatible) {
          issues.push(...gitStateValidation.issues);
          warnings.push(...gitStateValidation.warnings);
        }
      }

      // Validate session data completeness
      if (checkpoint.sessions) {
        const sessionValidation = this.validateSessionDataCompleteness(checkpoint.sessions);
        if (!sessionValidation.complete) {
          warnings.push(...sessionValidation.warnings);
        }
      }

      return {
        compatible: issues.length === 0,
        issues,
        warnings
      };

    } catch (error) {
      return {
        compatible: false,
        issues: [`Checkpoint validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  /**
   * Validate git state compatibility for restoration
   */
  private async validateGitStateCompatibility(fileSystemCheckpoint: FileSystemCheckpoint): Promise<{
    compatible: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if we're in a git repository
      try {
        execSync('git rev-parse --git-dir', {
          cwd: this.workingDirectory,
          stdio: 'ignore'
        });
      } catch {
        issues.push('Current directory is not a git repository');
        return { compatible: false, issues, warnings };
      }

      // Check if the checkpoint branch exists or can be restored
      const currentBranch = execSync('git branch --show-current', {
        cwd: this.workingDirectory,
        encoding: 'utf8'
      }).trim();

      if (currentBranch !== fileSystemCheckpoint.currentBranch) {
        warnings.push(`Branch mismatch: currently on '${currentBranch}', checkpoint from '${fileSystemCheckpoint.currentBranch}'`);
      }

      // Check if base commit exists in current repository
      try {
        execSync(`git cat-file -e ${fileSystemCheckpoint.baseCommitHash}`, {
          cwd: this.workingDirectory,
          stdio: 'ignore'
        });
      } catch {
        issues.push(`Base commit ${fileSystemCheckpoint.baseCommitHash} not found in current repository`);
      }

      // Check working directory status
      const currentStatus = execSync('git status --porcelain', {
        cwd: this.workingDirectory,
        encoding: 'utf8'
      });

      if (currentStatus.trim()) {
        warnings.push('Working directory has uncommitted changes that will be discarded during restoration');
      }

      return { compatible: issues.length === 0, issues, warnings };

    } catch (error) {
      return {
        compatible: false,
        issues: [`Git state validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  /**
   * Validate session data completeness
   */
  private validateSessionDataCompleteness(sessionCheckpoint: SessionCheckpoint): {
    complete: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check for missing session IDs
    if (!sessionCheckpoint.sessions.beanCounterSessionId) {
      warnings.push('Bean Counter session ID missing - session will be reinitialized');
    }

    if (!sessionCheckpoint.sessions.coderSessionId) {
      warnings.push('Coder session ID missing - session will be reinitialized');
    }

    if (!sessionCheckpoint.sessions.reviewerSessionId) {
      warnings.push('Reviewer session ID missing - session will be reinitialized');
    }

    // Check initialization states
    if (!sessionCheckpoint.initialized.beanCounterInitialized) {
      warnings.push('Bean Counter was not initialized at checkpoint time');
    }

    return {
      complete: warnings.length === 0,
      warnings
    };
  }

  /**
   * Restore complete task state from a checkpoint (atomic operation)
   */
  async restoreFromCheckpoint(checkpointNumber: number): Promise<{
    success: boolean;
    error?: string;
    restoredState?: {
      taskState: TaskStateCheckpoint;
      executionState?: ExecutionStateCheckpoint;
      beanCounterState: BeanCounterCheckpoint;
      sessionState: SessionCheckpoint;
      fileSystemState: FileSystemCheckpoint;
    };
  }> {
    try {
      console.log(`🔄 Starting restoration from checkpoint ${checkpointNumber}...`);

      // Load the checkpoint
      const checkpoint = await this.recoveryService.loadCheckpoint(this.taskId, checkpointNumber);
      if (!checkpoint) {
        return {
          success: false,
          error: `Failed to load checkpoint ${checkpointNumber}`
        };
      }

      // Validate compatibility
      const validation = await this.validateCheckpointCompatibility(checkpoint);
      if (!validation.compatible) {
        return {
          success: false,
          error: `Checkpoint incompatible: ${validation.issues.join(', ')}`
        };
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn(`⚠️ Restoration warnings:\n${validation.warnings.map(w => `  - ${w}`).join('\n')}`);
      }

      // Reset git working directory to checkpoint state (discarding uncommitted changes)
      const gitResetResult = await this.resetGitStateToCheckpoint(checkpoint.fileSystem);
      if (!gitResetResult.success) {
        return {
          success: false,
          error: `Git state reset failed: ${gitResetResult.error}`
        };
      }

      console.log(`✅ Checkpoint ${checkpointNumber} restoration completed successfully`);
      console.log(`📝 Restored state: ${checkpoint.metadata.description}`);
      console.log(`⏰ Checkpoint created: ${new Date(checkpoint.metadata.timestamp).toLocaleString()}`);

      return {
        success: true,
        restoredState: {
          taskState: checkpoint.taskState,
          executionState: checkpoint.executionState,
          beanCounterState: checkpoint.beanCounter,
          sessionState: checkpoint.sessions,
          fileSystemState: checkpoint.fileSystem
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Reset git working directory to checkpoint state (discarding uncommitted changes)
   */
  private async resetGitStateToCheckpoint(fileSystemCheckpoint: FileSystemCheckpoint): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log(`🔄 Resetting git state to checkpoint commit ${fileSystemCheckpoint.baseCommitHash}...`);

      // Stash any uncommitted changes (will be discarded)
      try {
        const statusOutput = execSync('git status --porcelain', {
          cwd: this.workingDirectory,
          encoding: 'utf8'
        });

        if (statusOutput.trim()) {
          console.log('💾 Stashing uncommitted changes before reset...');
          execSync('git stash push -u -m "Pre-restoration stash (will be discarded)"', {
            cwd: this.workingDirectory,
            stdio: 'ignore'
          });
        }
      } catch (stashError) {
        // Non-fatal if stash fails, continue with reset
        console.warn(`⚠️ Could not stash changes: ${stashError instanceof Error ? stashError.message : 'Unknown error'}`);
      }

      // Reset to the base commit (hard reset to discard all changes)
      execSync(`git reset --hard ${fileSystemCheckpoint.baseCommitHash}`, {
        cwd: this.workingDirectory,
        stdio: 'ignore'
      });

      // Apply task commits if any exist
      if (fileSystemCheckpoint.taskCommits.length > 0) {
        console.log(`🔄 Reapplying ${fileSystemCheckpoint.taskCommits.length} task commits...`);

        for (const commit of fileSystemCheckpoint.taskCommits) {
          try {
            // Cherry-pick each commit to restore the exact state
            execSync(`git cherry-pick ${commit.hash}`, {
              cwd: this.workingDirectory,
              stdio: 'ignore'
            });
          } catch (cherryPickError) {
            // If cherry-pick fails, try to continue or abort
            try {
              execSync('git cherry-pick --abort', {
                cwd: this.workingDirectory,
                stdio: 'ignore'
              });
            } catch {
              // Ignore abort errors
            }

            return {
              success: false,
              error: `Failed to cherry-pick commit ${commit.hash}: ${cherryPickError instanceof Error ? cherryPickError.message : 'Unknown error'}`
            };
          }
        }
      }

      // Clean untracked files to match checkpoint state
      execSync('git clean -fd', {
        cwd: this.workingDirectory,
        stdio: 'ignore'
      });

      console.log(`✅ Git state restored to checkpoint state`);
      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Git reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * List available checkpoints for restoration
   */
  getAvailableCheckpoints(): Array<{
    checkpointNumber: number;
    timestamp: string;
    description: string;
    canRecover: boolean;
    trigger: string;
    isCritical?: boolean;
  }> {
    return this.recoveryService.getAvailableCheckpoints();
  }

  /**
   * Get restoration service configuration
   */
  getConfig(): {
    taskId: string;
    workingDirectory: string;
    hasCheckpoints: boolean;
    checkpointsDirectory: string;
  } {
    return {
      taskId: this.taskId,
      workingDirectory: this.workingDirectory,
      hasCheckpoints: this.recoveryService.hasCheckpoints(),
      checkpointsDirectory: this.recoveryService.getCheckpointsDirectory()
    };
  }

  /**
   * Restore task state machine from checkpoint data
   */
  restoreTaskStateMachine(taskStateMachine: TaskStateMachine, checkpoint: TaskStateCheckpoint): {
    success: boolean;
    error?: string;
  } {
    try {
      console.log(`🔄 Restoring task state machine from checkpoint...`);

      // Validate input parameters
      if (!taskStateMachine || !checkpoint) {
        return {
          success: false,
          error: 'Invalid parameters: taskStateMachine and checkpoint are required'
        };
      }

      // Validate task ID compatibility
      if (checkpoint.taskId !== this.taskId) {
        return {
          success: false,
          error: `Task ID mismatch: checkpoint is for task '${checkpoint.taskId}', but attempting restoration for task '${this.taskId}'`
        };
      }

      // Restore refined task if available
      if (checkpoint.refinedTask && checkpoint.taskToUse) {
        // Handle both string and legacy object formats
        let refinedTaskString: string;
        if (typeof checkpoint.refinedTask === 'string') {
          refinedTaskString = checkpoint.refinedTask;
        } else {
          // Legacy object format - extract raw or goal
          refinedTaskString = checkpoint.refinedTask.raw || checkpoint.refinedTask.goal || checkpoint.taskToUse;
        }
        taskStateMachine.setRefinedTask(refinedTaskString, checkpoint.taskToUse);
      }

      // Restore plan data if available
      if (checkpoint.planMd || checkpoint.planPath) {
        taskStateMachine.setPlan(checkpoint.planMd, checkpoint.planPath || '');
      }

      // Restore retry feedback if available
      if (checkpoint.retryFeedback) {
        taskStateMachine.setRetryFeedback(checkpoint.retryFeedback);
      }

      // Restore curmudgeon feedback and simplification count
      if (checkpoint.curmudgeonFeedback) {
        const context = taskStateMachine.getContext();
        context.curmudgeonFeedback = checkpoint.curmudgeonFeedback;
        context.simplificationCount = checkpoint.simplificationCount;
      }

      // Restore super review result if available
      if (checkpoint.superReviewResult) {
        // Cast verdict to proper SuperReviewerVerdict type
        const superReviewResult = {
          ...checkpoint.superReviewResult,
          verdict: checkpoint.superReviewResult.verdict as 'approve' | 'needs-human'
        };
        taskStateMachine.setSuperReviewResult(superReviewResult);
      }

      // Restore error state if present
      if (checkpoint.lastError) {
        const context = taskStateMachine.getContext();
        context.lastError = new Error(checkpoint.lastError.message);
        if (checkpoint.lastError.stack) {
          context.lastError.stack = checkpoint.lastError.stack;
        }
      }

      // Restore state by accessing private state property
      // Note: This uses reflection to set private state - required for restoration
      (taskStateMachine as any).state = checkpoint.currentState;

      console.log(`✅ Task state machine restored to state: ${checkpoint.currentState}`);
      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Task state machine restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Restore execution state machine from checkpoint data
   */
  restoreExecutionStateMachine(executionStateMachine: CoderReviewerStateMachine, checkpoint: ExecutionStateCheckpoint): {
    success: boolean;
    error?: string;
  } {
    try {
      console.log(`🔄 Restoring execution state machine from checkpoint...`);

      // Validate input parameters
      if (!executionStateMachine || !checkpoint) {
        return {
          success: false,
          error: 'Invalid parameters: executionStateMachine and checkpoint are required'
        };
      }

      // Get context to restore properties
      const context = executionStateMachine.getContext();

      // Restore current plan
      if (checkpoint.currentPlan) {
        // Cast type to proper CoderPlanProposal type
        const currentPlan = {
          ...checkpoint.currentPlan,
          type: "PLAN_PROPOSAL" as const
        };
        context.currentPlan = currentPlan;
      }

      // Restore current chunk
      if (checkpoint.currentChunk) {
        context.currentChunk = checkpoint.currentChunk;
      }

      // Restore feedback strings
      if (checkpoint.planFeedback) {
        context.planFeedback = checkpoint.planFeedback;
      }

      if (checkpoint.codeFeedback) {
        context.codeFeedback = checkpoint.codeFeedback;
      }

      // Restore attempt counters
      context.planAttempts = checkpoint.planAttempts;
      context.codeAttempts = checkpoint.codeAttempts;

      // Restore configuration
      context.maxPlanAttempts = checkpoint.maxPlanAttempts;
      context.maxCodeAttempts = checkpoint.maxCodeAttempts;

      // Restore error state if present
      if (checkpoint.lastError) {
        context.lastError = new Error(checkpoint.lastError.message);
        if (checkpoint.lastError.stack) {
          context.lastError.stack = checkpoint.lastError.stack;
        }
      }

      // Restore state by accessing private state property
      // Note: This uses reflection to set private state - required for restoration
      (executionStateMachine as any).state = checkpoint.currentState;

      console.log(`✅ Execution state machine restored to state: ${checkpoint.currentState}`);
      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Execution state machine restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Restore Bean Counter session state from checkpoint data
   */
  restoreBeanCounterSession(sessionId: string, checkpoint: BeanCounterCheckpoint): {
    success: boolean;
    error?: string;
  } {
    try {
      console.log(`🔄 Restoring Bean Counter session: ${sessionId}...`);

      // Validate input parameters
      if (!sessionId || !checkpoint) {
        return {
          success: false,
          error: 'Invalid parameters: sessionId and checkpoint are required'
        };
      }

      // Validate session ID compatibility
      if (checkpoint.sessionId !== sessionId) {
        return {
          success: false,
          error: `Session ID mismatch: checkpoint is for session '${checkpoint.sessionId}', but attempting restoration for session '${sessionId}'`
        };
      }

      // Bean Counter session restoration involves preserving conversational memory
      // The actual session context is maintained by the Claude CLI provider
      // This method validates the checkpoint data and logs the restoration status

      // Validate progress ledger structure
      if (!checkpoint.progressLedger) {
        return {
          success: false,
          error: 'Invalid checkpoint: missing progress ledger'
        };
      }

      if (!Array.isArray(checkpoint.progressLedger.completedChunks)) {
        return {
          success: false,
          error: 'Invalid checkpoint: progress ledger completedChunks must be an array'
        };
      }

      // Validate original plan
      if (!checkpoint.originalPlan || typeof checkpoint.originalPlan !== 'string') {
        return {
          success: false,
          error: 'Invalid checkpoint: missing or invalid original plan'
        };
      }

      // Log progress ledger status
      const completedCount = checkpoint.progressLedger.completedChunks.length;
      const hasCurrentChunk = checkpoint.progressLedger.currentChunk ? 'yes' : 'no';

      console.log(`📊 Bean Counter progress: ${completedCount} completed chunks, current chunk: ${hasCurrentChunk}`);
      console.log(`📋 Session initialized: ${checkpoint.isInitialized ? 'yes' : 'no'}`);

      console.log(`✅ Bean Counter session restoration validated for session: ${sessionId}`);
      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: `Bean Counter session restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Restore agent sessions from checkpoint data
   */
  restoreAgentSessions(checkpoint: SessionCheckpoint): {
    success: boolean;
    error?: string;
    restoredSessions?: {
      beanCounter?: string;
      coder?: string;
      reviewer?: string;
      superReviewer?: string;
    };
  } {
    try {
      console.log(`🔄 Restoring agent sessions from checkpoint...`);

      // Validate input parameters
      if (!checkpoint) {
        return {
          success: false,
          error: 'Invalid parameters: checkpoint is required'
        };
      }

      // Validate checkpoint structure
      if (!checkpoint.sessions || !checkpoint.initialized) {
        return {
          success: false,
          error: 'Invalid checkpoint: missing sessions or initialized data'
        };
      }

      const restoredSessions: {
        beanCounter?: string;
        coder?: string;
        reviewer?: string;
        superReviewer?: string;
      } = {};

      // Restore Bean Counter session
      if (checkpoint.sessions.beanCounterSessionId) {
        restoredSessions.beanCounter = checkpoint.sessions.beanCounterSessionId;
        console.log(`📋 Bean Counter session: ${checkpoint.sessions.beanCounterSessionId} (initialized: ${checkpoint.initialized.beanCounterInitialized})`);
      }

      // Restore Coder session
      if (checkpoint.sessions.coderSessionId) {
        restoredSessions.coder = checkpoint.sessions.coderSessionId;
        console.log(`🤖 Coder session: ${checkpoint.sessions.coderSessionId} (initialized: ${checkpoint.initialized.coderInitialized})`);
      }

      // Restore Reviewer session
      if (checkpoint.sessions.reviewerSessionId) {
        restoredSessions.reviewer = checkpoint.sessions.reviewerSessionId;
        console.log(`👀 Reviewer session: ${checkpoint.sessions.reviewerSessionId} (initialized: ${checkpoint.initialized.reviewerInitialized})`);
      }

      // Restore SuperReviewer session
      if (checkpoint.sessions.superReviewerSessionId) {
        restoredSessions.superReviewer = checkpoint.sessions.superReviewerSessionId;
        console.log(`🔍 SuperReviewer session: ${checkpoint.sessions.superReviewerSessionId} (initialized: ${checkpoint.initialized.superReviewerInitialized})`);
      }

      // Validate tool permissions structure
      if (checkpoint.toolPermissions && typeof checkpoint.toolPermissions === 'object') {
        const permissionCount = Object.keys(checkpoint.toolPermissions).length;
        console.log(`🔧 Tool permissions restored for ${permissionCount} sessions`);
      }

      // Count successfully restored sessions
      const sessionCount = Object.keys(restoredSessions).length;

      if (sessionCount === 0) {
        console.warn(`⚠️ No sessions found in checkpoint - agents will be reinitialized`);
      } else {
        console.log(`✅ Agent sessions restoration completed: ${sessionCount} sessions restored`);
      }

      return {
        success: true,
        restoredSessions
      };

    } catch (error) {
      return {
        success: false,
        error: `Agent sessions restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

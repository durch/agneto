import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import {
  TaskCheckpoint,
  TaskStateCheckpoint,
  ExecutionStateCheckpoint,
  BeanCounterCheckpoint,
  SessionCheckpoint,
  FileSystemCheckpoint,
  CheckpointConfig,
  CheckpointMetadata,
  AuditEvent
} from './types.js';
import type { TaskStateMachine } from '../task-state-machine.js';
import type { CoderReviewerStateMachine } from '../state-machine.js';
import type { LLMProvider } from '../providers/index.js';

/**
 * CheckpointService - Core checkpoint generation functionality for audit-driven recovery
 *
 * AIDEV-NOTE: This service captures comprehensive state snapshots of Agneto's execution
 * at key points (primarily CODE_APPROVED events) to enable complete task recovery.
 * It follows the same graceful error handling patterns as AuditLogger.
 */
export class CheckpointService {
  private config: CheckpointConfig;
  private checkpointNumber: number = 0;
  private metadata: CheckpointMetadata = {} as CheckpointMetadata;
  private checkpointsDir: string;
  private metadataFile: string;

  constructor(taskId: string, workingDirectory: string) {
    // Check if checkpoints are disabled via environment variable
    const isDisabled = process.env.DISABLE_CHECKPOINTS === 'true';

    this.config = {
      checkpointDir: path.join('.agneto', `task-${taskId}`, 'checkpoints'),
      enabled: !isDisabled,
      maxCheckpoints: parseInt(process.env.MAX_CHECKPOINTS || '10'),
      compressionEnabled: process.env.CHECKPOINT_COMPRESSION === 'true',
      namingFormat: (process.env.CHECKPOINT_NAMING as any) || 'hybrid'
    };

    this.checkpointsDir = this.config.checkpointDir;
    this.metadataFile = path.join(this.checkpointsDir, 'metadata.json');

    if (this.config.enabled) {
      this.initializeCheckpointSystem(taskId);
    }
  }

  /**
   * Initialize checkpoint directory structure and metadata
   */
  private initializeCheckpointSystem(taskId: string): void {
    try {
      // Create checkpoints directory
      fs.mkdirSync(this.checkpointsDir, { recursive: true });

      // Create archived directory for compressed checkpoints
      if (this.config.compressionEnabled) {
        fs.mkdirSync(path.join(this.checkpointsDir, 'archived'), { recursive: true });
      }

      // Initialize or load existing metadata
      if (fs.existsSync(this.metadataFile)) {
        try {
          this.metadata = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
          this.checkpointNumber = this.metadata.latestCheckpoint;
        } catch (error) {
          console.warn(`⚠️ Checkpoint metadata corrupted, reinitializing: ${error instanceof Error ? error.message : 'Unknown error'}`);
          this.createNewMetadata(taskId);
        }
      } else {
        this.createNewMetadata(taskId);
      }
    } catch (error) {
      console.warn(`⚠️ Checkpoint initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.config.enabled = false;
    }
  }

  /**
   * Create new checkpoint metadata structure
   */
  private createNewMetadata(taskId: string): void {
    this.metadata = {
      taskId,
      totalCheckpoints: 0,
      latestCheckpoint: 0,
      checkpoints: [],
      retention: {
        maxCheckpoints: this.config.maxCheckpoints,
        compressionEnabled: this.config.compressionEnabled,
        namingFormat: this.config.namingFormat
      },
      schemaVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.saveMetadata();
  }

  /**
   * Create a comprehensive checkpoint capturing all recovery-critical state
   */
  async createCheckpoint(
    trigger: 'CODE_APPROVED' | 'CHUNK_COMPLETE' | 'MANUAL' | 'ERROR_RECOVERY',
    description: string,
    context: {
      taskStateMachine?: TaskStateMachine;
      executionStateMachine?: CoderReviewerStateMachine;
      beanCounterSessionId?: string;
      coderSessionId?: string;
      reviewerSessionId?: string;
      superReviewerSessionId?: string;
      beanCounterInitialized?: boolean;
      coderInitialized?: boolean;
      reviewerInitialized?: boolean;
      superReviewerInitialized?: boolean;
      auditEventsSinceLastCheckpoint?: AuditEvent[];
    } = {}
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      this.checkpointNumber++;
      const timestamp = new Date().toISOString();

      // Build the comprehensive checkpoint
      const checkpoint: TaskCheckpoint = {
        metadata: {
          version: '1.0.0',
          timestamp,
          trigger,
          checkpointNumber: this.checkpointNumber,
          description
        },
        taskState: await this.extractTaskState(context.taskStateMachine),
        executionState: await this.extractExecutionState(context.executionStateMachine),
        beanCounter: await this.extractBeanCounterState(
          context.beanCounterSessionId,
          context.beanCounterInitialized,
          context.taskStateMachine
        ),
        sessions: this.extractSessionState(context),
        fileSystem: await this.extractFileSystemState(),
        auditEventsSinceLastCheckpoint: context.auditEventsSinceLastCheckpoint || [],
        recovery: this.generateRecoveryMetadata(trigger, context.taskStateMachine, context.executionStateMachine)
      };

      // Save checkpoint to file
      const filename = this.generateCheckpointFilename(this.checkpointNumber, timestamp);
      const checkpointPath = path.join(this.checkpointsDir, filename);

      fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

      // Update metadata index
      this.updateCheckpointMetadata(filename, timestamp, trigger, description, checkpoint.recovery.canRecover);

      // Manage retention policy
      await this.manageRetention();

      console.log(`✅ Checkpoint ${this.checkpointNumber} created: ${description}`);
      return true;

    } catch (error) {
      console.warn(`⚠️ Checkpoint creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Extract task state machine context
   */
  private async extractTaskState(taskStateMachine?: TaskStateMachine): Promise<TaskStateCheckpoint> {
    try {
      if (!taskStateMachine) {
        // Return minimal state when machine not available
        return {
          currentState: 'UNKNOWN',
          taskId: 'unknown',
          humanTask: 'unknown',
          workingDirectory: process.cwd(),
          options: {},
          simplificationCount: 0
        };
      }

      // Extract state from task state machine
      // AIDEV-NOTE: These methods should be implemented in TaskStateMachine if not already available
      return {
        currentState: taskStateMachine.getCurrentState?.() || 'UNKNOWN',
        taskId: taskStateMachine.getContext().taskId || 'unknown',
        humanTask: taskStateMachine.getContext().humanTask || 'unknown',
        workingDirectory: taskStateMachine.getContext().workingDirectory || process.cwd(),
        refinedTask: taskStateMachine.getRefinedTask?.(),
        taskToUse: taskStateMachine.getContext().taskToUse,
        planMd: taskStateMachine.getPlanMd?.(),
        planPath: taskStateMachine.getPlanPath?.(),
        options: taskStateMachine.getContext().options || {},
        lastError: taskStateMachine.getLastError?.(),
        retryFeedback: taskStateMachine.getContext().retryFeedback,
        simplificationCount: taskStateMachine.getSimplificationCount?.() || 0,
        curmudgeonFeedback: taskStateMachine.getCurmudgeonFeedback?.(),
        userHasReviewedPlan: taskStateMachine.getUserHasReviewedPlan?.() || false,
        superReviewResult: taskStateMachine.getSuperReviewResult?.()
      };
    } catch (error) {
      console.warn(`⚠️ Task state extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        currentState: 'EXTRACTION_ERROR',
        taskId: 'unknown',
        humanTask: 'unknown',
        workingDirectory: process.cwd(),
        options: {},
        simplificationCount: 0,
        lastError: {
          message: error instanceof Error ? error.message : 'Unknown extraction error',
          stack: error instanceof Error ? error.stack : undefined
        }
      };
    }
  }

  /**
   * Extract execution state machine context
   */
  private async extractExecutionState(executionStateMachine?: CoderReviewerStateMachine): Promise<ExecutionStateCheckpoint | undefined> {
    try {
      if (!executionStateMachine) {
        return undefined;
      }

      // Extract execution state context
      return {
        currentState: executionStateMachine.getCurrentState?.() || 'UNKNOWN',
        currentPlan: executionStateMachine.getCurrentPlan?.(),
        currentChunk: executionStateMachine.getCurrentChunk?.(),
        planFeedback: executionStateMachine.getPlanFeedback?.() ?? undefined,
        codeFeedback: executionStateMachine.getCodeFeedback?.() ?? undefined,
        planAttempts: executionStateMachine.getPlanAttempts?.() || 0,
        codeAttempts: executionStateMachine.getCodeAttempts?.() || 0,
        maxPlanAttempts: executionStateMachine.getContext().maxPlanAttempts || 3,
        maxCodeAttempts: executionStateMachine.getContext().maxCodeAttempts || 3,
        lastError: executionStateMachine.getLastError?.()
      };
    } catch (error) {
      console.warn(`⚠️ Execution state extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        currentState: 'EXTRACTION_ERROR',
        planAttempts: 0,
        codeAttempts: 0,
        maxPlanAttempts: 3,
        maxCodeAttempts: 3,
        lastError: {
          message: error instanceof Error ? error.message : 'Unknown extraction error',
          stack: error instanceof Error ? error.stack : undefined
        }
      };
    }
  }

  /**
   * Extract Bean Counter progress ledger and session data
   */
  private async extractBeanCounterState(
    sessionId?: string,
    isInitialized?: boolean,
    taskStateMachine?: TaskStateMachine
  ): Promise<BeanCounterCheckpoint> {
    try {
      // Get the original plan from task state machine
      const originalPlan = taskStateMachine?.getPlanMd?.() || 'Plan not available';

      // AIDEV-NOTE: In a full implementation, we would extract actual progress ledger
      // from the Bean Counter session or maintained state. For now, we provide the structure.
      return {
        sessionId: sessionId || 'unknown',
        isInitialized: isInitialized || false,
        progressLedger: {
          completedChunks: [], // Would be populated from actual Bean Counter state
          currentChunk: undefined // Would be populated from current work context
        },
        originalPlan
      };
    } catch (error) {
      console.warn(`⚠️ Bean Counter state extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        sessionId: 'extraction-error',
        isInitialized: false,
        progressLedger: {
          completedChunks: []
        },
        originalPlan: 'Extraction failed'
      };
    }
  }

  /**
   * Extract session management state
   */
  private extractSessionState(context: {
    beanCounterSessionId?: string;
    coderSessionId?: string;
    reviewerSessionId?: string;
    superReviewerSessionId?: string;
    beanCounterInitialized?: boolean;
    coderInitialized?: boolean;
    reviewerInitialized?: boolean;
    superReviewerInitialized?: boolean;
  }): SessionCheckpoint {
    return {
      sessions: {
        beanCounterSessionId: context.beanCounterSessionId,
        coderSessionId: context.coderSessionId,
        reviewerSessionId: context.reviewerSessionId,
        superReviewerSessionId: context.superReviewerSessionId
      },
      initialized: {
        beanCounterInitialized: context.beanCounterInitialized || false,
        coderInitialized: context.coderInitialized || false,
        reviewerInitialized: context.reviewerInitialized || false,
        superReviewerInitialized: context.superReviewerInitialized || false
      },
      toolPermissions: {
        // AIDEV-NOTE: Tool permissions would be extracted from provider session state
        // For now, we provide standard permissions based on agent roles
        ...(context.beanCounterSessionId && { [context.beanCounterSessionId]: ['plan'] }),
        ...(context.coderSessionId && { [context.coderSessionId]: ['ReadFile', 'ListDir', 'Grep', 'Bash', 'Write', 'Edit', 'MultiEdit'] }),
        ...(context.reviewerSessionId && { [context.reviewerSessionId]: ['ReadFile', 'Grep', 'Bash'] }),
        ...(context.superReviewerSessionId && { [context.superReviewerSessionId]: ['ReadFile', 'Grep', 'Bash'] })
      }
    };
  }

  /**
   * Extract git and file system state
   */
  private async extractFileSystemState(): Promise<FileSystemCheckpoint> {
    try {
      const workingDirectory = process.cwd();

      // Get current branch
      const currentBranch = execSync('git branch --show-current', {
        cwd: workingDirectory,
        encoding: 'utf8'
      }).trim();

      // Get git status
      const gitStatusOutput = execSync('git status --porcelain', {
        cwd: workingDirectory,
        encoding: 'utf8'
      });

      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      gitStatusOutput.split('\n').forEach(line => {
        if (!line.trim()) return;
        const status = line.substring(0, 2);
        const file = line.substring(3);

        if (status[0] !== ' ' && status[0] !== '?') staged.push(file);
        if (status[1] !== ' ') unstaged.push(file);
        if (status === '??') untracked.push(file);
      });

      // Get base commit hash (assuming we're on a worktree branch)
      let baseCommitHash: string;
      try {
        baseCommitHash = execSync('git merge-base HEAD master', {
          cwd: workingDirectory,
          encoding: 'utf8'
        }).trim();
      } catch {
        // Fallback to current HEAD if merge-base fails
        baseCommitHash = execSync('git rev-parse HEAD', {
          cwd: workingDirectory,
          encoding: 'utf8'
        }).trim();
      }

      // Get commits made during task execution
      const taskCommits: Array<{
        hash: string;
        message: string;
        timestamp: string;
        chunkDescription?: string;
      }> = [];

      try {
        const commitLog = execSync(`git log ${baseCommitHash}..HEAD --pretty=format:"%H|%s|%ai"`, {
          cwd: workingDirectory,
          encoding: 'utf8'
        });

        commitLog.split('\n').forEach(line => {
          if (!line.trim()) return;
          const [hash, message, timestamp] = line.split('|');
          taskCommits.push({
            hash,
            message,
            timestamp,
            chunkDescription: undefined // Could be extracted from commit message
          });
        });
      } catch {
        // No commits since base, which is fine
      }

      // AIDEV-NOTE: Modified files tracking would ideally come from maintained state
      // For now, we use git diff to identify changed files
      const modifiedFiles: Array<{
        path: string;
        operation: 'created' | 'modified' | 'deleted';
        timestamp: string;
        chunkDescription?: string;
      }> = [];

      try {
        const diffOutput = execSync(`git diff --name-status ${baseCommitHash}..HEAD`, {
          cwd: workingDirectory,
          encoding: 'utf8'
        });

        diffOutput.split('\n').forEach(line => {
          if (!line.trim()) return;
          const [status, filePath] = line.split('\t');
          let operation: 'created' | 'modified' | 'deleted';

          switch (status[0]) {
            case 'A': operation = 'created'; break;
            case 'M': operation = 'modified'; break;
            case 'D': operation = 'deleted'; break;
            default: operation = 'modified';
          }

          modifiedFiles.push({
            path: filePath,
            operation,
            timestamp: new Date().toISOString(), // Approximate timestamp
            chunkDescription: undefined
          });
        });
      } catch {
        // No differences found, which is fine
      }

      return {
        currentBranch,
        gitStatus: { staged, unstaged, untracked },
        modifiedFiles,
        workingDirectory,
        baseCommitHash,
        taskCommits
      };

    } catch (error) {
      console.warn(`⚠️ File system state extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        currentBranch: 'unknown',
        gitStatus: { staged: [], unstaged: [], untracked: [] },
        modifiedFiles: [],
        workingDirectory: process.cwd(),
        baseCommitHash: 'unknown',
        taskCommits: []
      };
    }
  }

  /**
   * Generate recovery metadata based on current state
   */
  private generateRecoveryMetadata(
    trigger: string,
    taskStateMachine?: TaskStateMachine,
    executionStateMachine?: CoderReviewerStateMachine
  ): TaskCheckpoint['recovery'] {
    try {
      const currentTaskState = taskStateMachine?.getCurrentState?.();
      const currentExecutionState = executionStateMachine?.getCurrentState?.();

      // Determine if this checkpoint can be used for recovery
      const canRecover = trigger === 'CODE_APPROVED' || trigger === 'CHUNK_COMPLETE';

      // Determine next expected state
      let nextExpectedState: string | undefined;
      if (currentExecutionState === 'CODE_REVIEW' && trigger === 'CODE_APPROVED') {
        nextExpectedState = 'BEAN_COUNTING'; // Next chunk coordination
      } else if (currentTaskState === 'TASK_EXECUTING' && trigger === 'CHUNK_COMPLETE') {
        nextExpectedState = 'TASK_EXECUTING'; // Continue execution
      }

      const recoveryInstructions: string[] = [];
      if (canRecover) {
        recoveryInstructions.push('This checkpoint represents a stable state after successful code approval');
        recoveryInstructions.push('Bean Counter progress ledger can be restored to continue from this point');
        recoveryInstructions.push('All session contexts and file states are captured for seamless continuation');
      }

      return {
        canRecover,
        nextExpectedState,
        recoveryInstructions: recoveryInstructions.length > 0 ? recoveryInstructions : undefined
      };
    } catch (error) {
      return {
        canRecover: false,
        recoveryInstructions: ['Recovery metadata generation failed - manual intervention required']
      };
    }
  }

  /**
   * Generate checkpoint filename based on configured naming format
   */
  private generateCheckpointFilename(checkpointNumber: number, timestamp: string): string {
    const dateStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19);

    switch (this.config.namingFormat) {
      case 'sequential':
        return `checkpoint-${checkpointNumber.toString().padStart(3, '0')}.json`;
      case 'timestamp':
        return `checkpoint-${dateStr}.json`;
      case 'hybrid':
      default:
        return `checkpoint-${checkpointNumber.toString().padStart(3, '0')}-${dateStr}.json`;
    }
  }

  /**
   * Update checkpoint metadata index
   */
  private updateCheckpointMetadata(
    filename: string,
    timestamp: string,
    trigger: string,
    description: string,
    canRecover: boolean
  ): void {
    this.metadata.totalCheckpoints++;
    this.metadata.latestCheckpoint = this.checkpointNumber;
    this.metadata.updatedAt = new Date().toISOString();

    this.metadata.checkpoints.push({
      checkpointNumber: this.checkpointNumber,
      filename,
      timestamp,
      trigger,
      description,
      canRecover,
      isCritical: trigger === 'CODE_APPROVED' || trigger === 'ERROR_RECOVERY'
    });

    this.saveMetadata();
  }

  /**
   * Save metadata to disk
   */
  private saveMetadata(): void {
    try {
      fs.writeFileSync(this.metadataFile, JSON.stringify(this.metadata, null, 2));
    } catch (error) {
      console.warn(`⚠️ Checkpoint metadata save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Manage checkpoint retention policy
   */
  private async manageRetention(): Promise<void> {
    try {
      if (this.metadata.checkpoints.length <= this.config.maxCheckpoints) {
        return; // No cleanup needed
      }

      // Sort checkpoints by number (oldest first)
      const sortedCheckpoints = [...this.metadata.checkpoints].sort((a, b) => a.checkpointNumber - b.checkpointNumber);

      // Keep the most recent maxCheckpoints, but never delete critical ones
      const toDelete = sortedCheckpoints.slice(0, -this.config.maxCheckpoints).filter(cp => !cp.isCritical);

      for (const checkpoint of toDelete) {
        const checkpointPath = path.join(this.checkpointsDir, checkpoint.filename);

        if (this.config.compressionEnabled) {
          // Move to archived directory (compression could be implemented here)
          const archivedPath = path.join(this.checkpointsDir, 'archived', checkpoint.filename);
          if (fs.existsSync(checkpointPath)) {
            fs.renameSync(checkpointPath, archivedPath);
          }
        } else {
          // Delete the file
          if (fs.existsSync(checkpointPath)) {
            fs.unlinkSync(checkpointPath);
          }
        }

        // Remove from metadata
        this.metadata.checkpoints = this.metadata.checkpoints.filter(cp => cp.checkpointNumber !== checkpoint.checkpointNumber);
      }

      if (toDelete.length > 0) {
        this.saveMetadata();
        console.log(`🗑️ Cleaned up ${toDelete.length} old checkpoints`);
      }
    } catch (error) {
      console.warn(`⚠️ Checkpoint retention management failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get checkpoint configuration for debugging
   */
  getConfig(): CheckpointConfig {
    return { ...this.config };
  }

  /**
   * Get current checkpoint metadata
   */
  getMetadata(): CheckpointMetadata {
    return { ...this.metadata };
  }

  /**
   * Get latest checkpoint number
   */
  getLatestCheckpointNumber(): number {
    return this.checkpointNumber;
  }

  /**
   * Check if checkpoints are enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
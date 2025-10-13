/**
 * Audit event types and interfaces for tracking agent interactions
 *
 * AIDEV-NOTE: These types capture the essential data from LogUI interactions
 * without duplicating the complex formatting logic already in place
 */

export interface AuditEvent {
  /** Unique event identifier */
  id: string;

  /** Timestamp in ISO format */
  timestamp: string;

  /** Agent type that generated the event */
  agent: 'planner' | 'coder' | 'reviewer' | 'beanCounter' | 'orchestrator' | 'system';

  /** Event type categorization */
  eventType: 'message' | 'tool_use' | 'tool_result' | 'phase_transition' | 'completion';

  /** Main message content */
  message: string;

  /** Current execution phase */
  phase?: string;

  /** Current chunk number if available */
  chunkNumber?: number;

  /** Current sprint number if available */
  sprintNumber?: number;

  /** Tool usage details if applicable */
  toolInfo?: {
    tool: string;
    input?: any;
    isError?: boolean;
  };

  /** Cost and duration info for completions */
  metrics?: {
    cost: number;
    duration: number;
  };

  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface TaskAuditMetadata {
  /** Task identifier */
  taskId: string;

  /** Task description */
  description: string;

  /** Task start timestamp */
  startTime: string;

  /** Task end timestamp (if completed) */
  endTime?: string;

  /** Task status */
  status: 'active' | 'completed' | 'failed';

  /** Total events captured */
  eventCount: number;

  /** Audit system version */
  auditVersion: string;
}

export interface AuditConfig {
  /** Task ID for organizing audit data */
  taskId: string;

  /** Whether audit is enabled (can be disabled via DISABLE_AUDIT env var) */
  enabled: boolean;

  /** Base directory for audit storage */
  auditDir: string;

  /** Whether to include tool parameters in audit events */
  includeToolParams: boolean;
}

/**
 * CHECKPOINT DATA STRUCTURES
 *
 * Comprehensive checkpoint schema for capturing recovery-critical state
 * from Agneto's two-level state machine architecture and Bean Counter progress ledger.
 *
 * AIDEV-NOTE: These interfaces enable full task recovery by preserving all essential state
 * including Bean Counter conversational memory, state machine contexts, modified files,
 * and session continuity data. Checkpoints are triggered on CODE_APPROVED events to
 * capture stable intermediate states during task execution.
 */

/** Task State Machine checkpoint data - captures parent state machine context */
export interface TaskStateCheckpoint {
  /** Current task state from TaskState enum */
  currentState: string;

  /** Task identification and basic info */
  taskId: string;
  humanTask: string;
  workingDirectory: string;

  /** Refined task data (if refinement occurred) */
  refinedTask?: string | {
    // Support legacy format for backward compatibility
    goal: string;
    context: string;
    constraints: string[];
    successCriteria: string[];
    raw?: string;
  };

  /** Current task description being used (refined or original) */
  taskToUse?: string;

  /** Planning outputs */
  planMd?: string;
  planPath?: string;

  /** Configuration options */
  options: {
    autoMerge?: boolean;
    nonInteractive?: boolean;
  };

  /** Error tracking */
  lastError?: {
    message: string;
    stack?: string;
  };

  /** Retry decision for super review */
  retryFeedback?: string;

  /** Curmudgeon tracking */
  simplificationCount: number;
  curmudgeonFeedback?: string;

  /** User review tracking */
  userHasReviewedPlan?: boolean;

  /** Super review results */
  superReviewResult?: {
    verdict: string;
    summary: string;
    issues?: string[];
  };

  /** Merge instructions generated after task completion */
  mergeInstructions?: string | null;

  /** Clipboard copy status for merge instructions */
  clipboardStatus?: 'success' | 'failed' | null;
}

/** Execution State Machine checkpoint data - captures Bean Counter/Coder/Reviewer loop state */
export interface ExecutionStateCheckpoint {
  /** Current execution state from State enum */
  currentState: string;

  /** Current plan being worked on */
  currentPlan?: {
    type: string;
    description: string;
    steps: string[];
    affectedFiles: string[];
  };

  /** Bean Counter work chunk context */
  currentChunk?: {
    description: string;
    requirements: string[];
    context: string;
  };

  /** Feedback for revisions */
  planFeedback?: string;
  codeFeedback?: string;

  /** Attempt tracking */
  planAttempts: number;
  codeAttempts: number;

  /** Configuration */
  maxPlanAttempts: number;
  maxCodeAttempts: number;

  /** Error information */
  lastError?: {
    message: string;
    stack?: string;
  };
}

/** Bean Counter progress ledger and session data - critical for recovery continuity */
export interface BeanCounterCheckpoint {
  /** Bean Counter session ID for maintaining conversational context */
  sessionId: string;

  /** Whether Bean Counter session has been initialized */
  isInitialized: boolean;

  /** Progress ledger - summary of completed work chunks with approval context */
  progressLedger: {
    completedChunks: Array<{
      description: string;
      requirements: string[];
      context: string;
      approvalMessage: string;
      timestamp: string;
    }>;

    /** Current chunk being worked on */
    currentChunk?: {
      description: string;
      requirements: string[];
      context: string;
      startedAt: string;
    };
  };

  /** High-level plan for Bean Counter reference */
  originalPlan: string;
}

/** Session management state - ensures proper conversation continuity on recovery */
export interface SessionCheckpoint {
  /** All active session IDs */
  sessions: {
    beanCounterSessionId?: string;
    coderSessionId?: string;
    reviewerSessionId?: string;
    superReviewerSessionId?: string;
  };

  /** Session initialization states */
  initialized: {
    beanCounterInitialized: boolean;
    coderInitialized: boolean;
    reviewerInitialized: boolean;
    superReviewerInitialized: boolean;
  };

  /** Tool permissions for each session */
  toolPermissions: {
    [sessionId: string]: string[];
  };
}

/** Git and file system state - captures all modifications and commit history */
export interface FileSystemCheckpoint {
  /** Current git branch */
  currentBranch: string;

  /** Git working directory status */
  gitStatus: {
    staged: string[];
    unstaged: string[];
    untracked: string[];
  };

  /** List of files modified during task execution */
  modifiedFiles: Array<{
    path: string;
    operation: 'created' | 'modified' | 'deleted';
    timestamp: string;
    chunkDescription?: string;
  }>;

  /** Current working directory relative to repo root */
  workingDirectory: string;

  /** Last commit hash before task started */
  baseCommitHash: string;

  /** All commits made during task execution */
  taskCommits: Array<{
    hash: string;
    message: string;
    timestamp: string;
    chunkDescription?: string;
  }>;
}

/**
 * Complete checkpoint data structure - main container for all recovery-critical state
 *
 * This interface represents a complete checkpoint that captures the full state
 * of Agneto's execution at a specific point in time, enabling complete task recovery.
 */
export interface TaskCheckpoint {
  /** Checkpoint metadata */
  metadata: {
    /** Checkpoint version for backward compatibility (semantic versioning) */
    version: string;

    /** Checkpoint creation timestamp in ISO format */
    timestamp: string;

    /** Checkpoint trigger reason */
    trigger: 'CODE_APPROVED' | 'CHUNK_COMPLETE' | 'MANUAL' | 'ERROR_RECOVERY';

    /** Sequential checkpoint number within this task */
    checkpointNumber: number;

    /** Human-readable description of what was just completed */
    description: string;
  };

  /** Task state machine context */
  taskState: TaskStateCheckpoint;

  /** Execution state machine context (null if not in execution phase) */
  executionState?: ExecutionStateCheckpoint;

  /** Bean Counter progress and session data */
  beanCounter: BeanCounterCheckpoint;

  /** Session management state */
  sessions: SessionCheckpoint;

  /** File system and git state */
  fileSystem: FileSystemCheckpoint;

  /** Snapshot of audit events since last checkpoint for debugging */
  auditEventsSinceLastCheckpoint: AuditEvent[];

  /** Recovery metadata */
  recovery: {
    /** Whether this checkpoint can be used for recovery */
    canRecover: boolean;

    /** Next expected state after recovery */
    nextExpectedState?: string;

    /** Recovery instructions for human operators */
    recoveryInstructions?: string[];
  };
}

/** Checkpoint storage configuration */
export interface CheckpointConfig {
  /** Base directory for checkpoint storage (.agneto/task-{id}/checkpoints/) */
  checkpointDir: string;

  /** Whether checkpoints are enabled (can be disabled via env var) */
  enabled: boolean;

  /** Maximum number of checkpoints to retain per task */
  maxCheckpoints: number;

  /** Whether to compress old checkpoints */
  compressionEnabled: boolean;

  /** File naming convention for checkpoints */
  namingFormat: 'sequential' | 'timestamp' | 'hybrid';
}

/**
 * Checkpoint metadata for indexing and management
 *
 * Stored in metadata.json alongside checkpoint files for efficient lookup
 * and management without parsing all checkpoint files.
 */
export interface CheckpointMetadata {
  /** Task identifier */
  taskId: string;

  /** Total number of checkpoints created */
  totalCheckpoints: number;

  /** Latest checkpoint number */
  latestCheckpoint: number;

  /** Checkpoints index with basic info for quick lookup */
  checkpoints: Array<{
    checkpointNumber: number;
    filename: string;
    timestamp: string;
    trigger: string;
    description: string;
    canRecover: boolean;
    isCritical?: boolean;
  }>;

  /** Retention configuration */
  retention: {
    maxCheckpoints: number;
    compressionEnabled: boolean;
    namingFormat: 'sequential' | 'timestamp' | 'hybrid';
  };

  /** Schema version for compatibility */
  schemaVersion: string;

  /** Creation and last update timestamps */
  createdAt: string;
  updatedAt: string;
}

/**
 * CHECKPOINT STORAGE FORMAT SPECIFICATION
 *
 * Directory Structure:
 * .agneto/
 *   task-{id}/
 *     checkpoints/
 *       checkpoint-001.json                    # Sequential format
 *       checkpoint-20241128-143052.json        # Timestamp format
 *       checkpoint-001-20241128-143052.json    # Hybrid format (recommended)
 *       metadata.json                          # CheckpointMetadata index
 *       archived/                              # Compressed old checkpoints
 *         checkpoint-001.json.gz
 *
 * File Naming Conventions:
 * - Sequential: checkpoint-{number:03d}.json (e.g., checkpoint-001.json)
 * - Timestamp: checkpoint-{YYYYMMDD-HHMMSS}.json
 * - Hybrid: checkpoint-{number:03d}-{YYYYMMDD-HHMMSS}.json (recommended)
 *
 * JSON Serialization Format:
 * - Human-readable with 2-space indentation for debugging
 * - Preserves all recovery-critical state information
 * - Error objects serialized with message and stack trace
 * - Consistent property ordering for diff-friendly output
 *
 * Versioning Strategy:
 * - Schema version follows semantic versioning (e.g., "1.0.0")
 * - Backward compatibility maintained for minor version changes
 * - Major version changes may require migration utilities
 * - Version-specific recovery logic handles older checkpoints
 *
 * Retention Policy:
 * - Configurable maximum checkpoints per task (default: 10)
 * - Old checkpoints automatically pruned when limit exceeded
 * - Critical checkpoints (marked in metadata) never auto-pruned
 * - Optional compression for archived checkpoints
 *
 * Checkpoint Triggers:
 * - CODE_APPROVED: After successful code review and commit (primary)
 * - CHUNK_COMPLETE: When Bean Counter marks chunk as done
 * - MANUAL: User-initiated checkpoints for critical states
 * - ERROR_RECOVERY: Before attempting error recovery
 *
 * Recovery Considerations:
 * - Bean Counter session continuity preserved via conversational memory
 * - State machine contexts restored exactly to enable seamless continuation
 * - File system state includes commit history for proper git restoration
 * - Session IDs and initialization states ensure proper tool access
 * - Audit events provide debugging context for recovery troubleshooting
 */
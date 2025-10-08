import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { RestorationService } from '../src/audit/restoration-service.js';
import { TaskStateMachine, TaskState } from '../src/task-state-machine.js';
import { CoderReviewerStateMachine, State } from '../src/state-machine.js';
import type {
  TaskCheckpoint,
  TaskStateCheckpoint,
  ExecutionStateCheckpoint,
  BeanCounterCheckpoint,
  SessionCheckpoint,
  FileSystemCheckpoint
} from '../src/audit/types.js';

// Mock fs module
vi.mock('fs');
const mockFs = vi.mocked(fs);

// Mock child_process
vi.mock('child_process');
const mockExecSync = vi.mocked(execSync);

// Mock console methods to avoid test noise
const mockConsole = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {})
};

describe('RestorationService Integration Tests', () => {
  const mockTaskId = 'test-restoration-task';
  const mockWorkingDirectory = '/test/working/directory';
  let restorationService: RestorationService;

  beforeEach(() => {
    vi.clearAllMocks();
    restorationService = new RestorationService(mockTaskId, mockWorkingDirectory);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to create realistic TaskStateCheckpoint
  const createTaskStateCheckpoint = (overrides: Partial<TaskStateCheckpoint> = {}): TaskStateCheckpoint => ({
    currentState: TaskState.TASK_EXECUTING,
    taskId: mockTaskId,
    humanTask: 'Test implementation task',
    workingDirectory: mockWorkingDirectory,
    options: { interactive: true, autoMerge: false },
    simplificationCount: 0,
    refinedTask: 'Implement comprehensive test coverage for restoration system',
    taskToUse: 'Implement comprehensive test coverage for restoration system',
    planMd: '# Test Plan\n\n1. Create test file\n2. Add test scenarios\n3. Verify coverage',
    planPath: '.agneto/task-test-restoration-task/plans/plan.md',
    retryFeedback: undefined,
    curmudgeonFeedback: 'Plan looks good, proceed with implementation',
    superReviewResult: undefined,
    lastError: undefined,
    ...overrides
  });

  // Helper function to create realistic ExecutionStateCheckpoint
  const createExecutionStateCheckpoint = (overrides: Partial<ExecutionStateCheckpoint> = {}): ExecutionStateCheckpoint => ({
    currentState: State.IMPLEMENTING,
    currentPlan: {
      type: 'PLAN_PROPOSAL',
      description: 'Implement restoration integration tests',
      steps: [
        'Create test file structure',
        'Add comprehensive test scenarios',
        'Mock dependencies properly',
        'Verify restoration functionality'
      ],
      files: ['test/restoration-integration.test.ts']
    },
    currentChunk: {
      chunkNumber: 2,
      description: 'Create comprehensive test scenarios for all restoration paths',
      requirements: [
        'Test complete restoration flow',
        'Test individual component restoration',
        'Test error handling and rollback',
        'Test git state restoration'
      ],
      context: 'Building on existing test infrastructure patterns'
    },
    planFeedback: undefined,
    codeFeedback: undefined,
    planAttempts: 1,
    codeAttempts: 1,
    maxPlanAttempts: 3,
    maxCodeAttempts: 3,
    lastError: undefined,
    ...overrides
  });

  // Helper function to create realistic BeanCounterCheckpoint
  const createBeanCounterCheckpoint = (overrides: Partial<BeanCounterCheckpoint> = {}): BeanCounterCheckpoint => ({
    sessionId: 'bean-counter-session-123',
    isInitialized: true,
    progressLedger: {
      completedChunks: [
        {
          chunkNumber: 1,
          description: 'Set up test file structure and imports',
          completedAt: '2024-01-15T10:30:00.000Z',
          outcome: 'Successfully created test file with proper imports and mocking setup'
        }
      ],
      currentChunk: {
        chunkNumber: 2,
        description: 'Create comprehensive test scenarios for all restoration paths',
        requirements: [
          'Test complete restoration flow',
          'Test individual component restoration',
          'Test error handling and rollback',
          'Test git state restoration'
        ],
        context: 'Building on existing test infrastructure patterns'
      }
    },
    originalPlan: '# Restoration Integration Tests\n\nImplement comprehensive tests for the checkpoint restoration system to verify end-to-end restoration functionality.',
    ...overrides
  });

  // Helper function to create realistic SessionCheckpoint
  const createSessionCheckpoint = (overrides: Partial<SessionCheckpoint> = {}): SessionCheckpoint => ({
    sessions: {
      beanCounterSessionId: 'bean-counter-session-123',
      coderSessionId: 'coder-session-456',
      reviewerSessionId: 'reviewer-session-789',
      superReviewerSessionId: 'super-reviewer-session-012'
    },
    initialized: {
      beanCounterInitialized: true,
      coderInitialized: true,
      reviewerInitialized: true,
      superReviewerInitialized: false
    },
    toolPermissions: {
      'coder-session-456': ['ReadFile', 'Edit', 'Write', 'MultiEdit', 'Bash'],
      'reviewer-session-789': ['ReadFile', 'Grep', 'Bash'],
      'super-reviewer-session-012': ['ReadFile', 'Grep', 'Bash']
    },
    ...overrides
  });

  // Helper function to create realistic FileSystemCheckpoint
  const createFileSystemCheckpoint = (overrides: Partial<FileSystemCheckpoint> = {}): FileSystemCheckpoint => ({
    currentBranch: 'sandbox/test-restoration-task',
    gitStatus: 'clean',
    modifiedFiles: [
      'test/restoration-integration.test.ts'
    ],
    workingDirectory: mockWorkingDirectory,
    baseCommitHash: 'abc123def456',
    taskCommits: [
      {
        hash: 'commit-hash-1',
        message: 'Chunk: Add test file structure and imports',
        author: 'Agneto Coder',
        timestamp: '2024-01-15T10:30:00.000Z'
      }
    ],
    ...overrides
  });

  // Helper function to create complete TaskCheckpoint
  const createCompleteCheckpoint = (overrides: Partial<TaskCheckpoint> = {}): TaskCheckpoint => ({
    metadata: {
      version: '1.0.0',
      timestamp: '2024-01-15T12:00:00.000Z',
      trigger: 'CODE_APPROVED',
      checkpointNumber: 2,
      description: 'Test checkpoint for restoration testing'
    },
    taskState: createTaskStateCheckpoint(),
    executionState: createExecutionStateCheckpoint(),
    beanCounter: createBeanCounterCheckpoint(),
    sessions: createSessionCheckpoint(),
    fileSystem: createFileSystemCheckpoint(),
    recovery: {
      canRecover: true,
      reason: 'Checkpoint created after successful code approval'
    },
    ...overrides
  });

  describe('Complete Restoration Flow', () => {
    it('should successfully restore from a complete checkpoint', async () => {
      // Arrange
      const checkpointNumber = 2;
      const checkpoint = createCompleteCheckpoint();

      // Mock recovery service methods
      const mockRecoveryService = restorationService['recoveryService'];
      vi.spyOn(mockRecoveryService, 'hasCheckpoints').mockReturnValue(true);
      vi.spyOn(mockRecoveryService, 'getLatestRecoverableCheckpoint').mockReturnValue({
        checkpointNumber: 2,
        description: 'Test checkpoint for restoration testing',
        timestamp: '2024-01-15T12:00:00.000Z'
      });
      vi.spyOn(mockRecoveryService, 'validateCheckpointExists').mockReturnValue({
        exists: true,
        error: undefined
      });
      vi.spyOn(mockRecoveryService, 'loadCheckpoint').mockResolvedValue(checkpoint);

      // Mock git operations
      mockExecSync
        .mockReturnValueOnce('') // git rev-parse --git-dir
        .mockReturnValueOnce('sandbox/test-restoration-task') // git branch --show-current
        .mockReturnValueOnce('') // git cat-file -e (commit exists)
        .mockReturnValueOnce('') // git status --porcelain (clean)
        .mockReturnValueOnce('') // git status --porcelain (for stash check)
        .mockReturnValueOnce('') // git reset --hard
        .mockReturnValueOnce('') // git cherry-pick
        .mockReturnValueOnce(''); // git clean -fd

      // Act
      const result = await restorationService.restoreFromCheckpoint(checkpointNumber);

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.restoredState).toBeDefined();
      expect(result.restoredState?.taskState.taskId).toBe(mockTaskId);
      expect(result.restoredState?.beanCounterState.sessionId).toBe('bean-counter-session-123');
      expect(result.restoredState?.sessionState.sessions.coderSessionId).toBe('coder-session-456');
      expect(result.restoredState?.fileSystemState.currentBranch).toBe('sandbox/test-restoration-task');

      // Verify git operations were called in correct order
      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --git-dir', expect.any(Object));
      expect(mockExecSync).toHaveBeenCalledWith('git reset --hard abc123def456', expect.any(Object));
      expect(mockExecSync).toHaveBeenCalledWith('git cherry-pick commit-hash-1', expect.any(Object));
      expect(mockExecSync).toHaveBeenCalledWith('git clean -fd', expect.any(Object));
    });

    it('should handle restoration failure with proper error reporting', async () => {
      // Arrange
      const checkpointNumber = 2;

      // Mock recovery service to fail loading
      const mockRecoveryService = restorationService['recoveryService'];
      vi.spyOn(mockRecoveryService, 'hasCheckpoints').mockReturnValue(true);
      vi.spyOn(mockRecoveryService, 'getLatestRecoverableCheckpoint').mockReturnValue({
        checkpointNumber: 2,
        description: 'Test checkpoint',
        timestamp: '2024-01-15T12:00:00.000Z'
      });
      vi.spyOn(mockRecoveryService, 'validateCheckpointExists').mockReturnValue({
        exists: true,
        error: undefined
      });
      vi.spyOn(mockRecoveryService, 'loadCheckpoint').mockResolvedValue(null);

      // Act
      const result = await restorationService.restoreFromCheckpoint(checkpointNumber);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to load checkpoint 2');
      expect(result.restoredState).toBeUndefined();
    });
  });

  describe('Task State Machine Restoration', () => {
    it('should successfully restore task state machine with complete state', () => {
      // Arrange
      const taskStateMachine = new TaskStateMachine(mockTaskId, 'Test task', mockWorkingDirectory, {});
      const taskStateCheckpoint = createTaskStateCheckpoint({
        currentState: TaskState.TASK_EXECUTING,
        refinedTask: 'Refined task description',
        taskToUse: 'Refined task description',
        planMd: '# Test Plan\n\nDetailed implementation plan',
        retryFeedback: 'Previous attempt needed more detail',
        curmudgeonFeedback: 'Plan is acceptable but could be simpler',
        simplificationCount: 1
      });

      // Act
      const result = restorationService.restoreTaskStateMachine(taskStateMachine, taskStateCheckpoint);

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify state was restored (using reflection to check private state)
      expect((taskStateMachine as any).state).toBe(TaskState.TASK_EXECUTING);

      // Verify context was restored
      const context = taskStateMachine.getContext();
      expect(context.refinedTask).toBe('Refined task description');
      expect(context.taskToUse).toBe('Refined task description');
      expect(context.planMd).toBe('# Test Plan\n\nDetailed implementation plan');
      expect(context.retryFeedback).toBe('Previous attempt needed more detail');
      expect(context.curmudgeonFeedback).toBe('Plan is acceptable but could be simpler');
      expect(context.simplificationCount).toBe(1);
    });

    it('should handle task ID mismatch in restoration', () => {
      // Arrange
      const taskStateMachine = new TaskStateMachine(mockTaskId, 'Test task', mockWorkingDirectory, {});
      const taskStateCheckpoint = createTaskStateCheckpoint({
        taskId: 'different-task-id'
      });

      // Act
      const result = restorationService.restoreTaskStateMachine(taskStateMachine, taskStateCheckpoint);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Task ID mismatch');
      expect(result.error).toContain('different-task-id');
      expect(result.error).toContain(mockTaskId);
    });

    it('should handle restoration with error state', () => {
      // Arrange
      const taskStateMachine = new TaskStateMachine(mockTaskId, 'Test task', mockWorkingDirectory, {});
      const taskStateCheckpoint = createTaskStateCheckpoint({
        lastError: {
          message: 'Previous execution failed',
          stack: 'Error stack trace here'
        }
      });

      // Act
      const result = restorationService.restoreTaskStateMachine(taskStateMachine, taskStateCheckpoint);

      // Assert
      expect(result.success).toBe(true);

      // Verify error was restored
      const context = taskStateMachine.getContext();
      expect(context.lastError).toBeInstanceOf(Error);
      expect(context.lastError?.message).toBe('Previous execution failed');
      expect(context.lastError?.stack).toBe('Error stack trace here');
    });
  });

  describe('Execution State Machine Restoration', () => {
    it('should successfully restore execution state machine with complete context', () => {
      // Arrange
      const executionStateMachine = new CoderReviewerStateMachine();
      const executionStateCheckpoint = createExecutionStateCheckpoint({
        currentState: State.CODE_REVIEW,
        currentPlan: {
          type: 'PLAN_PROPOSAL',
          description: 'Implement feature X',
          steps: ['Step 1', 'Step 2', 'Step 3'],
          files: ['src/feature.ts', 'test/feature.test.ts']
        },
        currentChunk: {
          chunkNumber: 3,
          description: 'Final implementation chunk',
          requirements: ['Requirement 1', 'Requirement 2'],
          context: 'Completing the feature implementation'
        },
        planFeedback: 'Plan looks good overall',
        codeFeedback: 'Code needs minor adjustments',
        planAttempts: 2,
        codeAttempts: 1,
        maxPlanAttempts: 3,
        maxCodeAttempts: 3
      });

      // Act
      const result = restorationService.restoreExecutionStateMachine(executionStateMachine, executionStateCheckpoint);

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify state was restored
      expect((executionStateMachine as any).state).toBe(State.CODE_REVIEW);

      // Verify context was restored
      const context = executionStateMachine.getContext();
      expect(context.currentPlan?.description).toBe('Implement feature X');
      expect(context.currentPlan?.steps).toEqual(['Step 1', 'Step 2', 'Step 3']);
      expect(context.currentChunk?.chunkNumber).toBe(3);
      expect(context.currentChunk?.description).toBe('Final implementation chunk');
      expect(context.planFeedback).toBe('Plan looks good overall');
      expect(context.codeFeedback).toBe('Code needs minor adjustments');
      expect(context.planAttempts).toBe(2);
      expect(context.codeAttempts).toBe(1);
      expect(context.maxPlanAttempts).toBe(3);
      expect(context.maxCodeAttempts).toBe(3);
    });

    it('should handle restoration with missing required data', () => {
      // Arrange
      const executionStateMachine = new CoderReviewerStateMachine();

      // Act & Assert - should handle null checkpoint gracefully
      const result = restorationService.restoreExecutionStateMachine(executionStateMachine, null as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
    });

    it('should restore execution state with error context', () => {
      // Arrange
      const executionStateMachine = new CoderReviewerStateMachine();
      const executionStateCheckpoint = createExecutionStateCheckpoint({
        lastError: {
          message: 'Code compilation failed',
          stack: 'TypeScript error stack'
        }
      });

      // Act
      const result = restorationService.restoreExecutionStateMachine(executionStateMachine, executionStateCheckpoint);

      // Assert
      expect(result.success).toBe(true);

      // Verify error was restored
      const context = executionStateMachine.getContext();
      expect(context.lastError).toBeInstanceOf(Error);
      expect(context.lastError?.message).toBe('Code compilation failed');
      expect(context.lastError?.stack).toBe('TypeScript error stack');
    });
  });

  describe('Bean Counter Session Restoration', () => {
    it('should successfully restore Bean Counter session with progress ledger', () => {
      // Arrange
      const sessionId = 'bean-counter-session-123';
      const beanCounterCheckpoint = createBeanCounterCheckpoint({
        sessionId,
        isInitialized: true,
        progressLedger: {
          completedChunks: [
            {
              chunkNumber: 1,
              description: 'First chunk completed',
              completedAt: '2024-01-15T10:00:00.000Z',
              outcome: 'Successfully implemented initial structure'
            },
            {
              chunkNumber: 2,
              description: 'Second chunk completed',
              completedAt: '2024-01-15T11:00:00.000Z',
              outcome: 'Added core functionality'
            }
          ],
          currentChunk: {
            chunkNumber: 3,
            description: 'Current chunk in progress',
            requirements: ['Add tests', 'Update documentation'],
            context: 'Final implementation phase'
          }
        }
      });

      // Act
      const result = restorationService.restoreBeanCounterSession(sessionId, beanCounterCheckpoint);

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle session ID mismatch', () => {
      // Arrange
      const sessionId = 'bean-counter-session-123';
      const beanCounterCheckpoint = createBeanCounterCheckpoint({
        sessionId: 'different-session-id'
      });

      // Act
      const result = restorationService.restoreBeanCounterSession(sessionId, beanCounterCheckpoint);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session ID mismatch');
      expect(result.error).toContain('different-session-id');
      expect(result.error).toContain('bean-counter-session-123');
    });

    it('should validate progress ledger structure', () => {
      // Arrange
      const sessionId = 'bean-counter-session-123';
      const beanCounterCheckpoint = createBeanCounterCheckpoint({
        progressLedger: undefined as any
      });

      // Act
      const result = restorationService.restoreBeanCounterSession(sessionId, beanCounterCheckpoint);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing progress ledger');
    });

    it('should validate original plan presence', () => {
      // Arrange
      const sessionId = 'bean-counter-session-123';
      const beanCounterCheckpoint = createBeanCounterCheckpoint({
        originalPlan: undefined as any
      });

      // Act
      const result = restorationService.restoreBeanCounterSession(sessionId, beanCounterCheckpoint);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing or invalid original plan');
    });
  });

  describe('Agent Session Restoration', () => {
    it('should successfully restore all agent sessions', () => {
      // Arrange
      const sessionCheckpoint = createSessionCheckpoint({
        sessions: {
          beanCounterSessionId: 'bean-session-123',
          coderSessionId: 'coder-session-456',
          reviewerSessionId: 'reviewer-session-789',
          superReviewerSessionId: 'super-session-012'
        },
        initialized: {
          beanCounterInitialized: true,
          coderInitialized: true,
          reviewerInitialized: true,
          superReviewerInitialized: true
        },
        toolPermissions: {
          'coder-session-456': ['ReadFile', 'Edit', 'Write', 'Bash'],
          'reviewer-session-789': ['ReadFile', 'Grep', 'Bash'],
          'super-session-012': ['ReadFile', 'Grep', 'Bash']
        }
      });

      // Act
      const result = restorationService.restoreAgentSessions(sessionCheckpoint);

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.restoredSessions).toBeDefined();
      expect(result.restoredSessions?.beanCounter).toBe('bean-session-123');
      expect(result.restoredSessions?.coder).toBe('coder-session-456');
      expect(result.restoredSessions?.reviewer).toBe('reviewer-session-789');
      expect(result.restoredSessions?.superReviewer).toBe('super-session-012');
    });

    it('should handle missing session data gracefully', () => {
      // Arrange
      const sessionCheckpoint = createSessionCheckpoint({
        sessions: {
          beanCounterSessionId: undefined,
          coderSessionId: undefined,
          reviewerSessionId: undefined,
          superReviewerSessionId: undefined
        }
      });

      // Act
      const result = restorationService.restoreAgentSessions(sessionCheckpoint);

      // Assert
      expect(result.success).toBe(true);
      expect(result.restoredSessions).toBeDefined();
      expect(Object.keys(result.restoredSessions!)).toHaveLength(0);
    });

    it('should validate checkpoint structure', () => {
      // Act
      const result = restorationService.restoreAgentSessions(null as any);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters: checkpoint is required');
    });
  });

  describe('Restoration Capability Checks', () => {
    it('should correctly identify when restoration is possible', () => {
      // Arrange
      const mockRecoveryService = restorationService['recoveryService'];
      vi.spyOn(mockRecoveryService, 'hasCheckpoints').mockReturnValue(true);
      vi.spyOn(mockRecoveryService, 'getLatestRecoverableCheckpoint').mockReturnValue({
        checkpointNumber: 3,
        description: 'Latest recoverable checkpoint',
        timestamp: '2024-01-15T14:00:00.000Z'
      });
      vi.spyOn(mockRecoveryService, 'validateCheckpointExists').mockReturnValue({
        exists: true,
        error: undefined
      });

      // Act
      const result = restorationService.canRestore();

      // Assert
      expect(result.possible).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.latestCheckpoint).toBeDefined();
      expect(result.latestCheckpoint?.checkpointNumber).toBe(3);
      expect(result.latestCheckpoint?.description).toBe('Latest recoverable checkpoint');
    });

    it('should identify when no checkpoints exist', () => {
      // Arrange
      const mockRecoveryService = restorationService['recoveryService'];
      vi.spyOn(mockRecoveryService, 'hasCheckpoints').mockReturnValue(false);

      // Act
      const result = restorationService.canRestore();

      // Assert
      expect(result.possible).toBe(false);
      expect(result.reason).toContain('No checkpoints found');
      expect(result.latestCheckpoint).toBeUndefined();
    });

    it('should identify when checkpoint file is missing', () => {
      // Arrange
      const mockRecoveryService = restorationService['recoveryService'];
      vi.spyOn(mockRecoveryService, 'hasCheckpoints').mockReturnValue(true);
      vi.spyOn(mockRecoveryService, 'getLatestRecoverableCheckpoint').mockReturnValue({
        checkpointNumber: 2,
        description: 'Test checkpoint',
        timestamp: '2024-01-15T12:00:00.000Z'
      });
      vi.spyOn(mockRecoveryService, 'validateCheckpointExists').mockReturnValue({
        exists: false,
        error: 'File not found: checkpoint-002.json'
      });

      // Act
      const result = restorationService.canRestore();

      // Assert
      expect(result.possible).toBe(false);
      expect(result.reason).toContain('Latest checkpoint file missing');
      expect(result.reason).toContain('File not found: checkpoint-002.json');
    });
  });

  describe('Checkpoint Compatibility Validation', () => {
    it('should validate compatible checkpoint successfully', async () => {
      // Arrange
      const checkpoint = createCompleteCheckpoint({
        metadata: {
          version: '1.0.0',
          timestamp: '2024-01-15T12:00:00.000Z',
          trigger: 'CODE_APPROVED',
          checkpointNumber: 2,
          description: 'Compatible test checkpoint'
        }
      });

      // Mock git operations for compatibility check
      mockExecSync
        .mockReturnValueOnce('') // git rev-parse --git-dir
        .mockReturnValueOnce('sandbox/test-restoration-task') // git branch --show-current
        .mockReturnValueOnce('') // git cat-file -e (commit exists)
        .mockReturnValueOnce(''); // git status --porcelain

      // Act
      const result = await restorationService.validateCheckpointCompatibility(checkpoint);

      // Assert
      expect(result.compatible).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect unsupported checkpoint version', async () => {
      // Arrange
      const checkpoint = createCompleteCheckpoint({
        metadata: {
          version: '2.0.0', // Unsupported version
          timestamp: '2024-01-15T12:00:00.000Z',
          trigger: 'CODE_APPROVED',
          checkpointNumber: 2,
          description: 'Incompatible version checkpoint'
        }
      });

      // Act
      const result = await restorationService.validateCheckpointCompatibility(checkpoint);

      // Assert
      expect(result.compatible).toBe(false);
      expect(result.issues).toContain('Unsupported checkpoint version: 2.0.0. Supported versions: 1.0.0');
    });

    it('should detect task ID mismatch', async () => {
      // Arrange
      const checkpoint = createCompleteCheckpoint({
        taskState: createTaskStateCheckpoint({
          taskId: 'different-task-id'
        })
      });

      // Act
      const result = await restorationService.validateCheckpointCompatibility(checkpoint);

      // Assert
      expect(result.compatible).toBe(false);
      expect(result.issues.some(issue => issue.includes('Task ID mismatch'))).toBe(true);
    });

    it('should detect missing checkpoint structure', async () => {
      // Arrange
      const checkpoint = createCompleteCheckpoint({
        taskState: undefined as any
      });

      // Act
      const result = await restorationService.validateCheckpointCompatibility(checkpoint);

      // Assert
      expect(result.compatible).toBe(false);
      expect(result.issues).toContain('Missing task state data in checkpoint');
    });

    it('should warn about working directory mismatch', async () => {
      // Arrange
      const checkpoint = createCompleteCheckpoint({
        taskState: createTaskStateCheckpoint({
          workingDirectory: '/different/working/directory'
        })
      });

      // Mock git operations
      mockExecSync
        .mockReturnValueOnce('') // git rev-parse --git-dir
        .mockReturnValueOnce('sandbox/test-restoration-task') // git branch --show-current
        .mockReturnValueOnce('') // git cat-file -e
        .mockReturnValueOnce(''); // git status --porcelain

      // Act
      const result = await restorationService.validateCheckpointCompatibility(checkpoint);

      // Assert
      expect(result.compatible).toBe(true);
      expect(result.warnings.some(warning => warning.includes('Working directory mismatch'))).toBe(true);
    });
  });

  describe('Git State Restoration', () => {
    it('should handle git reset with uncommitted changes', async () => {
      // Arrange
      const checkpointNumber = 2;
      const checkpoint = createCompleteCheckpoint();

      const mockRecoveryService = restorationService['recoveryService'];
      vi.spyOn(mockRecoveryService, 'hasCheckpoints').mockReturnValue(true);
      vi.spyOn(mockRecoveryService, 'getLatestRecoverableCheckpoint').mockReturnValue({
        checkpointNumber: 2,
        description: 'Test checkpoint',
        timestamp: '2024-01-15T12:00:00.000Z'
      });
      vi.spyOn(mockRecoveryService, 'validateCheckpointExists').mockReturnValue({
        exists: true,
        error: undefined
      });
      vi.spyOn(mockRecoveryService, 'loadCheckpoint').mockResolvedValue(checkpoint);

      // Mock git operations with uncommitted changes
      mockExecSync
        .mockReturnValueOnce('') // git rev-parse --git-dir
        .mockReturnValueOnce('sandbox/test-restoration-task') // git branch --show-current
        .mockReturnValueOnce('') // git cat-file -e
        .mockReturnValueOnce('') // git status --porcelain (compatibility check)
        .mockReturnValueOnce('M  src/file.ts\n?? temp.txt') // git status --porcelain (stash check)
        .mockReturnValueOnce('') // git stash push
        .mockReturnValueOnce('') // git reset --hard
        .mockReturnValueOnce('') // git cherry-pick
        .mockReturnValueOnce(''); // git clean -fd

      // Act
      const result = await restorationService.restoreFromCheckpoint(checkpointNumber);

      // Assert
      expect(result.success).toBe(true);

      // Verify stash operation was called due to uncommitted changes
      expect(mockExecSync).toHaveBeenCalledWith(
        'git stash push -u -m "Pre-restoration stash (will be discarded)"',
        expect.any(Object)
      );
    });

    it('should handle cherry-pick failure with proper rollback', async () => {
      // Arrange
      const checkpointNumber = 2;
      const checkpoint = createCompleteCheckpoint({
        fileSystem: createFileSystemCheckpoint({
          taskCommits: [
            {
              hash: 'failing-commit-hash',
              message: 'Commit that will fail to cherry-pick',
              author: 'Test Author',
              timestamp: '2024-01-15T11:00:00.000Z'
            }
          ]
        })
      });

      const mockRecoveryService = restorationService['recoveryService'];
      vi.spyOn(mockRecoveryService, 'hasCheckpoints').mockReturnValue(true);
      vi.spyOn(mockRecoveryService, 'getLatestRecoverableCheckpoint').mockReturnValue({
        checkpointNumber: 2,
        description: 'Test checkpoint',
        timestamp: '2024-01-15T12:00:00.000Z'
      });
      vi.spyOn(mockRecoveryService, 'validateCheckpointExists').mockReturnValue({
        exists: true,
        error: undefined
      });
      vi.spyOn(mockRecoveryService, 'loadCheckpoint').mockResolvedValue(checkpoint);

      // Mock git operations with cherry-pick failure
      mockExecSync
        .mockReturnValueOnce('') // git rev-parse --git-dir
        .mockReturnValueOnce('sandbox/test-restoration-task') // git branch --show-current
        .mockReturnValueOnce('') // git cat-file -e
        .mockReturnValueOnce('') // git status --porcelain (compatibility check)
        .mockReturnValueOnce('') // git status --porcelain (stash check)
        .mockReturnValueOnce('') // git reset --hard
        .mockImplementationOnce(() => { // git cherry-pick (fails)
          throw new Error('Cherry-pick failed: merge conflict');
        })
        .mockReturnValueOnce(''); // git cherry-pick --abort

      // Act
      const result = await restorationService.restoreFromCheckpoint(checkpointNumber);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to cherry-pick commit failing-commit-hash');
      expect(result.error).toContain('Cherry-pick failed: merge conflict');

      // Verify abort was called
      expect(mockExecSync).toHaveBeenCalledWith('git cherry-pick --abort', expect.any(Object));
    });

    it('should detect missing base commit', async () => {
      // Arrange
      const checkpoint = createCompleteCheckpoint({
        fileSystem: createFileSystemCheckpoint({
          baseCommitHash: 'missing-commit-hash'
        })
      });

      // Mock git operations with missing commit
      mockExecSync
        .mockReturnValueOnce('') // git rev-parse --git-dir
        .mockReturnValueOnce('sandbox/test-restoration-task') // git branch --show-current
        .mockImplementationOnce(() => { // git cat-file -e (fails)
          throw new Error('Commit not found');
        })
        .mockReturnValueOnce(''); // git status --porcelain

      // Act
      const result = await restorationService.validateCheckpointCompatibility(checkpoint);

      // Assert
      expect(result.compatible).toBe(false);
      expect(result.issues.some(issue =>
        issue.includes('Base commit missing-commit-hash not found')
      )).toBe(true);
    });
  });

  describe('Configuration and Metadata', () => {
    it('should return correct restoration service configuration', () => {
      // Arrange
      const mockRecoveryService = restorationService['recoveryService'];
      vi.spyOn(mockRecoveryService, 'hasCheckpoints').mockReturnValue(true);
      vi.spyOn(mockRecoveryService, 'getCheckpointsDirectory').mockReturnValue('.agneto/task-test-restoration-task/checkpoints');

      // Act
      const config = restorationService.getConfig();

      // Assert
      expect(config.taskId).toBe(mockTaskId);
      expect(config.workingDirectory).toBe(mockWorkingDirectory);
      expect(config.hasCheckpoints).toBe(true);
      expect(config.checkpointsDirectory).toBe('.agneto/task-test-restoration-task/checkpoints');
    });

    it('should return available checkpoints list', () => {
      // Arrange
      const mockCheckpoints = [
        {
          checkpointNumber: 1,
          timestamp: '2024-01-15T10:00:00.000Z',
          description: 'First checkpoint',
          canRecover: true,
          trigger: 'CHUNK_COMPLETE',
          isCritical: false
        },
        {
          checkpointNumber: 2,
          timestamp: '2024-01-15T12:00:00.000Z',
          description: 'Second checkpoint',
          canRecover: true,
          trigger: 'CODE_APPROVED',
          isCritical: true
        }
      ];

      const mockRecoveryService = restorationService['recoveryService'];
      vi.spyOn(mockRecoveryService, 'getAvailableCheckpoints').mockReturnValue(mockCheckpoints);

      // Act
      const checkpoints = restorationService.getAvailableCheckpoints();

      // Assert
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].checkpointNumber).toBe(1);
      expect(checkpoints[0].description).toBe('First checkpoint');
      expect(checkpoints[1].isCritical).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid task ID in constructor', () => {
      // Act & Assert
      expect(() => new RestorationService('')).toThrow('RestorationService requires a valid taskId parameter');
      expect(() => new RestorationService('   ')).toThrow('RestorationService requires a valid taskId parameter');
      expect(() => new RestorationService(null as any)).toThrow('RestorationService requires a valid taskId parameter');
    });

    it('should handle git repository validation failure', async () => {
      // Arrange
      const checkpoint = createCompleteCheckpoint();

      // Mock git operation to fail (not a git repository)
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('Not a git repository');
      });

      // Act
      const result = await restorationService.validateCheckpointCompatibility(checkpoint);

      // Assert
      expect(result.compatible).toBe(false);
      expect(result.issues).toContain('Current directory is not a git repository');
    });

    it('should handle checkpoint loading exceptions', async () => {
      // Arrange
      const checkpointNumber = 2;

      const mockRecoveryService = restorationService['recoveryService'];
      vi.spyOn(mockRecoveryService, 'hasCheckpoints').mockReturnValue(true);
      vi.spyOn(mockRecoveryService, 'getLatestRecoverableCheckpoint').mockReturnValue({
        checkpointNumber: 2,
        description: 'Test checkpoint',
        timestamp: '2024-01-15T12:00:00.000Z'
      });
      vi.spyOn(mockRecoveryService, 'validateCheckpointExists').mockReturnValue({
        exists: true,
        error: undefined
      });
      vi.spyOn(mockRecoveryService, 'loadCheckpoint').mockRejectedValue(new Error('File system error'));

      // Act
      const result = await restorationService.restoreFromCheckpoint(checkpointNumber);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Restoration failed: File system error');
    });

    it('should handle session restoration with invalid parameters', () => {
      // Act & Assert - Test null session ID
      const result1 = restorationService.restoreBeanCounterSession('', createBeanCounterCheckpoint());
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Invalid parameters');

      // Act & Assert - Test null checkpoint
      const result2 = restorationService.restoreBeanCounterSession('valid-session-id', null as any);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Invalid parameters');
    });
  });
});
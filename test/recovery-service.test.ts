import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { RecoveryService } from '../src/audit/recovery-service.js';
import type { CheckpointMetadata, TaskCheckpoint } from '../src/audit/types.js';

// Mock fs module
vi.mock('fs');
const mockFs = vi.mocked(fs);

describe('RecoveryService', () => {
  const mockTaskId = 'test-task-123';
  const mockCheckpointsDir = path.join('.agneto', `task-${mockTaskId}`, 'checkpoints');
  const mockMetadataFile = path.join(mockCheckpointsDir, 'metadata.json');

  // Mock console.warn to avoid cluttering test output
  let mockConsoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh console.warn mock for each test
    mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to create mock metadata
  const createMockMetadata = (overrides: Partial<CheckpointMetadata> = {}): CheckpointMetadata => ({
    taskId: mockTaskId,
    totalCheckpoints: 3,
    latestCheckpoint: 3,
    checkpoints: [
      {
        checkpointNumber: 1,
        filename: 'checkpoint-001.json',
        timestamp: '2024-01-15T10:00:00.000Z',
        trigger: 'CHUNK_COMPLETE',
        description: 'First checkpoint',
        canRecover: true,
        isCritical: false
      },
      {
        checkpointNumber: 2,
        filename: 'checkpoint-002.json',
        timestamp: '2024-01-15T11:00:00.000Z',
        trigger: 'CODE_APPROVED',
        description: 'Second checkpoint',
        canRecover: true,
        isCritical: true
      },
      {
        checkpointNumber: 3,
        filename: 'checkpoint-003.json',
        timestamp: '2024-01-15T12:00:00.000Z',
        trigger: 'MANUAL',
        description: 'Latest checkpoint',
        canRecover: false,
        isCritical: false
      }
    ],
    ...overrides
  });

  // Helper function to create mock checkpoint data
  const createMockCheckpoint = (): TaskCheckpoint => ({
    metadata: {
      version: '1.0.0',
      timestamp: '2024-01-15T10:00:00.000Z',
      trigger: 'CODE_APPROVED',
      checkpointNumber: 1,
      description: 'Test checkpoint'
    },
    taskState: {
      currentState: 'EXECUTING',
      taskId: mockTaskId,
      humanTask: 'Test task',
      workingDirectory: '/test/path',
      options: {},
      simplificationCount: 0
    },
    beanCounter: {
      sessionId: 'session-123',
      isInitialized: true,
      progressLedger: {
        completedChunks: []
      },
      originalPlan: 'Test plan'
    },
    sessions: {
      sessions: {},
      initialized: true,
      toolPermissions: {}
    },
    fileSystem: {
      currentBranch: 'main',
      gitStatus: 'clean',
      modifiedFiles: [],
      workingDirectory: '/test/path',
      baseCommitHash: 'abc123',
      taskCommits: []
    },
    recovery: {
      canRecover: true
    }
  });

  describe('Constructor and Initialization', () => {
    it('initializes with valid taskId', () => {
      mockFs.existsSync.mockReturnValue(false);

      const service = new RecoveryService(mockTaskId);

      expect(service.getTaskId()).toBe(mockTaskId);
      expect(service.getCheckpointsDirectory()).toBe(mockCheckpointsDir);
    });

    it('throws error for invalid taskId', () => {
      expect(() => new RecoveryService('')).toThrow('RecoveryService requires a valid taskId parameter');
      expect(() => new RecoveryService('   ')).toThrow('RecoveryService requires a valid taskId parameter');
      expect(() => new RecoveryService(null as any)).toThrow('RecoveryService requires a valid taskId parameter');
      expect(() => new RecoveryService(123 as any)).toThrow('RecoveryService requires a valid taskId parameter');
    });

    it('trims whitespace from taskId', () => {
      mockFs.existsSync.mockReturnValue(false);

      const service = new RecoveryService('  test-task  ');

      expect(service.getTaskId()).toBe('test-task');
    });

    it('loads existing metadata on initialization', () => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      const service = new RecoveryService(mockTaskId);

      expect(service.hasCheckpoints()).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith(mockMetadataFile);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(mockMetadataFile, 'utf8');
    });

    it('handles missing metadata file gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);

      const service = new RecoveryService(mockTaskId);

      expect(service.hasCheckpoints()).toBe(false);
      expect(service.getCheckpointSummary()).toBeNull();
    });

    it('handles corrupted metadata file gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      // Create service - this will trigger the warning during construction
      const service = new RecoveryService(mockTaskId);

      expect(service.hasCheckpoints()).toBe(false);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load checkpoint metadata')
      );
    });

    it('handles metadata validation failure', () => {
      const invalidMetadata = { taskId: 'wrong-task', invalid: true };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidMetadata));

      // Create service - this will trigger the warning during construction
      const service = new RecoveryService(mockTaskId);

      expect(service.hasCheckpoints()).toBe(false);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Checkpoint metadata validation failed')
      );
    });
  });

  describe('Checkpoint Summary and Availability', () => {
    it('returns null summary when no checkpoints exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const service = new RecoveryService(mockTaskId);

      expect(service.getCheckpointSummary()).toBeNull();
    });

    it('returns correct checkpoint summary', () => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      const service = new RecoveryService(mockTaskId);
      const summary = service.getCheckpointSummary();

      expect(summary).toEqual({
        taskId: mockTaskId,
        totalCheckpoints: 3,
        latestCheckpoint: 3,
        checkpointsDir: mockCheckpointsDir,
        hasRecoverableCheckpoints: true
      });
    });

    it('identifies when no recoverable checkpoints exist', () => {
      const mockMetadata = createMockMetadata({
        checkpoints: [
          {
            checkpointNumber: 1,
            filename: 'checkpoint-001.json',
            timestamp: '2024-01-15T10:00:00.000Z',
            trigger: 'MANUAL',
            description: 'Non-recoverable checkpoint',
            canRecover: false
          }
        ]
      });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      const service = new RecoveryService(mockTaskId);
      const summary = service.getCheckpointSummary();

      expect(summary?.hasRecoverableCheckpoints).toBe(false);
    });

    it('returns available checkpoints array', () => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      const service = new RecoveryService(mockTaskId);
      const checkpoints = service.getAvailableCheckpoints();

      expect(checkpoints).toHaveLength(3);
      expect(checkpoints[0]).toEqual(mockMetadata.checkpoints[0]);

      // Ensure it returns a copy, not the original array
      checkpoints.push({} as any);
      expect(service.getAvailableCheckpoints()).toHaveLength(3);
    });

    it('returns empty array when no metadata exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      const service = new RecoveryService(mockTaskId);

      expect(service.getAvailableCheckpoints()).toEqual([]);
    });
  });

  describe('Latest Recoverable Checkpoint', () => {
    it('finds latest recoverable checkpoint', () => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      const service = new RecoveryService(mockTaskId);
      const latest = service.getLatestRecoverableCheckpoint();

      // Should return checkpoint 2 (latest recoverable one)
      expect(latest).toEqual(mockMetadata.checkpoints[1]);
    });

    it('returns null when no recoverable checkpoints exist', () => {
      const mockMetadata = createMockMetadata({
        checkpoints: [
          {
            checkpointNumber: 1,
            filename: 'checkpoint-001.json',
            timestamp: '2024-01-15T10:00:00.000Z',
            trigger: 'MANUAL',
            description: 'Non-recoverable checkpoint',
            canRecover: false
          }
        ]
      });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      const service = new RecoveryService(mockTaskId);

      expect(service.getLatestRecoverableCheckpoint()).toBeNull();
    });

    it('returns null when no metadata exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      const service = new RecoveryService(mockTaskId);

      expect(service.getLatestRecoverableCheckpoint()).toBeNull();
    });
  });

  describe('Checkpoint Validation', () => {
    it('validates existing checkpoint successfully', () => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValueOnce(true) // metadata file
        .mockReturnValueOnce(true); // checkpoint file
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));
      mockFs.accessSync.mockImplementation(() => {}); // No error = accessible

      const service = new RecoveryService(mockTaskId);
      const validation = service.validateCheckpointExists(1);

      expect(validation).toEqual({
        exists: true,
        filename: 'checkpoint-001.json'
      });
    });

    it('fails validation when checkpoint not in metadata', () => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      const service = new RecoveryService(mockTaskId);
      const validation = service.validateCheckpointExists(999);

      expect(validation).toEqual({
        exists: false,
        error: 'Checkpoint 999 not found in metadata'
      });
    });

    it('fails validation when checkpoint file missing', () => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValueOnce(true) // metadata file
        .mockReturnValueOnce(false); // checkpoint file
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      const service = new RecoveryService(mockTaskId);
      const validation = service.validateCheckpointExists(1);

      expect(validation).toEqual({
        exists: false,
        filename: 'checkpoint-001.json',
        error: 'Checkpoint file checkpoint-001.json not found on disk'
      });
    });

    it('fails validation when checkpoint file not readable', () => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));
      mockFs.accessSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const service = new RecoveryService(mockTaskId);
      const validation = service.validateCheckpointExists(1);

      expect(validation).toEqual({
        exists: false,
        filename: 'checkpoint-001.json',
        error: 'Checkpoint file checkpoint-001.json is not readable'
      });
    });

    it('fails validation when no metadata available', () => {
      mockFs.existsSync.mockReturnValue(false);

      const service = new RecoveryService(mockTaskId);
      const validation = service.validateCheckpointExists(1);

      expect(validation).toEqual({
        exists: false,
        error: 'No checkpoint metadata available'
      });
    });
  });

  describe('Checkpoint Loading', () => {
    it('loads checkpoint successfully', async () => {
      const mockMetadata = createMockMetadata();
      const mockCheckpoint = createMockCheckpoint();

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));
      mockFs.accessSync.mockImplementation(() => {}); // No error = accessible
      mockFs.promises.access.mockResolvedValue(undefined);
      mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockCheckpoint));

      const service = new RecoveryService(mockTaskId);
      const result = await service.loadCheckpoint(mockTaskId, 1);

      expect(result).toEqual(mockCheckpoint);
    });

    it('fails to load checkpoint with mismatched taskId', async () => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      const service = new RecoveryService(mockTaskId);

      // Clear the mock after construction to only capture the loadCheckpoint warning
      mockConsoleWarn.mockClear();

      const result = await service.loadCheckpoint('wrong-task', 1);

      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Task ID mismatch')
      );
    });

    it('fails to load non-existent checkpoint', async () => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      const service = new RecoveryService(mockTaskId);
      const result = await service.loadCheckpoint(mockTaskId, 999);

      expect(result).toBeNull();
    });

    it('loads checkpoint from file path successfully', async () => {
      const mockCheckpoint = createMockCheckpoint();
      const filePath = '/test/checkpoint.json';

      mockFs.promises.access.mockResolvedValue(undefined);
      mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockCheckpoint));

      // Create a service but don't initialize with metadata since we're loading directly from file
      mockFs.existsSync.mockReturnValue(false);
      const service = new RecoveryService(mockTaskId);

      const result = await service.loadCheckpointFromFile(filePath);

      expect(result).toEqual(mockCheckpoint);
      expect(mockFs.promises.access).toHaveBeenCalledWith(path.resolve(filePath), fs.constants.F_OK);
      expect(mockFs.promises.access).toHaveBeenCalledWith(path.resolve(filePath), fs.constants.R_OK);
    });

    it('fails to load from non-existent file', async () => {
      const filePath = '/test/nonexistent.json';

      mockFs.promises.access.mockRejectedValue(new Error('File not found'));

      mockFs.existsSync.mockReturnValue(false);
      const service = new RecoveryService(mockTaskId);

      // Clear the mock after construction to only capture the loadCheckpointFromFile warning
      mockConsoleWarn.mockClear();

      const result = await service.loadCheckpointFromFile(filePath);

      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Checkpoint file not found')
      );
    });

    it('fails to load from unreadable file', async () => {
      const filePath = '/test/unreadable.json';

      mockFs.promises.access.mockResolvedValueOnce(undefined) // File exists
        .mockRejectedValueOnce(new Error('Permission denied')); // Not readable

      mockFs.existsSync.mockReturnValue(false);
      const service = new RecoveryService(mockTaskId);

      // Clear the mock after construction to only capture the loadCheckpointFromFile warning
      mockConsoleWarn.mockClear();

      const result = await service.loadCheckpointFromFile(filePath);

      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Checkpoint file not readable')
      );
    });

    it('fails to load file with invalid JSON', async () => {
      const filePath = '/test/invalid.json';

      mockFs.promises.access.mockResolvedValue(undefined);
      mockFs.promises.readFile.mockResolvedValue('invalid json');

      mockFs.existsSync.mockReturnValue(false);
      const service = new RecoveryService(mockTaskId);

      // Clear the mock after construction to only capture the loadCheckpointFromFile warning
      mockConsoleWarn.mockClear();

      const result = await service.loadCheckpointFromFile(filePath);

      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse checkpoint file')
      );
    });

    it('fails to load file with invalid checkpoint structure', async () => {
      const filePath = '/test/invalid-structure.json';
      const invalidData = { invalid: 'structure' };

      mockFs.promises.access.mockResolvedValue(undefined);
      mockFs.promises.readFile.mockResolvedValue(JSON.stringify(invalidData));

      mockFs.existsSync.mockReturnValue(false);
      const service = new RecoveryService(mockTaskId);

      // Clear the mock after construction to only capture the loadCheckpointFromFile warning
      mockConsoleWarn.mockClear();

      const result = await service.loadCheckpointFromFile(filePath);

      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Checkpoint validation failed')
      );
    });
  });

  describe('Filtering and Search Methods', () => {
    let service: RecoveryService;

    beforeEach(() => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      service = new RecoveryService(mockTaskId);
    });

    it('filters checkpoints by trigger type', () => {
      const codeApprovedCheckpoints = service.filterCheckpointsByTrigger('CODE_APPROVED');
      const chunkCompleteCheckpoints = service.filterCheckpointsByTrigger('CHUNK_COMPLETE');
      const manualCheckpoints = service.filterCheckpointsByTrigger('MANUAL');

      expect(codeApprovedCheckpoints).toHaveLength(1);
      expect(codeApprovedCheckpoints[0].trigger).toBe('CODE_APPROVED');

      expect(chunkCompleteCheckpoints).toHaveLength(1);
      expect(chunkCompleteCheckpoints[0].trigger).toBe('CHUNK_COMPLETE');

      expect(manualCheckpoints).toHaveLength(1);
      expect(manualCheckpoints[0].trigger).toBe('MANUAL');

      // Test non-existent trigger
      const errorRecoveryCheckpoints = service.filterCheckpointsByTrigger('ERROR_RECOVERY');
      expect(errorRecoveryCheckpoints).toHaveLength(0);
    });

    it('filters checkpoints by recoverability', () => {
      const recoverableCheckpoints = service.filterCheckpointsByRecoverability(true);
      const nonRecoverableCheckpoints = service.filterCheckpointsByRecoverability(false);

      expect(recoverableCheckpoints).toHaveLength(2);
      expect(nonRecoverableCheckpoints).toHaveLength(1);

      // Verify sorting (newest first)
      expect(recoverableCheckpoints[0].checkpointNumber).toBe(2);
      expect(recoverableCheckpoints[1].checkpointNumber).toBe(1);
    });

    it('filters checkpoints by critical status', () => {
      const criticalCheckpoints = service.filterCheckpointsByCriticalStatus(true);
      const nonCriticalCheckpoints = service.filterCheckpointsByCriticalStatus(false);

      expect(criticalCheckpoints).toHaveLength(1);
      expect(criticalCheckpoints[0].isCritical).toBe(true);

      expect(nonCriticalCheckpoints).toHaveLength(2);
      // Should include both explicit false and undefined
      expect(nonCriticalCheckpoints.every(cp => cp.isCritical !== true)).toBe(true);
    });

    it('finds latest recoverable checkpoint efficiently', () => {
      const latest = service.findLatestRecoverableCheckpoint();

      expect(latest).not.toBeNull();
      expect(latest!.checkpointNumber).toBe(2); // Checkpoint 3 is not recoverable
      expect(latest!.canRecover).toBe(true);
    });

    it('gets checkpoints in time range', () => {
      const startTime = '2024-01-15T10:30:00.000Z';
      const endTime = '2024-01-15T11:30:00.000Z';

      const checkpointsInRange = service.getCheckpointsInTimeRange(startTime, endTime);

      expect(checkpointsInRange).toHaveLength(1);
      expect(checkpointsInRange[0].checkpointNumber).toBe(2);
    });

    it('handles invalid date range gracefully', () => {
      const invalidStart = 'invalid-date';
      const validEnd = '2024-01-15T12:00:00.000Z';

      // Clear mock to only capture the getCheckpointsInTimeRange warning
      mockConsoleWarn.mockClear();

      const result = service.getCheckpointsInTimeRange(invalidStart, validEnd);

      expect(result).toEqual([]);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid date range provided')
      );
    });

    it('handles reversed date range gracefully', () => {
      const startTime = '2024-01-15T12:00:00.000Z';
      const endTime = '2024-01-15T10:00:00.000Z';

      // Clear mock to only capture the getCheckpointsInTimeRange warning
      mockConsoleWarn.mockClear();

      const result = service.getCheckpointsInTimeRange(startTime, endTime);

      expect(result).toEqual([]);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid date range: start time')
      );
    });

    it('accepts Date objects for time range', () => {
      const startTime = new Date('2024-01-15T10:30:00.000Z');
      const endTime = new Date('2024-01-15T11:30:00.000Z');

      const checkpointsInRange = service.getCheckpointsInTimeRange(startTime, endTime);

      expect(checkpointsInRange).toHaveLength(1);
      expect(checkpointsInRange[0].checkpointNumber).toBe(2);
    });

    it('returns empty arrays when no metadata exists', () => {
      mockFs.existsSync.mockReturnValue(false);
      const emptyService = new RecoveryService('empty-task');

      expect(emptyService.filterCheckpointsByTrigger('CODE_APPROVED')).toEqual([]);
      expect(emptyService.filterCheckpointsByRecoverability(true)).toEqual([]);
      expect(emptyService.filterCheckpointsByCriticalStatus(true)).toEqual([]);
      expect(emptyService.findLatestRecoverableCheckpoint()).toBeNull();
      expect(emptyService.getCheckpointsInTimeRange('2024-01-15T10:00:00.000Z', '2024-01-15T12:00:00.000Z')).toEqual([]);
    });
  });

  describe('Directory Discovery', () => {
    it('discovers checkpoint directories successfully', () => {
      const mockCwd = '/test/project';
      const agnetoPath = path.join(mockCwd, '.agneto');
      const task1Path = path.join(agnetoPath, 'task-test1');
      const task2Path = path.join(agnetoPath, 'task-test2');
      const checkpoints1Path = path.join(task1Path, 'checkpoints');
      const checkpoints2Path = path.join(task2Path, 'checkpoints');

      vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);

      mockFs.existsSync.mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        return pathStr === agnetoPath ||
               pathStr === checkpoints1Path ||
               pathStr === checkpoints2Path;
      });

      mockFs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath.toString() === agnetoPath) {
          return [
            { name: 'task-test1', isDirectory: () => true },
            { name: 'task-test2', isDirectory: () => true },
            { name: 'not-a-task', isDirectory: () => true },
            { name: 'file.txt', isDirectory: () => false }
          ] as any;
        }
        if (dirPath.toString() === checkpoints1Path) {
          return ['checkpoint-001.json', 'checkpoint-002.json', 'metadata.json'];
        }
        if (dirPath.toString() === checkpoints2Path) {
          return ['checkpoint-001.json', 'metadata.json'];
        }
        return [];
      });

      mockFs.accessSync.mockImplementation(() => {}); // No error = accessible

      // Create service but mock the initialization to avoid loading metadata
      mockFs.existsSync.mockReturnValueOnce(false); // No metadata for initialization
      const service = new RecoveryService(mockTaskId);

      const discoveries = service.discoverCheckpointDirectories();

      expect(discoveries).toHaveLength(2);
      expect(discoveries[0]).toEqual({
        path: checkpoints1Path,
        taskId: 'test1',
        fileCount: 2, // Excludes metadata.json
        accessible: true
      });
      expect(discoveries[1]).toEqual({
        path: checkpoints2Path,
        taskId: 'test2',
        fileCount: 1, // Excludes metadata.json
        accessible: true
      });
    });

    it('handles discovery errors gracefully', () => {
      vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

      // Set up the initial metadata loading to not fail first
      mockFs.existsSync.mockReturnValueOnce(false); // No metadata for initialization
      const service = new RecoveryService(mockTaskId);

      // Now set up the discovery to fail
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('Access denied');
      });

      // Clear mock to only capture the discoverCheckpointDirectories warning
      mockConsoleWarn.mockClear();

      const discoveries = service.discoverCheckpointDirectories();

      expect(discoveries).toEqual([]);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Directory search failed')
      );
    });

    it('marks directories as inaccessible when access fails', () => {
      const mockCwd = '/test/project';
      const agnetoPath = path.join(mockCwd, '.agneto');
      const taskPath = path.join(agnetoPath, 'task-test1');
      const checkpointsPath = path.join(taskPath, 'checkpoints');

      vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);

      mockFs.existsSync.mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        return pathStr === agnetoPath || pathStr === checkpointsPath;
      });

      mockFs.readdirSync.mockImplementation((dirPath) => {
        if (dirPath.toString() === agnetoPath) {
          return [{ name: 'task-test1', isDirectory: () => true }] as any;
        }
        return [];
      });

      mockFs.accessSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      mockFs.existsSync.mockReturnValueOnce(false); // No metadata for initialization
      const service = new RecoveryService(mockTaskId);

      const discoveries = service.discoverCheckpointDirectories();

      expect(discoveries).toHaveLength(1);
      expect(discoveries[0]).toEqual({
        path: checkpointsPath,
        taskId: 'test1',
        fileCount: 0,
        accessible: false,
        error: 'Directory not accessible: Permission denied'
      });
    });
  });

  describe('File Enumeration', () => {
    it('enumerates checkpoint files with different naming formats', () => {
      const testDir = '/test/checkpoints';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation(() => {}); // Directory accessible

      const mockFiles = [
        { name: 'checkpoint-001.json', isFile: () => true },
        { name: 'checkpoint-002-20240115-120000.json', isFile: () => true },
        { name: 'checkpoint-20240115-130000.json', isFile: () => true },
        { name: 'unknown-format.json', isFile: () => true },
        { name: 'metadata.json', isFile: () => true }, // Should be excluded
        { name: 'not-a-checkpoint.txt', isFile: () => true }, // Should be excluded
        { name: 'subdir', isFile: () => false } // Should be excluded
      ];

      mockFs.readdirSync.mockReturnValue(mockFiles as any);

      const mockStats = {
        size: 1024,
        mtime: new Date('2024-01-15T12:00:00.000Z')
      };
      mockFs.statSync.mockReturnValue(mockStats as any);
      mockFs.accessSync.mockImplementation(() => {}); // All files accessible

      mockFs.existsSync.mockReturnValueOnce(false); // No metadata for initialization
      const service = new RecoveryService(mockTaskId);

      const files = service.enumerateCheckpointFiles(testDir);

      expect(files).toHaveLength(4); // Excludes metadata.json, .txt file, and directory

      // Test sequential format
      const sequential = files.find(f => f.namingFormat === 'sequential');
      expect(sequential).toEqual({
        filename: 'checkpoint-001.json',
        path: path.join(testDir, 'checkpoint-001.json'),
        checkpointNumber: 1,
        timestamp: undefined,
        namingFormat: 'sequential',
        fileSize: 1024,
        modifiedTime: '2024-01-15T12:00:00.000Z',
        accessible: true
      });

      // Test hybrid format
      const hybrid = files.find(f => f.namingFormat === 'hybrid');
      expect(hybrid).toEqual({
        filename: 'checkpoint-002-20240115-120000.json',
        path: path.join(testDir, 'checkpoint-002-20240115-120000.json'),
        checkpointNumber: 2,
        timestamp: '2024-01-15T12:00:00.000Z',
        namingFormat: 'hybrid',
        fileSize: 1024,
        modifiedTime: '2024-01-15T12:00:00.000Z',
        accessible: true
      });

      // Test timestamp format
      const timestamp = files.find(f => f.namingFormat === 'timestamp');
      expect(timestamp).toEqual({
        filename: 'checkpoint-20240115-130000.json',
        path: path.join(testDir, 'checkpoint-20240115-130000.json'),
        checkpointNumber: undefined,
        timestamp: '2024-01-15T13:00:00.000Z',
        namingFormat: 'timestamp',
        fileSize: 1024,
        modifiedTime: '2024-01-15T12:00:00.000Z',
        accessible: true
      });

      // Test unknown format
      const unknown = files.find(f => f.namingFormat === 'unknown');
      expect(unknown).toEqual({
        filename: 'unknown-format.json',
        path: path.join(testDir, 'unknown-format.json'),
        checkpointNumber: undefined,
        timestamp: undefined,
        namingFormat: 'unknown',
        fileSize: 1024,
        modifiedTime: '2024-01-15T12:00:00.000Z',
        accessible: true
      });
    });

    it('handles non-existent directory gracefully', () => {
      const testDir = '/test/nonexistent';

      mockFs.existsSync.mockReturnValueOnce(false); // No metadata for initialization
      const service = new RecoveryService(mockTaskId);

      mockFs.existsSync.mockReturnValue(false); // Directory doesn't exist

      // Clear mock to only capture the enumerateCheckpointFiles warning
      mockConsoleWarn.mockClear();

      const files = service.enumerateCheckpointFiles(testDir);

      expect(files).toEqual([]);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Checkpoint directory does not exist')
      );
    });

    it('handles inaccessible directory gracefully', () => {
      const testDir = '/test/inaccessible';

      mockFs.existsSync.mockReturnValueOnce(false); // No metadata for initialization
      const service = new RecoveryService(mockTaskId);

      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Clear mock to only capture the enumerateCheckpointFiles warning
      mockConsoleWarn.mockClear();

      const files = service.enumerateCheckpointFiles(testDir);

      expect(files).toEqual([]);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Checkpoint directory not accessible')
      );
    });

    it('marks individual files as inaccessible when access fails', () => {
      const testDir = '/test/checkpoints';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementationOnce(() => {}); // Directory accessible

      const mockFiles = [
        { name: 'checkpoint-001.json', isFile: () => true }
      ];

      mockFs.readdirSync.mockReturnValue(mockFiles as any);

      const mockStats = {
        size: 1024,
        mtime: new Date('2024-01-15T12:00:00.000Z')
      };
      mockFs.statSync.mockReturnValue(mockStats as any);

      // Make file access fail
      mockFs.accessSync.mockImplementationOnce(() => {
        throw new Error('File permission denied');
      });

      mockFs.existsSync.mockReturnValueOnce(false); // No metadata for initialization
      const service = new RecoveryService(mockTaskId);

      const files = service.enumerateCheckpointFiles(testDir);

      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({
        filename: 'checkpoint-001.json',
        path: path.join(testDir, 'checkpoint-001.json'),
        checkpointNumber: 1,
        timestamp: undefined,
        namingFormat: 'sequential',
        fileSize: 1024,
        modifiedTime: '2024-01-15T12:00:00.000Z',
        accessible: false,
        error: 'File not accessible: File permission denied'
      });
    });

    it('handles file stat errors gracefully', () => {
      const testDir = '/test/checkpoints';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation(() => {}); // Directory accessible

      const mockFiles = [
        { name: 'checkpoint-001.json', isFile: () => true }
      ];

      mockFs.readdirSync.mockReturnValue(mockFiles as any);
      mockFs.statSync.mockImplementation(() => {
        throw new Error('Stat failed');
      });

      mockFs.existsSync.mockReturnValueOnce(false); // No metadata for initialization
      const service = new RecoveryService(mockTaskId);

      const files = service.enumerateCheckpointFiles(testDir);

      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({
        filename: 'checkpoint-001.json',
        path: path.join(testDir, 'checkpoint-001.json'),
        checkpointNumber: undefined,
        timestamp: undefined,
        namingFormat: 'unknown',
        fileSize: 0,
        modifiedTime: '',
        accessible: false,
        error: 'File analysis failed: Stat failed'
      });
    });

    it('sorts files by checkpoint number when available', () => {
      const testDir = '/test/checkpoints';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.accessSync.mockImplementation(() => {});

      const mockFiles = [
        { name: 'checkpoint-003.json', isFile: () => true },
        { name: 'checkpoint-001.json', isFile: () => true },
        { name: 'checkpoint-002.json', isFile: () => true }
      ];

      mockFs.readdirSync.mockReturnValue(mockFiles as any);

      const mockStats = {
        size: 1024,
        mtime: new Date('2024-01-15T12:00:00.000Z')
      };
      mockFs.statSync.mockReturnValue(mockStats as any);

      mockFs.existsSync.mockReturnValueOnce(false); // No metadata for initialization
      const service = new RecoveryService(mockTaskId);

      const files = service.enumerateCheckpointFiles(testDir);

      expect(files.map(f => f.checkpointNumber)).toEqual([1, 2, 3]);
    });
  });

  describe('Metadata Access', () => {
    it('returns deep copy of metadata', () => {
      const mockMetadata = createMockMetadata();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

      const service = new RecoveryService(mockTaskId);
      const metadata1 = service.getMetadata();
      const metadata2 = service.getMetadata();

      // Should return a copy, not the same object
      expect(metadata1).toEqual(mockMetadata);
      expect(metadata1).not.toBe(metadata2);

      // Modifying the returned metadata should not affect internal state
      metadata1!.totalCheckpoints = 999;
      expect(service.getMetadata()!.totalCheckpoints).toBe(3);
    });

    it('returns null when no metadata exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      const service = new RecoveryService(mockTaskId);

      expect(service.getMetadata()).toBeNull();
    });
  });
});
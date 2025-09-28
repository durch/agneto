import * as fs from 'fs';
import * as path from 'path';
import {
  TaskCheckpoint,
  CheckpointMetadata,
  CheckpointConfig,
  AuditEvent
} from './types.js';

/**
 * RecoveryService - Checkpoint discovery, validation, and loading for audit-driven recovery
 *
 * AIDEV-NOTE: This service complements CheckpointService by providing recovery capabilities.
 * While CheckpointService handles checkpoint creation, RecoveryService focuses on discovery,
 * validation, and loading of existing checkpoint files for task recovery operations.
 * It follows the same graceful error handling patterns as CheckpointService and AuditLogger.
 */
export class RecoveryService {
  private taskId: string;
  private checkpointsDir: string;
  private metadataFile: string;
  private metadata: CheckpointMetadata | null = null;

  constructor(taskId: string) {
    if (!taskId || typeof taskId !== 'string' || taskId.trim().length === 0) {
      throw new Error('RecoveryService requires a valid taskId parameter');
    }

    this.taskId = taskId.trim();
    this.checkpointsDir = path.join('.agneto', `task-${this.taskId}`, 'checkpoints');
    this.metadataFile = path.join(this.checkpointsDir, 'metadata.json');

    // Initialize by attempting to load existing metadata
    this.loadMetadata();
  }

  /**
   * Load checkpoint metadata from disk
   * Sets metadata to null if loading fails (no checkpoints exist or corrupted)
   */
  private loadMetadata(): void {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const metadataContent = fs.readFileSync(this.metadataFile, 'utf8');
        const parsedMetadata = JSON.parse(metadataContent) as CheckpointMetadata;

        // Basic validation of metadata structure
        if (parsedMetadata.taskId === this.taskId &&
            Array.isArray(parsedMetadata.checkpoints) &&
            typeof parsedMetadata.totalCheckpoints === 'number') {
          this.metadata = parsedMetadata;
        } else {
          console.warn(`⚠️ Checkpoint metadata validation failed for task ${this.taskId}: structure mismatch`);
          this.metadata = null;
        }
      } else {
        // No metadata file exists - this is normal for tasks without checkpoints
        this.metadata = null;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load checkpoint metadata for task ${this.taskId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.metadata = null;
    }
  }

  /**
   * Check if any checkpoints exist for this task
   */
  hasCheckpoints(): boolean {
    return this.metadata !== null && this.metadata.totalCheckpoints > 0;
  }

  /**
   * Get basic checkpoint information without loading full checkpoint data
   */
  getCheckpointSummary(): {
    taskId: string;
    totalCheckpoints: number;
    latestCheckpoint: number;
    checkpointsDir: string;
    hasRecoverableCheckpoints: boolean;
  } | null {
    if (!this.metadata) {
      return null;
    }

    const hasRecoverableCheckpoints = this.metadata.checkpoints.some(cp => cp.canRecover);

    return {
      taskId: this.taskId,
      totalCheckpoints: this.metadata.totalCheckpoints,
      latestCheckpoint: this.metadata.latestCheckpoint,
      checkpointsDir: this.checkpointsDir,
      hasRecoverableCheckpoints
    };
  }

  /**
   * Get available checkpoint metadata for recovery selection
   */
  getAvailableCheckpoints(): Array<{
    checkpointNumber: number;
    filename: string;
    timestamp: string;
    trigger: string;
    description: string;
    canRecover: boolean;
    isCritical?: boolean;
  }> {
    if (!this.metadata) {
      return [];
    }

    // Return a copy to prevent external modification
    return [...this.metadata.checkpoints];
  }

  /**
   * Get the latest recoverable checkpoint metadata
   */
  getLatestRecoverableCheckpoint(): {
    checkpointNumber: number;
    filename: string;
    timestamp: string;
    trigger: string;
    description: string;
    canRecover: boolean;
    isCritical?: boolean;
  } | null {
    if (!this.metadata) {
      return null;
    }

    // Find the latest checkpoint that can be used for recovery
    const recoverableCheckpoints = this.metadata.checkpoints
      .filter(cp => cp.canRecover)
      .sort((a, b) => b.checkpointNumber - a.checkpointNumber);

    return recoverableCheckpoints.length > 0 ? recoverableCheckpoints[0] : null;
  }

  /**
   * Validate that a specific checkpoint file exists and is readable
   */
  validateCheckpointExists(checkpointNumber: number): {
    exists: boolean;
    filename?: string;
    error?: string;
  } {
    try {
      if (!this.metadata) {
        return { exists: false, error: 'No checkpoint metadata available' };
      }

      const checkpointInfo = this.metadata.checkpoints.find(cp => cp.checkpointNumber === checkpointNumber);
      if (!checkpointInfo) {
        return { exists: false, error: `Checkpoint ${checkpointNumber} not found in metadata` };
      }

      const checkpointPath = path.join(this.checkpointsDir, checkpointInfo.filename);
      if (!fs.existsSync(checkpointPath)) {
        return {
          exists: false,
          filename: checkpointInfo.filename,
          error: `Checkpoint file ${checkpointInfo.filename} not found on disk`
        };
      }

      // Check if file is readable
      try {
        fs.accessSync(checkpointPath, fs.constants.R_OK);
        return { exists: true, filename: checkpointInfo.filename };
      } catch {
        return {
          exists: false,
          filename: checkpointInfo.filename,
          error: `Checkpoint file ${checkpointInfo.filename} is not readable`
        };
      }

    } catch (error) {
      return {
        exists: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get the task ID this recovery service is configured for
   */
  getTaskId(): string {
    return this.taskId;
  }

  /**
   * Get the checkpoints directory path
   */
  getCheckpointsDirectory(): string {
    return this.checkpointsDir;
  }

  /**
   * Get full metadata (for debugging purposes)
   */
  getMetadata(): CheckpointMetadata | null {
    return this.metadata ? { ...this.metadata } : null;
  }

  /**
   * Load a specific checkpoint by task ID and checkpoint number
   *
   * @param taskId The task ID (must match this service's taskId)
   * @param checkpointNumber The checkpoint number to load
   * @returns Promise resolving to TaskCheckpoint object or null if loading fails
   */
  async loadCheckpoint(taskId: string, checkpointNumber: number): Promise<TaskCheckpoint | null> {
    try {
      // Validate task ID matches this service
      if (taskId !== this.taskId) {
        console.warn(`⚠️ Task ID mismatch: requested ${taskId}, service configured for ${this.taskId}`);
        return null;
      }

      // Validate checkpoint exists using existing method
      const validation = this.validateCheckpointExists(checkpointNumber);
      if (!validation.exists) {
        console.warn(`⚠️ Checkpoint ${checkpointNumber} validation failed: ${validation.error}`);
        return null;
      }

      // Load the checkpoint file
      const checkpointPath = path.join(this.checkpointsDir, validation.filename!);
      return await this.loadCheckpointFromFile(checkpointPath);

    } catch (error) {
      console.warn(`⚠️ Failed to load checkpoint ${checkpointNumber} for task ${taskId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Load a checkpoint directly from a file path
   *
   * @param filePath Absolute or relative path to the checkpoint file
   * @returns Promise resolving to TaskCheckpoint object or null if loading fails
   */
  async loadCheckpointFromFile(filePath: string): Promise<TaskCheckpoint | null> {
    try {
      // Resolve path and check if file exists
      const resolvedPath = path.resolve(filePath);

      try {
        await fs.promises.access(resolvedPath, fs.constants.F_OK);
      } catch {
        console.warn(`⚠️ Checkpoint file not found: ${resolvedPath}`);
        return null;
      }

      // Check if file is readable
      try {
        await fs.promises.access(resolvedPath, fs.constants.R_OK);
      } catch {
        console.warn(`⚠️ Checkpoint file not readable: ${resolvedPath}`);
        return null;
      }

      // Read and parse the file
      let fileContent: string;
      try {
        fileContent = await fs.promises.readFile(resolvedPath, 'utf8');
      } catch (error) {
        console.warn(`⚠️ Failed to read checkpoint file ${resolvedPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
      }

      // Parse JSON with error handling
      let parsedData: any;
      try {
        parsedData = JSON.parse(fileContent);
      } catch (error) {
        console.warn(`⚠️ Failed to parse checkpoint file ${resolvedPath}: Invalid JSON - ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
      }

      // Validate the loaded data structure
      const validatedCheckpoint = this.validateCheckpointData(parsedData, resolvedPath);
      if (!validatedCheckpoint) {
        return null;
      }

      return validatedCheckpoint;

    } catch (error) {
      console.warn(`⚠️ Failed to load checkpoint from file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Discover checkpoint directories by filesystem traversal
   */
  discoverCheckpointDirectories(): Array<{
    path: string;
    taskId: string;
    fileCount: number;
    accessible: boolean;
    error?: string;
  }> {
    const discoveries: Array<{
      path: string;
      taskId: string;
      fileCount: number;
      accessible: boolean;
      error?: string;
    }> = [];

    try {
      let currentDir = process.cwd();
      const visitedPaths = new Set<string>();

      while (currentDir !== path.dirname(currentDir) && !visitedPaths.has(currentDir)) {
        visitedPaths.add(currentDir);

        try {
          const agnetoPath = path.join(currentDir, '.agneto');

          if (fs.existsSync(agnetoPath)) {
            const agnetoEntries = fs.readdirSync(agnetoPath, { withFileTypes: true });

            for (const entry of agnetoEntries) {
              if (entry.isDirectory() && entry.name.startsWith('task-')) {
                const checkpointsPath = path.join(agnetoPath, entry.name, 'checkpoints');
                const taskIdMatch = entry.name.match(/^task-(.+)$/);
                const taskId = taskIdMatch ? taskIdMatch[1] : entry.name;

                try {
                  if (fs.existsSync(checkpointsPath)) {
                    try {
                      fs.accessSync(checkpointsPath, fs.constants.R_OK);
                      const files = fs.readdirSync(checkpointsPath).filter(file =>
                        file.endsWith('.json') && file !== 'metadata.json'
                      );

                      discoveries.push({
                        path: checkpointsPath,
                        taskId,
                        fileCount: files.length,
                        accessible: true
                      });
                    } catch (accessError) {
                      discoveries.push({
                        path: checkpointsPath,
                        taskId,
                        fileCount: 0,
                        accessible: false,
                        error: `Directory not accessible: ${accessError instanceof Error ? accessError.message : 'Unknown error'}`
                      });
                    }
                  }
                } catch (dirError) {
                  discoveries.push({
                    path: checkpointsPath,
                    taskId,
                    fileCount: 0,
                    accessible: false,
                    error: `Directory scan failed: ${dirError instanceof Error ? dirError.message : 'Unknown error'}`
                  });
                }
              }
            }
          }
        } catch (searchError) {
          console.warn(`⚠️ Directory search failed in ${currentDir}: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`);
        }

        currentDir = path.dirname(currentDir);
      }

    } catch (error) {
      console.warn(`⚠️ Checkpoint directory discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return discoveries;
  }

  /**
   * Enumerate checkpoint files in a specific directory
   */
  enumerateCheckpointFiles(directoryPath: string): Array<{
    filename: string;
    path: string;
    checkpointNumber?: number;
    timestamp?: string;
    namingFormat: 'sequential' | 'timestamp' | 'hybrid' | 'unknown';
    fileSize: number;
    modifiedTime: string;
    accessible: boolean;
    error?: string;
  }> {
    const files: Array<{
      filename: string;
      path: string;
      checkpointNumber?: number;
      timestamp?: string;
      namingFormat: 'sequential' | 'timestamp' | 'hybrid' | 'unknown';
      fileSize: number;
      modifiedTime: string;
      accessible: boolean;
      error?: string;
    }> = [];

    try {
      if (!fs.existsSync(directoryPath)) {
        console.warn(`⚠️ Checkpoint directory does not exist: ${directoryPath}`);
        return files;
      }

      try {
        fs.accessSync(directoryPath, fs.constants.R_OK);
      } catch (accessError) {
        console.warn(`⚠️ Checkpoint directory not accessible: ${directoryPath}`);
        return files;
      }

      const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

      const patterns = {
        sequential: /^checkpoint-(\d{3})\.json$/,
        timestamp: /^checkpoint-(\d{8}-\d{6})\.json$/,
        hybrid: /^checkpoint-(\d{3})-(\d{8}-\d{6})\.json$/
      };

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'metadata.json') {
          continue;
        }

        const filePath = path.join(directoryPath, entry.name);

        try {
          const stats = fs.statSync(filePath);

          let checkpointNumber: number | undefined;
          let timestamp: string | undefined;
          let namingFormat: 'sequential' | 'timestamp' | 'hybrid' | 'unknown' = 'unknown';

          const hybridMatch = entry.name.match(patterns.hybrid);
          if (hybridMatch) {
            namingFormat = 'hybrid';
            checkpointNumber = parseInt(hybridMatch[1], 10);
            timestamp = this.parseTimestampFromFilename(hybridMatch[2]);
          } else {
            const sequentialMatch = entry.name.match(patterns.sequential);
            if (sequentialMatch) {
              namingFormat = 'sequential';
              checkpointNumber = parseInt(sequentialMatch[1], 10);
            } else {
              const timestampMatch = entry.name.match(patterns.timestamp);
              if (timestampMatch) {
                namingFormat = 'timestamp';
                timestamp = this.parseTimestampFromFilename(timestampMatch[1]);
              }
            }
          }

          let accessible = true;
          let error: string | undefined;
          try {
            fs.accessSync(filePath, fs.constants.R_OK);
          } catch (accessError) {
            accessible = false;
            error = `File not accessible: ${accessError instanceof Error ? accessError.message : 'Unknown error'}`;
          }

          files.push({
            filename: entry.name,
            path: filePath,
            checkpointNumber,
            timestamp,
            namingFormat,
            fileSize: stats.size,
            modifiedTime: stats.mtime.toISOString(),
            accessible,
            error
          });

        } catch (fileError) {
          files.push({
            filename: entry.name,
            path: filePath,
            checkpointNumber: undefined,
            timestamp: undefined,
            namingFormat: 'unknown',
            fileSize: 0,
            modifiedTime: '',
            accessible: false,
            error: `File analysis failed: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`
          });
        }
      }

      files.sort((a, b) => {
        if (a.checkpointNumber !== undefined && b.checkpointNumber !== undefined) {
          return a.checkpointNumber - b.checkpointNumber;
        }
        return a.filename.localeCompare(b.filename);
      });

    } catch (error) {
      console.warn(`⚠️ Checkpoint file enumeration failed for ${directoryPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return files;
  }

  private parseTimestampFromFilename(timestampStr: string): string | undefined {
    try {
      const match = timestampStr.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
      if (!match) {
        return undefined;
      }

      const [, year, month, day, hour, minute, second] = match;
      const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;

      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        return undefined;
      }

      return isoString;
    } catch {
      return undefined;
    }
  }

  // AIDEV-NOTE: Checkpoint filtering and search methods added for efficient recovery scenarios
  // These methods work entirely with metadata for performance, enabling quick searches like:
  // - "find all CODE_APPROVED checkpoints" (filterCheckpointsByTrigger)
  // - "find latest good checkpoint" (findLatestRecoverableCheckpoint)
  // - "find critical checkpoints" (filterCheckpointsByCriticalStatus)
  // - "find checkpoints from last hour" (getCheckpointsInTimeRange)
  // All methods return sorted arrays (newest first) and handle empty metadata gracefully

  /**
   * Filter checkpoints by trigger type for efficient searches
   *
   * @param triggerType The trigger type to filter by
   * @returns Array of checkpoint metadata matching the trigger type
   */
  filterCheckpointsByTrigger(triggerType: 'CODE_APPROVED' | 'CHUNK_COMPLETE' | 'MANUAL' | 'ERROR_RECOVERY'): Array<{
    checkpointNumber: number;
    filename: string;
    timestamp: string;
    trigger: string;
    description: string;
    canRecover: boolean;
    isCritical?: boolean;
  }> {
    if (!this.metadata) {
      return [];
    }

    return this.metadata.checkpoints
      .filter(cp => cp.trigger === triggerType)
      .sort((a, b) => b.checkpointNumber - a.checkpointNumber);
  }

  /**
   * Filter checkpoints by recoverability status
   *
   * @param canRecover Whether to return recoverable (true) or non-recoverable (false) checkpoints
   * @returns Array of checkpoint metadata matching the recoverability status
   */
  filterCheckpointsByRecoverability(canRecover: boolean): Array<{
    checkpointNumber: number;
    filename: string;
    timestamp: string;
    trigger: string;
    description: string;
    canRecover: boolean;
    isCritical?: boolean;
  }> {
    if (!this.metadata) {
      return [];
    }

    return this.metadata.checkpoints
      .filter(cp => cp.canRecover === canRecover)
      .sort((a, b) => b.checkpointNumber - a.checkpointNumber);
  }

  /**
   * Filter checkpoints by critical status
   *
   * @param isCritical Whether to return critical (true) or non-critical (false) checkpoints
   * @returns Array of checkpoint metadata matching the critical status
   */
  filterCheckpointsByCriticalStatus(isCritical: boolean): Array<{
    checkpointNumber: number;
    filename: string;
    timestamp: string;
    trigger: string;
    description: string;
    canRecover: boolean;
    isCritical?: boolean;
  }> {
    if (!this.metadata) {
      return [];
    }

    return this.metadata.checkpoints
      .filter(cp => isCritical ? cp.isCritical === true : (cp.isCritical === false || cp.isCritical === undefined))
      .sort((a, b) => b.checkpointNumber - a.checkpointNumber);
  }

  /**
   * Find the latest recoverable checkpoint efficiently
   * Enhanced version optimized for performance with metadata-only approach
   *
   * @returns Latest recoverable checkpoint metadata or null if none found
   */
  findLatestRecoverableCheckpoint(): {
    checkpointNumber: number;
    filename: string;
    timestamp: string;
    trigger: string;
    description: string;
    canRecover: boolean;
    isCritical?: boolean;
  } | null {
    if (!this.metadata) {
      return null;
    }

    // Use efficient single-pass search for latest recoverable checkpoint
    let latestRecoverable: typeof this.metadata.checkpoints[0] | null = null;
    let maxCheckpointNumber = -1;

    for (const checkpoint of this.metadata.checkpoints) {
      if (checkpoint.canRecover && checkpoint.checkpointNumber > maxCheckpointNumber) {
        latestRecoverable = checkpoint;
        maxCheckpointNumber = checkpoint.checkpointNumber;
      }
    }

    return latestRecoverable;
  }

  /**
   * Get checkpoints within a specific time range
   *
   * @param startTime Start time in ISO format or Date object
   * @param endTime End time in ISO format or Date object
   * @returns Array of checkpoint metadata within the time range, sorted by timestamp descending
   */
  getCheckpointsInTimeRange(startTime: string | Date, endTime: string | Date): Array<{
    checkpointNumber: number;
    filename: string;
    timestamp: string;
    trigger: string;
    description: string;
    canRecover: boolean;
    isCritical?: boolean;
  }> {
    if (!this.metadata) {
      return [];
    }

    // Convert inputs to Date objects for comparison
    const startDate = typeof startTime === 'string' ? new Date(startTime) : startTime;
    const endDate = typeof endTime === 'string' ? new Date(endTime) : endTime;

    // Validate date inputs
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn(`⚠️ Invalid date range provided to getCheckpointsInTimeRange: start=${startTime}, end=${endTime}`);
      return [];
    }

    if (startDate > endDate) {
      console.warn(`⚠️ Invalid date range: start time (${startDate.toISOString()}) is after end time (${endDate.toISOString()})`);
      return [];
    }

    return this.metadata.checkpoints
      .filter(cp => {
        const checkpointDate = new Date(cp.timestamp);
        return checkpointDate >= startDate && checkpointDate <= endDate;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Validate that loaded data conforms to TaskCheckpoint interface structure
   *
   * @param data The parsed JSON data to validate
   * @param filePath The file path for error reporting
   * @returns Validated TaskCheckpoint object or null if validation fails
   */
  private validateCheckpointData(data: any, filePath: string): TaskCheckpoint | null {
    try {
      // Check if data is an object
      if (!data || typeof data !== 'object') {
        console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Invalid data structure - not an object`);
        return null;
      }

      // Validate required top-level properties
      const requiredProperties = ['metadata', 'taskState', 'beanCounter', 'sessions', 'fileSystem', 'recovery'];
      for (const prop of requiredProperties) {
        if (!(prop in data)) {
          console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Missing required property '${prop}'`);
          return null;
        }
      }

      // Validate metadata structure
      if (!this.validateMetadataStructure(data.metadata, filePath)) {
        return null;
      }

      // Validate taskState structure
      if (!this.validateTaskStateStructure(data.taskState, filePath)) {
        return null;
      }

      // Validate beanCounter structure
      if (!this.validateBeanCounterStructure(data.beanCounter, filePath)) {
        return null;
      }

      // Validate sessions structure
      if (!this.validateSessionsStructure(data.sessions, filePath)) {
        return null;
      }

      // Validate fileSystem structure
      if (!this.validateFileSystemStructure(data.fileSystem, filePath)) {
        return null;
      }

      // Validate recovery structure
      if (!this.validateRecoveryStructure(data.recovery, filePath)) {
        return null;
      }

      // All validations passed - return the validated data as TaskCheckpoint
      return data as TaskCheckpoint;

    } catch (error) {
      console.warn(`⚠️ Checkpoint validation error for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Validate checkpoint metadata structure
   */
  private validateMetadataStructure(metadata: any, filePath: string): boolean {
    if (!metadata || typeof metadata !== 'object') {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Invalid metadata structure`);
      return false;
    }

    const requiredProps = ['version', 'timestamp', 'trigger', 'checkpointNumber', 'description'];
    for (const prop of requiredProps) {
      if (!(prop in metadata)) {
        console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Missing metadata property '${prop}'`);
        return false;
      }
    }

    // Validate trigger is one of the expected values
    const validTriggers = ['CODE_APPROVED', 'CHUNK_COMPLETE', 'MANUAL', 'ERROR_RECOVERY'];
    if (!validTriggers.includes(metadata.trigger)) {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Invalid trigger value '${metadata.trigger}'`);
      return false;
    }

    return true;
  }

  /**
   * Validate task state structure
   */
  private validateTaskStateStructure(taskState: any, filePath: string): boolean {
    if (!taskState || typeof taskState !== 'object') {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Invalid taskState structure`);
      return false;
    }

    const requiredProps = ['currentState', 'taskId', 'humanTask', 'workingDirectory', 'options', 'simplificationCount'];
    for (const prop of requiredProps) {
      if (!(prop in taskState)) {
        console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Missing taskState property '${prop}'`);
        return false;
      }
    }

    return true;
  }

  /**
   * Validate bean counter structure
   */
  private validateBeanCounterStructure(beanCounter: any, filePath: string): boolean {
    if (!beanCounter || typeof beanCounter !== 'object') {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Invalid beanCounter structure`);
      return false;
    }

    const requiredProps = ['sessionId', 'isInitialized', 'progressLedger', 'originalPlan'];
    for (const prop of requiredProps) {
      if (!(prop in beanCounter)) {
        console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Missing beanCounter property '${prop}'`);
        return false;
      }
    }

    // Validate progressLedger structure
    if (!beanCounter.progressLedger || typeof beanCounter.progressLedger !== 'object') {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Invalid progressLedger structure`);
      return false;
    }

    if (!Array.isArray(beanCounter.progressLedger.completedChunks)) {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: completedChunks must be an array`);
      return false;
    }

    return true;
  }

  /**
   * Validate sessions structure
   */
  private validateSessionsStructure(sessions: any, filePath: string): boolean {
    if (!sessions || typeof sessions !== 'object') {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Invalid sessions structure`);
      return false;
    }

    const requiredProps = ['sessions', 'initialized', 'toolPermissions'];
    for (const prop of requiredProps) {
      if (!(prop in sessions)) {
        console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Missing sessions property '${prop}'`);
        return false;
      }
    }

    return true;
  }

  /**
   * Validate file system structure
   */
  private validateFileSystemStructure(fileSystem: any, filePath: string): boolean {
    if (!fileSystem || typeof fileSystem !== 'object') {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Invalid fileSystem structure`);
      return false;
    }

    const requiredProps = ['currentBranch', 'gitStatus', 'modifiedFiles', 'workingDirectory', 'baseCommitHash', 'taskCommits'];
    for (const prop of requiredProps) {
      if (!(prop in fileSystem)) {
        console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Missing fileSystem property '${prop}'`);
        return false;
      }
    }

    // Validate arrays
    if (!Array.isArray(fileSystem.modifiedFiles)) {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: modifiedFiles must be an array`);
      return false;
    }

    if (!Array.isArray(fileSystem.taskCommits)) {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: taskCommits must be an array`);
      return false;
    }

    return true;
  }

  /**
   * Validate recovery structure
   */
  private validateRecoveryStructure(recovery: any, filePath: string): boolean {
    if (!recovery || typeof recovery !== 'object') {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Invalid recovery structure`);
      return false;
    }

    if (!('canRecover' in recovery)) {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: Missing recovery property 'canRecover'`);
      return false;
    }

    if (typeof recovery.canRecover !== 'boolean') {
      console.warn(`⚠️ Checkpoint validation failed for ${filePath}: canRecover must be a boolean`);
      return false;
    }

    return true;
  }
}
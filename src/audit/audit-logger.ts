import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AuditEvent, TaskAuditMetadata, AuditConfig } from './types.js';
import { SummaryGenerator } from './summary-generator.js';
import { JSONExporter } from './json-exporter.js';
import { DashboardEventEmitter } from '../dashboard/event-emitter.js';
import type { TaskStateMachine } from '../task-state-machine.js';

/**
 * AuditLogger class for capturing and storing agent interaction audit trails
 *
 * AIDEV-NOTE: This class extends the existing LogUI system by intercepting
 * method calls and storing audit events to persistent storage without
 * modifying the original LogUI interface or behavior
 */
export class AuditLogger {
  private config: AuditConfig;
  private eventCount: number = 0;
  private taskStartTime: string;
  private eventsDir: string;
  private metadataFile: string;
  private dashboardEmitter: DashboardEventEmitter;
  private taskStateMachine?: TaskStateMachine;

  constructor(taskId: string, taskDescription: string = '') {
    // Check if audit is disabled via environment variable
    const isDisabled = process.env.DISABLE_AUDIT === 'true';

    this.config = {
      taskId,
      enabled: !isDisabled,
      auditDir: path.join('.agneto', `task-${taskId}`),
      includeToolParams: true
    };

    this.taskStartTime = new Date().toISOString();
    this.eventsDir = path.join(this.config.auditDir, 'events');
    this.metadataFile = path.join(this.config.auditDir, 'metadata.json');
    this.dashboardEmitter = new DashboardEventEmitter();

    if (this.config.enabled) {
      this.initializeAuditDirectories(taskDescription);
    }
  }

  /**
   * Initialize audit directory structure for the task
   */
  private initializeAuditDirectories(taskDescription: string): void {
    try {
      // Create main audit directory
      fs.mkdirSync(this.config.auditDir, { recursive: true });

      // Create events subdirectory
      fs.mkdirSync(this.eventsDir, { recursive: true });

      // Create initial metadata file
      const metadata: TaskAuditMetadata = {
        taskId: this.config.taskId,
        description: taskDescription,
        startTime: this.taskStartTime,
        status: 'active',
        eventCount: 0,
        auditVersion: '1.0.0'
      };

      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));

      // Create human-readable summary placeholder
      const summaryFile = path.join(this.config.auditDir, 'summary.md');
      const summaryContent = `# Task Audit Summary

**Task ID:** ${this.config.taskId}
**Description:** ${taskDescription}
**Started:** ${this.taskStartTime}
**Status:** Active

## Events
This file will be updated with a summary of key events as the task progresses.
`;
      fs.writeFileSync(summaryFile, summaryContent);

    } catch (error) {
      // Gracefully handle file system errors - don't break the main process
      console.warn(`⚠️ Audit initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.config.enabled = false;
    }
  }

  /**
   * Capture an audit event from agent interactions
   */
  captureEvent(
    agent: AuditEvent['agent'],
    eventType: AuditEvent['eventType'],
    message: string,
    options: {
      phase?: string;
      chunkNumber?: number;
      sprintNumber?: number;
      toolInfo?: AuditEvent['toolInfo'];
      metrics?: AuditEvent['metrics'];
      metadata?: Record<string, any>;
    } = {}
  ): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      const event: AuditEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        agent,
        eventType,
        message,
        ...options
      };

      // Write event to individual JSON file
      const eventFile = path.join(this.eventsDir, `${Date.now()}-${event.id}.json`);
      fs.writeFileSync(eventFile, JSON.stringify(event, null, 2));

      // Forward event to dashboard if enabled
      this.dashboardEmitter.forwardEvent(event, this.config.taskId);

      this.eventCount++;
      this.updateMetadata();

    } catch (error) {
      // Gracefully handle file system errors
      console.warn(`⚠️ Audit event capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update task metadata with current status
   */
  private updateMetadata(): void {
    try {
      const metadata: TaskAuditMetadata = {
        taskId: this.config.taskId,
        description: '', // Will be read from existing metadata
        startTime: this.taskStartTime,
        status: 'active',
        eventCount: this.eventCount,
        auditVersion: '1.0.0'
      };

      // Read existing metadata to preserve description
      if (fs.existsSync(this.metadataFile)) {
        try {
          const existing = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
          metadata.description = existing.description || '';
        } catch {
          // Ignore parse errors and use defaults
        }
      }

      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      // Gracefully handle metadata update failures
      console.warn(`⚠️ Audit metadata update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark task as completed in audit metadata and generate comprehensive summary
   */
  completeTask(): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      if (fs.existsSync(this.metadataFile)) {
        const metadata = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
        metadata.status = 'completed';
        metadata.endTime = new Date().toISOString();
        metadata.eventCount = this.eventCount;

        fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));

        // Generate comprehensive summary from captured events
        this.generateTaskSummary();
      }
    } catch (error) {
      console.warn(`⚠️ Audit completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate comprehensive task summary from captured audit events
   */
  private generateTaskSummary(): void {
    try {
      // Generate human-readable markdown summary
      const summaryGenerator = new SummaryGenerator(this.config.taskId);
      summaryGenerator.generateSummary();

      // Generate machine-readable JSON audit export
      const jsonExporter = new JSONExporter(this.config.taskId);
      jsonExporter.generateAuditJSON();
    } catch (error) {
      console.warn(`⚠️ Summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark task as failed in audit metadata
   */
  failTask(errorMessage: string): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      if (fs.existsSync(this.metadataFile)) {
        const metadata = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
        metadata.status = 'failed';
        metadata.endTime = new Date().toISOString();
        metadata.eventCount = this.eventCount;
        metadata.errorMessage = errorMessage;

        fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));

        // Generate comprehensive summary even for failed tasks
        this.generateTaskSummary();
      }
    } catch (error) {
      console.warn(`⚠️ Audit failure marking failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a proxy wrapper for LogUI that captures audit events
   */
  static wrapLogUI(logUI: any, auditLogger: AuditLogger): any {
    if (!auditLogger.config.enabled) {
      return logUI; // Return unwrapped LogUI if audit is disabled
    }

    // Create a proxy that intercepts method calls
    return new Proxy(logUI, {
      get(target, prop, receiver) {
        const originalMethod = Reflect.get(target, prop, receiver);

        // Only intercept the main agent logging methods
        if (typeof originalMethod === 'function' &&
            ['planner', 'coder', 'review', 'beanCounter', 'orchestrator', 'toolUse', 'toolResult', 'complete'].includes(String(prop))) {

          return function(...args: any[]) {
            // Call the original method first
            const result = originalMethod.apply(target, args);

            // Then capture the audit event
            try {
              if (prop === 'toolUse') {
                const [agent, tool, input] = args;
                auditLogger.captureEvent(
                  agent.toLowerCase() as AuditEvent['agent'],
                  'tool_use',
                  `Using tool: ${tool}`,
                  {
                    toolInfo: { tool, input: auditLogger.config.includeToolParams ? input : undefined }
                  }
                );
              } else if (prop === 'toolResult') {
                const [agent, isError] = args;
                auditLogger.captureEvent(
                  agent.toLowerCase() as AuditEvent['agent'],
                  'tool_result',
                  `Tool completed: ${isError ? 'error' : 'success'}`,
                  {
                    toolInfo: { tool: 'unknown', isError }
                  }
                );
              } else if (prop === 'complete') {
                const [agent, cost, duration] = args;
                auditLogger.captureEvent(
                  agent.toLowerCase() as AuditEvent['agent'],
                  'completion',
                  `Agent completed`,
                  {
                    metrics: { cost, duration }
                  }
                );
              } else {
                // Regular agent messages
                const message = args[0] || '';
                const agentName = prop as string;

                // Get current TaskState from TaskStateMachine if available, fall back to LogUI phase
                const phase = auditLogger.taskStateMachine?.getCurrentState() || (target as any).currentPhase || undefined;
                const chunkNumber = (target as any).currentChunkNumber || undefined;
                const sprintNumber = (target as any).currentSprintNumber || undefined;

                auditLogger.captureEvent(
                  agentName as AuditEvent['agent'],
                  'message',
                  message,
                  { phase, chunkNumber, sprintNumber }
                );
              }
            } catch (error) {
              // Don't let audit failures break the main logging
              console.warn(`⚠️ Audit capture failed for ${String(prop)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

            return result;
          };
        }

        // Return the original method/property for everything else
        return originalMethod;
      }
    });
  }

  /**
   * Set the TaskStateMachine reference for capturing current phase in events
   */
  setTaskStateMachine(taskStateMachine: TaskStateMachine): void {
    this.taskStateMachine = taskStateMachine;
  }

  /**
   * Get audit configuration for debugging
   */
  getConfig(): AuditConfig {
    return { ...this.config };
  }

  /**
   * Get current event count
   */
  getEventCount(): number {
    return this.eventCount;
  }
}
/**
 * Example of how to integrate the audit system with existing Agneto orchestrator
 *
 * AIDEV-NOTE: This file demonstrates the minimal changes needed to add audit
 * capabilities to the existing system without breaking current functionality
 */

import { log } from "../ui/log.js";
import { AuditLogger } from "./audit-logger.js";

/**
 * Initialize audit logging for a task and wrap the existing log instance
 *
 * This function should be called at the beginning of runTask() to enable
 * audit logging for the entire task execution.
 *
 * @param taskId - The task identifier
 * @param taskDescription - Description of the task being executed
 * @returns Wrapped log instance that captures audit events
 */
export function enableAuditLogging(taskId: string, taskDescription: string) {
  // Create audit logger instance
  const auditLogger = new AuditLogger(taskId, taskDescription);

  // Wrap the existing log instance with audit capture
  const auditedLog = AuditLogger.wrapLogUI(log, auditLogger);

  // Return both the wrapped log and the audit logger for lifecycle management
  return {
    log: auditedLog,
    auditLogger
  };
}

/**
 * Example usage in orchestrator.ts:
 *
 * ```typescript
 * import { enableAuditLogging } from "./audit/integration-example.js";
 *
 * export async function runTask(taskId: string, humanTask: string, options?) {
 *   // Initialize audit logging
 *   const { log: auditedLog, auditLogger } = enableAuditLogging(taskId, humanTask);
 *
 *   try {
 *     // Use auditedLog instead of log throughout the function
 *     auditedLog.info("Starting task execution...");
 *
 *     // All existing code continues to work unchanged
 *     auditedLog.planner("Planning task...");
 *     auditedLog.coder("Implementing solution...");
 *     // etc.
 *
 *     // Mark task as completed when done
 *     auditLogger.completeTask();
 *   } catch (error) {
 *     // Mark task as failed on error
 *     auditLogger.failTask(error.message);
 *     throw error;
 *   }
 * }
 * ```
 *
 * Benefits of this approach:
 * - Zero changes to existing code structure
 * - Audit logging can be easily disabled via DISABLE_AUDIT=true
 * - All existing log.* calls continue to work exactly as before
 * - Audit events are captured automatically for all agent interactions
 * - File system errors in audit system don't break main process
 */
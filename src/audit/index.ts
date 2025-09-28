/**
 * Audit system exports
 *
 * AIDEV-NOTE: Central export point for audit functionality that integrates
 * with the existing LogUI system without requiring modifications to it
 */

import { AuditLogger } from './audit-logger.js';

export { AuditLogger } from './audit-logger.js';
export { SummaryGenerator } from './summary-generator.js';
export { RecoveryService } from './recovery-service.js';
export type { AuditEvent, TaskAuditMetadata, AuditConfig } from './types';

/**
 * Helper function to initialize audit logging for a task
 *
 * Usage:
 * ```typescript
 * import { initializeAudit, AuditLogger, RecoveryService } from './audit';
 * import { log } from './ui/log';
 *
 * const auditLogger = initializeAudit('task-123', 'Fix authentication bug');
 * const auditedLog = AuditLogger.wrapLogUI(log, auditLogger);
 *
 * // Use auditedLog instead of log for all logging
 * auditedLog.coder('Starting implementation...');
 *
 * // Use RecoveryService for checkpoint operations
 * const recoveryService = new RecoveryService('task-123');
 * const checkpoints = recoveryService.getAvailableCheckpoints();
 * ```
 */
export function initializeAudit(taskId: string, taskDescription: string = ''): AuditLogger {
  return new AuditLogger(taskId, taskDescription);
}
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
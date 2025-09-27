# Audit System

The audit system provides comprehensive logging and storage of agent interactions during task execution. It extends the existing LogUI system without requiring any modifications to it.

## Features

- **Non-intrusive Integration**: Wraps the existing LogUI system using a proxy pattern
- **Persistent Storage**: Stores audit events to `.agneto/task-{id}/` directories
- **Environment Bypass**: Can be disabled via `DISABLE_AUDIT=true` environment variable
- **Graceful Error Handling**: File system errors don't break the main process
- **Rich Event Capture**: Captures agent messages, tool usage, phase transitions, and completion metrics
- **Human-Readable Output**: Generates both JSON events and markdown summaries

## Architecture

### Files

- `types.ts` - TypeScript interfaces for audit events and configuration
- `audit-logger.ts` - Main audit logging implementation
- `index.ts` - Public exports and helper functions
- `integration-example.ts` - Example of how to integrate with existing orchestrator

### Data Structure

```
.agneto/task-{id}/
├── events/               # Individual JSON event files
│   ├── 1727462285785-uuid.json
│   └── ...
├── metadata.json         # Task metadata and summary
└── summary.md           # Human-readable summary
```

## Usage

### Basic Integration

```typescript
import { log } from './ui/log';
import { AuditLogger } from './audit/audit-logger';

// Initialize audit logging for a task
const auditLogger = new AuditLogger('task-123', 'Fix authentication bug');

// Wrap the existing log instance
const auditedLog = AuditLogger.wrapLogUI(log, auditLogger);

// Use exactly as before - all existing code continues to work
auditedLog.planner('Planning the fix...');
auditedLog.coder('Implementing solution...');
auditedLog.review('Reviewing code...');

// Mark task as completed
auditLogger.completeTask();
```

### Using Helper Function

```typescript
import { initializeAudit, AuditLogger } from './audit';
import { log } from './ui/log';

const auditLogger = initializeAudit('task-123', 'Fix authentication bug');
const auditedLog = AuditLogger.wrapLogUI(log, auditLogger);
```

### Environment Variable Control

```bash
# Disable audit logging
DISABLE_AUDIT=true npm start

# Enable audit logging (default)
npm start
```

## Event Types

The system captures the following event types:

### Message Events
- **Agent**: planner, coder, reviewer, beanCounter, orchestrator
- **Content**: Natural language responses and communications
- **Context**: Current phase, chunk number, sprint number

### Tool Usage Events
- **Tool**: ReadFile, Write, Edit, Bash, etc.
- **Input**: Tool parameters (configurable)
- **Result**: Success/failure status

### Completion Events
- **Metrics**: Cost and duration information
- **Agent**: Which agent completed

### Phase Transition Events
- **Phase Changes**: PLANNING → CODING → REVIEW → etc.
- **Context**: Automatic detection from LogUI phase tracking

## Integration Points

The audit system hooks into these LogUI methods:

- `log.planner()` → Captures planning messages
- `log.coder()` → Captures implementation messages
- `log.review()` → Captures review messages
- `log.beanCounter()` → Captures chunking/coordination messages
- `log.orchestrator()` → Captures orchestration messages
- `log.toolUse()` → Captures tool usage
- `log.toolResult()` → Captures tool results
- `log.complete()` → Captures completion metrics

## Error Handling

The audit system is designed to be robust:

- **Graceful Degradation**: File system errors don't break main process
- **Warning Output**: Errors logged to console with ⚠️ prefix
- **Automatic Disable**: System disables itself on initialization failure
- **Try-Catch Wrapping**: All file operations wrapped in error handling

## Benefits

1. **Zero Code Changes**: Existing LogUI usage patterns unchanged
2. **Comprehensive Tracking**: Every agent interaction captured
3. **Debugging Support**: Rich audit trail for troubleshooting
4. **Compliance Ready**: Permanent record of AI agent actions
5. **Performance Monitoring**: Cost and duration tracking
6. **Easy Analysis**: Structured JSON data for processing

## File Format Examples

### Event File
```json
{
  "id": "22960103-830a-43d2-b9d7-f45124b5339b",
  "timestamp": "2025-09-27T19:18:05.785Z",
  "agent": "coder",
  "eventType": "message",
  "message": "Implementing authentication middleware...",
  "phase": "CODING",
  "chunkNumber": 2,
  "sprintNumber": 1
}
```

### Metadata File
```json
{
  "taskId": "task-123",
  "description": "Fix authentication bug",
  "startTime": "2025-09-27T19:18:05.783Z",
  "endTime": "2025-09-27T19:20:15.241Z",
  "status": "completed",
  "eventCount": 47,
  "auditVersion": "1.0.0"
}
```

## Next Steps

To fully integrate this audit system:

1. **Modify Orchestrator**: Add audit initialization in `runTask()`
2. **Update Imports**: Replace `log` imports with audited version
3. **Add Lifecycle**: Call `completeTask()` and `failTask()` appropriately
4. **Test Integration**: Verify audit events captured during real task execution

See `integration-example.ts` for detailed integration guidance.
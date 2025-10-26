# Dynamic Button System - Usage Guide

## Overview

The Agneto v2 TUI now supports **dynamic, event-driven buttons** that appear when events are published with actions, and disappear after being clicked.

## Architecture

```
Publisher (with actions) → NATS → TUI (displays buttons)
                                      ↓
                                  User presses key
                                      ↓
Publisher ← NATS ← Response Event (button click)
```

## Quick Start

### 1. Start NATS Server (if not running)

```bash
# Install NATS (if needed)
brew install nats-server

# Start NATS
nats-server -js
```

### 2. Start the TUI

In terminal 1:
```bash
./bin/tui
```

You should see:
```
=== Agneto Split-Pane Monitor ===
Listening for events on test.events | Press 'q' to quit

Left Pane                    │ Right Pane
────────────────────────────│────────────────────────────
(no events yet)             │ (no events yet)

(no actions available)
```

### 3. Publish an Event with Actions

In terminal 2:
```bash
./bin/publisher --actions-file examples/approve-reject.json "Plan ready - 5 chunks, estimated cost \$0.50"
```

Output:
```
Connected to NATS at nats://localhost:4222
Loaded 2 actions from examples/approve-reject.json
  [a] Approve → event type: user.approved
  [r] Reject → event type: user.rejected
Published event to test.events (pane: left): Plan ready - 5 chunks, estimated cost $0.50

Waiting for user response (timeout: 30s)...
```

### 4. Interact with Buttons in TUI

The TUI now shows:
```
Left Pane                    │ Right Pane
────────────────────────────│────────────────────────────
[15:04:05] Plan ready - 5  │ (no events yet)
chunks, estimated cost $0.50│

  [a] Approve    [r] Reject
```

Press `a` or `r` to trigger an action.

### 5. See the Response

**In TUI:**
```
Left Pane                    │ Right Pane
────────────────────────────│────────────────────────────
[15:04:05] Plan ready...   │ (no events yet)
[15:04:12] User pressed:   │
Approve                     │

(no actions available)
```

**In Publisher terminal:**
```
✓ Received response!
  Type: user.approved
  Time: 15:04:12
  Message: User pressed: Approve
```

## Command Reference

### Publisher

```bash
# Basic event (no actions)
./bin/publisher "Hello world"

# Event to right pane
./bin/publisher --pane right "Error occurred"

# Event with action buttons from file
./bin/publisher --actions-file examples/approve-reject.json "Approve this plan?"

# Event with custom actions (inline JSON)
./bin/publisher --actions-json '[{"id":"ok","label":"OK","key":"o","event":{"type":"user.ok","message":"OK"}}]' "Press OK"

# Different action sets
./bin/publisher --actions-file examples/retry-skip-abort.json "Error occurred - what to do?"
./bin/publisher --actions-file examples/choice-1-2-3.json "Select strategy"
```

### TUI

```bash
# Start TUI
./bin/tui

# With custom NATS URL
NATS_URL=nats://remote:4222 ./bin/tui

# Keyboard shortcuts:
# - q or Ctrl+C: Quit
# - a, r, etc.: Trigger visible action buttons
```

## Event Structure with Actions

Events can include an `actions` array. Each action contains a **complete event** that will be published when triggered:

```json
{
  "id": "uuid",
  "type": "test.message",
  "timestamp": "2025-10-13T22:15:00Z",
  "message": "Plan ready - 5 chunks",
  "pane": "left",
  "data": {
    "chunk_count": 5,
    "task_id": "abc123"
  },
  "actions": [
    {
      "id": "approve",
      "label": "Approve",
      "key": "a",
      "event": {
        "type": "user.approved",
        "message": "User approved the plan",
        "pane": "left",
        "data": {
          "action": "approve",
          "approved_at": "2025-10-13T22:15:30Z",
          "approved_via": "tui"
        }
      }
    },
    {
      "id": "reject",
      "label": "Reject",
      "key": "r",
      "event": {
        "type": "user.rejected",
        "message": "User rejected the plan",
        "pane": "right",
        "data": {
          "action": "reject",
          "rejected_at": "2025-10-13T22:15:45Z",
          "reason": "user_decision"
        }
      }
    }
  ]
}
```

**Key Design**: Actions specify the **complete event** to publish (TUI just adds ID and timestamp). This gives the orchestrator full control over response structure, data, and routing.

## Action Lifecycle

1. **Orchestrator Creates Event** with `actions` array (each action contains complete response event)
2. **TUI Receives Event** → Displays in pane + Registers buttons
3. **User Presses Key** → Button matches action
4. **TUI Publishes Response** → Exact event from `action.event` (adds ID/timestamp only)
5. **Button Disappears** → One-time use (ephemeral)
6. **Orchestrator/Publisher Receives Response** with full context in `data` field

## Custom Actions

You can create custom actions by sending JSON events with complete response events:

```bash
echo '{
  "id": "123",
  "type": "custom.event",
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "message": "Choose your path",
  "pane": "left",
  "actions": [
    {
      "id": "1",
      "label": "Option 1",
      "key": "1",
      "event": {
        "type": "user.chose.1",
        "message": "User selected option 1",
        "data": {"choice": 1, "path": "fast"}
      }
    },
    {
      "id": "2",
      "label": "Option 2",
      "key": "2",
      "event": {
        "type": "user.chose.2",
        "message": "User selected option 2",
        "data": {"choice": 2, "path": "safe"}
      }
    },
    {
      "id": "3",
      "label": "Option 3",
      "key": "3",
      "event": {
        "type": "user.chose.3",
        "message": "User selected option 3",
        "data": {"choice": 3, "path": "experimental"}
      }
    }
  ]
}' | nats pub test.events
```

## Use Cases

### 1. Approval Workflows
```bash
./bin/publisher --with-actions "Deploy to production?"
# User presses 'a' → deployment proceeds
```

### 2. Error Handling
```json
{
  "message": "Build failed in chunk 3",
  "data": {"chunk_id": 3, "error": "type error"},
  "actions": [
    {
      "key": "r",
      "label": "Retry",
      "event": {
        "type": "user.retry",
        "message": "Retrying chunk 3",
        "data": {"chunk_id": 3, "action": "retry"}
      }
    },
    {
      "key": "s",
      "label": "Skip",
      "event": {
        "type": "user.skip",
        "message": "Skipping chunk 3",
        "data": {"chunk_id": 3, "action": "skip"}
      }
    },
    {
      "key": "a",
      "label": "Abort",
      "event": {
        "type": "user.abort",
        "message": "Aborting entire task",
        "data": {"aborted_at_chunk": 3}
      }
    }
  ]
}
```

### 3. Interactive Prompts with Context
```json
{
  "message": "Select test suite for PR #123",
  "data": {"pr_number": 123, "branch": "feature/auth"},
  "actions": [
    {
      "key": "u",
      "label": "Unit Tests",
      "event": {
        "type": "run.unit",
        "message": "Running unit tests for PR #123",
        "data": {"suite": "unit", "pr_number": 123}
      }
    },
    {
      "key": "i",
      "label": "Integration Tests",
      "event": {
        "type": "run.integration",
        "message": "Running integration tests for PR #123",
        "data": {"suite": "integration", "pr_number": 123}
      }
    },
    {
      "key": "e",
      "label": "E2E Tests",
      "event": {
        "type": "run.e2e",
        "message": "Running E2E tests for PR #123",
        "data": {"suite": "e2e", "pr_number": 123, "full_deploy": true}
      }
    }
  ]
}
```

## Technical Details

- **Action Manager** (`pkg/tui/actions.go`): Manages active buttons
- **Event Schema** (`pkg/events/types.go`): Defines `Action` struct
- **Ephemeral Buttons**: Actions are removed after use (one-time click)
- **Key Conflicts**: Last registered action wins if keys overlap
- **Timeout**: Publisher waits 30 seconds for response

## Next Steps

- Add action groups (multiple sets of buttons active simultaneously)
- Support for persistent buttons (don't disappear after click)
- Visual feedback when action is triggered
- Mobile integration via HTTP bridge
- Action history/undo support

## Troubleshooting

**Buttons not appearing?**
- Ensure NATS is running: `pgrep -fl nats-server`
- Check TUI is connected: Look for "Connecting to NATS..." message
- Verify event has `actions` field

**Response not received in publisher?**
- Check TUI is running and received the event
- Verify you pressed the correct key
- Check 30-second timeout hasn't expired

**Key conflicts?**
- Avoid using 'q' (quit) as action key
- Check multiple events aren't registering same keys

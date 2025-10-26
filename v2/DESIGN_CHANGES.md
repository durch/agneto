# Design Changes: Explicit Event Responses

## Summary

Actions now contain **complete events** instead of just hints (`response_type` + `payload`). This gives the orchestrator full control over what gets published when buttons are clicked.

## What Changed

### Before (Implicit Response Construction)

**Action Definition:**
```json
{
  "key": "a",
  "label": "Approve",
  "response_type": "user.approved",
  "payload": {"action": "approve"}
}
```

**TUI Behavior:**
```go
// TUI had to guess what the response should look like
event := events.Event{
    Type: action.ResponseType,              // From action
    Message: "User pressed: " + action.Label, // Generic!
    Pane: "",                                // No control
    // Payload was ignored!
}
```

**Problems:**
- TUI guessing message format
- No control over response pane routing
- Payload field was parsed but never transmitted
- Limited flexibility
- Not aligned with event-sourcing principles

### After (Explicit Complete Events)

**Action Definition:**
```json
{
  "key": "a",
  "label": "Approve",
  "event": {
    "type": "user.approved",
    "message": "User approved the plan",
    "pane": "left",
    "data": {
      "action": "approve",
      "approved_at": "2025-10-13T22:15:30Z",
      "approved_via": "tui",
      "chunk_id": 3,
      "task_id": "abc123"
    }
  }
}
```

**TUI Behavior:**
```go
// TUI just relays the exact event (adds ID + timestamp only)
responseEvent := action.Event
responseEvent.ID = uuid.New().String()
responseEvent.Timestamp = time.Now()
nc.Publish("test.events", responseEvent)
```

**Benefits:**
- ✅ Orchestrator has full control
- ✅ Context preserved in `data` field
- ✅ Can route response to specific pane
- ✅ Custom messages per action
- ✅ TUI is simpler (dumb relay)
- ✅ Explicit contract
- ✅ Testable (know exact event structure)

## Code Changes

### 1. Event Struct (`pkg/events/types.go`)

**Added `Data` field:**
```go
type Event struct {
    ID        string                 `json:"id"`
    Type      string                 `json:"type"`
    Timestamp time.Time              `json:"timestamp"`
    Message   string                 `json:"message"`
    Pane      string                 `json:"pane,omitempty"`
    Data      map[string]interface{} `json:"data,omitempty"`    // NEW
    Actions   []Action               `json:"actions,omitempty"`
}
```

### 2. Action Struct (`pkg/events/types.go`)

**Replaced hints with complete event:**
```go
// Before
type Action struct {
    ID           string
    Label        string
    Key          string
    ResponseType string                 // REMOVED
    Payload      map[string]interface{} // REMOVED
}

// After
type Action struct {
    ID    string
    Label string
    Key   string
    Event Event  // NEW: Complete event to publish
}
```

### 3. TUI (`cmd/tui/main.go`)

**Simplified from 10 lines to 6:**
```go
// Before (constructing event)
event := events.Event{
    ID:        uuid.New().String(),
    Type:      action.ResponseType,
    Timestamp: time.Now(),
    Message:   fmt.Sprintf("User pressed: %s", action.Label),
    Pane:      "",
}

// After (relaying event)
responseEvent := action.Event
responseEvent.ID = uuid.New().String()
responseEvent.Timestamp = time.Now()
```

### 4. Publisher (`cmd/publisher/main.go`)

**Now creates complete events:**
```go
event.Actions = []events.Action{
    {
        ID:    "approve",
        Label: "Approve",
        Key:   "a",
        Event: events.Event{
            Type:    "user.approved",
            Message: "User approved the plan",
            Pane:    "left",
            Data: map[string]interface{}{
                "action":       "approve",
                "approved_at":  time.Now().Format(time.RFC3339),
                "approved_via": "tui",
            },
        },
    },
    // ...
}
```

**Displays full response:**
```go
fmt.Printf("  Type: %s\n", event.Type)
fmt.Printf("  Message: %s\n", event.Message)
fmt.Printf("  Pane: %s\n", event.Pane)
if len(event.Data) > 0 {
    fmt.Printf("  Data:\n")
    for key, value := range event.Data {
        fmt.Printf("    %s: %v\n", key, value)
    }
}
```

## Example Flow

**1. Orchestrator publishes event with actions:**
```json
{
  "type": "plan.ready",
  "message": "Plan has 5 chunks, $0.50 estimated cost",
  "pane": "left",
  "data": {
    "chunks": 5,
    "cost": 0.50,
    "task_id": "abc123"
  },
  "actions": [
    {
      "id": "approve",
      "label": "Approve Plan",
      "key": "a",
      "event": {
        "type": "plan.approved",
        "message": "Plan approved - starting execution",
        "pane": "right",
        "data": {
          "task_id": "abc123",
          "approved_chunks": 5
        }
      }
    }
  ]
}
```

**2. TUI displays button:** `[a] Approve Plan`

**3. User presses `a`**

**4. TUI publishes exact event from action (adds ID/timestamp):**
```json
{
  "id": "generated-uuid",
  "type": "plan.approved",
  "timestamp": "2025-10-13T22:35:00Z",
  "message": "Plan approved - starting execution",
  "pane": "right",
  "data": {
    "task_id": "abc123",
    "approved_chunks": 5
  }
}
```

**5. Orchestrator receives response with full context**

## Testing

```bash
# Terminal 1: Start TUI
./bin/tui

# Terminal 2: Send event with actions
./bin/publisher --with-actions "Plan ready?"

# In TUI: Press 'a'

# Terminal 2 output:
✓ Received response!
  Type: user.approved
  Time: 22:35:12
  Message: User approved the plan
  Pane: left
  Data:
    action: approve
    approved_at: 2025-10-13T22:35:12Z
    approved_via: tui
```

## Migration Notes

If you have existing code creating actions, update:

**Old:**
```go
Action{
    Key: "a",
    Label: "Approve",
    ResponseType: "user.approved",
    Payload: map[string]interface{}{"foo": "bar"},
}
```

**New:**
```go
Action{
    Key: "a",
    Label: "Approve",
    Event: events.Event{
        Type: "user.approved",
        Message: "Custom message here",
        Pane: "left",
        Data: map[string]interface{}{"foo": "bar"},
    },
}
```

## Philosophy

This change aligns with the **event-sourcing** architecture principle:

> "Events are the source of truth. Components relay events, they don't create them."

The TUI is now a **pure view layer** that:
- Subscribes to events (reads)
- Publishes events as given (writes, no modification)
- Has no business logic about event structure

The orchestrator has **full control** over:
- What events look like
- Where they're routed
- What data they contain
- How they're structured

This is **explicit over implicit**, which makes the system:
- Easier to debug
- Easier to test
- More predictable
- More flexible

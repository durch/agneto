# Agneto v2: Event-Sourced Distributed TUI Architecture

## Core Concept

**Everything is an event. State is derived from events. Components are peers.**

This architecture implements pure event sourcing where:
- All state changes are captured as immutable events
- Current state = `reduce(all events, initial state)`
- Any component can rebuild state by replaying events from the event store
- Components communicate only through events, never directly

## Guiding Principles

1. **Event Sourcing**: Complete audit trail, time-travel debugging, reproducible state
2. **Distributed by Design**: Components run on different machines, connect via NATS
3. **TUI as Pure View**: Bubbletea TUI is stateless, just renders derived state
4. **Mobile-First Interface**: Events can be injected from anywhere, including phones
5. **Testable**: Inject event sequences, verify state - no mocks needed

---

## High-Level Architecture

```
                    ┌──────────────────────┐
                    │    NATS Server       │
                    │   (Event Hub)        │
                    │                      │
                    │  Streams:            │
                    │  - agneto.tasks      │
                    │  - agneto.events     │
                    └──────────────────────┘
                            ▲
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    ┌─────▼──────┐    ┌─────▼──────┐   ┌─────▼──────┐
    │ agneto-tui │    │ agneto-tui │   │ agneto-tui │
    │  (User 1)  │    │  (User 2)  │   │  (User 3)  │
    └────────────┘    └────────────┘   └────────────┘
                            │
                      ┌─────▼──────┐
                      │agneto-server│
                      │(Orchestrator)│
                      └─────▲──────┘
                            │
                      ┌─────▼──────┐
                      │ agneto-    │
                      │  bridge    │
                      │ (HTTP API) │
                      └─────▲──────┘
                            │
                      ┌─────▼──────┐
                      │  Mobile    │
                      │  Phone     │
                      └────────────┘
```

### Component Roles

**NATS Server** (central nervous system)
- Stores events in append-only streams (JetStream)
- Broadcasts events to all subscribers
- Single source of truth
- Runs as daemon/service

**agneto-server** (orchestrator/business logic)
- Subscribes to all task events
- Maintains task state machine
- Executes agents (planner, coder, reviewer, etc.)
- Emits domain events as work progresses
- Runs headless (no UI)

**agneto-tui** (view layer)
- Subscribes to task event stream
- Replays events to rebuild state
- Renders UI with Bubbletea
- Captures user input
- Emits command events (approve, reject, retry, etc.)
- Multiple instances can connect to same task

**agneto-bridge** (HTTP ↔ NATS translator)
- Exposes HTTP API for publishing events
- Streams events via Server-Sent Events (SSE)
- Enables mobile/web clients
- Optional component (not needed for TUI-only usage)

---

## Event System Design

### Event Structure

```go
type Event struct {
    // Immutable event identity
    ID        string    `json:"id"`        // UUID
    Type      string    `json:"type"`      // "task.started"
    Timestamp time.Time `json:"timestamp"` // When it happened

    // Context
    TaskID    string    `json:"task_id"`   // Which task
    Source    string    `json:"source"`    // "orchestrator", "tui", "mobile"

    // Causality (for debugging/replay)
    CausationID   string `json:"causation_id"`   // Event that caused this
    CorrelationID string `json:"correlation_id"` // Initial command that started chain

    // Sequence (for ordering)
    Sequence  int64  `json:"sequence"` // Monotonic counter per stream

    // The actual data
    Data json.RawMessage `json:"data"` // Type-specific payload
}
```

**Sequence numbers are critical** for:
- Ensuring components process events in order
- Detecting gaps (missed events)
- Resuming from checkpoint

### Event Types

**Domain Events** (what happened in the system)
```
task.created
task.started
plan.ready
plan.approved
agent.invoked
chunk.started
chunk.completed
file.modified
test.passed
error.occurred
task.completed
task.failed
```

**Command Events** (what user/component requested)
```
user.approved_plan
user.rejected_plan
user.answered_question
user.requested_retry
user.injected_prompt
user.cancelled_task
```

### Event Catalog

The event catalog is the **contract** between all components. It defines:
- All valid event types (constants)
- Data schema for each event type
- Versioning strategy

```go
// pkg/events/catalog.go
package events

const (
    EventTaskCreated      = "task.created"
    EventTaskStarted      = "task.started"
    EventPlanReady        = "plan.ready"
    EventUserApprovedPlan = "user.approved_plan"
    // ... complete catalog
)

// Each event type has a data schema
type TaskCreatedData struct {
    Description string `json:"description"`
    Interactive bool   `json:"interactive"`
}

type PlanReadyData struct {
    Plan        string   `json:"plan"`
    Chunks      []string `json:"chunks"`
    EstimatedCost float64 `json:"estimated_cost"`
}

type UserApprovedPlanData struct {
    ApprovedAt time.Time `json:"approved_at"`
    UserID     string    `json:"user_id"`
}
```

Components **only communicate via this catalog**. Change an event schema? All components must handle it.

### NATS Stream Structure

**Task Registry Stream**
```
Stream: agneto-tasks
Subject: agneto.tasks.{taskID}.{event}

Purpose: Track which tasks exist
Events:
- agneto.tasks.abc123.created
- agneto.tasks.abc123.completed
- agneto.tasks.abc123.failed
```

**Task Event Streams**
```
Stream: agneto-events
Subject: agneto.events.{taskID}.{eventType}

Purpose: All events for a specific task (isolated per task)
Examples:
- agneto.events.abc123.task.started
- agneto.events.abc123.plan.ready
- agneto.events.abc123.user.approved_plan
- agneto.events.abc123.chunk.completed
```

### State Reconstruction (Reduction)

Every component reconstructs state by reducing events:

```go
type TaskState struct {
    TaskID       string
    Phase        string
    Plan         *Plan
    Chunks       []Chunk
    CurrentChunk int
    Errors       []Error
    // ... etc
}

// Pure function: Event + State → New State
func Reduce(state TaskState, event Event) TaskState {
    switch event.Type {
    case "task.created":
        var data TaskCreatedData
        json.Unmarshal(event.Data, &data)
        return TaskState{
            TaskID: event.TaskID,
            Phase:  "init",
            Description: data.Description,
        }

    case "plan.ready":
        var data PlanReadyData
        json.Unmarshal(event.Data, &data)
        state.Plan = &data
        state.Phase = "plan_review"
        return state

    case "user.approved_plan":
        state.Phase = "executing"
        return state

    case "chunk.completed":
        state.CurrentChunk++
        return state

    // ... etc
    }
    return state
}

// Replay all events to get current state
func ReplayEvents(events []Event) TaskState {
    state := TaskState{}
    for _, event := range events {
        state = Reduce(state, event)
    }
    return state
}
```

---

## Component Lifecycle

### NATS Server (runs once, forever)

```bash
# Install
brew install nats-server  # Mac
# or download from https://nats.io

# Start with JetStream enabled
nats-server -js -m 8222

# Or as service
brew services start nats-server
```

### agneto-server (orchestrator)

**Startup Flow:**
1. Connect to NATS
2. Create task (emit `agneto.tasks.{id}.created`)
3. Subscribe to task event stream (`agneto.events.{taskID}.>`)
4. Begin state machine execution
5. Emit events as work progresses

**CLI:**
```bash
# Start orchestrator for a task
agneto-server start "implement feature X" \
  --nats-url nats://localhost:4222 \
  --task-id abc123

# Daemon mode (waits for task creation events)
agneto-server daemon --nats-url nats://localhost:4222

# Create task remotely (doesn't start server)
agneto-server create "task description" --nats-url nats://remote:4222
```

**Event Flow (Orchestrator):**
```
Read event from stream
  ↓
Reduce into state
  ↓
Execute business logic (state machine transition)
  ↓
Invoke agents if needed
  ↓
Emit new domain events
  ↓
Repeat
```

### agneto-tui (view layer)

**Startup Flow:**
1. Connect to NATS
2. Query task registry (list available tasks)
3. Select task (auto-discover latest or specify)
4. Subscribe to task event stream
5. Replay all events from sequence 0
6. Rebuild state via reduction
7. Render UI
8. Subscribe to new events (live updates)

**CLI:**
```bash
# Auto-discover and attach to latest task
agneto-tui --nats-url nats://localhost:4222

# Attach to specific task
agneto-tui --task-id abc123

# List available tasks
agneto-tui list

# Debug: replay events
agneto-tui replay --task-id abc123 --from-seq 0 --to-seq 100
```

**Event Flow (TUI):**
```
Receive event from stream
  ↓
Reduce into UI state
  ↓
Re-render Bubbletea UI
  ↓
User presses key
  ↓
Emit command event (e.g., user.approved_plan)
  ↓
Repeat
```

**Key Insight:** TUI is purely reactive. It never "calls" the orchestrator - it just emits events.

### agneto-bridge (HTTP ↔ NATS)

**Purpose:** Enable non-NATS clients (mobile, web) to interact via HTTP

**Endpoints:**

```
POST   /events                    - Publish event
GET    /events/:taskID/stream     - Subscribe (SSE)
GET    /events/:taskID            - Get all events (replay)
GET    /tasks                     - List active tasks
GET    /tasks/:taskID/state       - Get current computed state
```

**Implementation:**
```go
type Bridge struct {
    nc *nats.Conn
}

// POST /events - Publish event
func (b *Bridge) PublishEvent(w http.ResponseWriter, r *http.Request) {
    var event Event
    json.NewDecoder(r.Body).Decode(&event)

    // Add metadata
    event.ID = uuid.New()
    event.Timestamp = time.Now()
    event.Source = "mobile"

    // Validate
    if err := validateEvent(event); err != nil {
        http.Error(w, err.Error(), 400)
        return
    }

    // Publish to NATS
    subject := fmt.Sprintf("agneto.events.%s.%s", event.TaskID, event.Type)
    b.nc.Publish(subject, marshal(event))

    w.WriteHeader(http.StatusAccepted)
}

// GET /events/:taskID/stream - Subscribe (SSE)
func (b *Bridge) StreamEvents(w http.ResponseWriter, r *http.Request) {
    taskID := mux.Vars(r)["taskID"]

    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")

    // Subscribe to task events
    sub, _ := b.nc.Subscribe(
        fmt.Sprintf("agneto.events.%s.>", taskID),
        func(msg *nats.Msg) {
            fmt.Fprintf(w, "data: %s\n\n", msg.Data)
            w.(http.Flusher).Flush()
        },
    )
    defer sub.Unsubscribe()

    <-r.Context().Done()
}
```

**CLI:**
```bash
agneto-bridge start \
  --nats-url nats://localhost:4222 \
  --port 8080 \
  --auth-token secret123
```

---

## Mobile Integration

### Mobile as Event Producer/Consumer

The phone is just another client that publishes/subscribes to events.

**Scenarios:**

**1. Approve Plan from Phone**
```bash
curl -X POST https://my-server.com/agneto/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "user.approved_plan",
    "task_id": "abc123"
  }'
```

**2. Monitor Progress (SSE)**
```bash
curl https://my-server.com/agneto/events/abc123/stream

# Receives:
data: {"type":"task.started","sequence":1,...}
data: {"type":"chunk.completed","sequence":15,...}
```

**3. Inject Context (Ctrl+I equivalent)**
```bash
curl -X POST $BRIDGE_URL/events -d '{
  "type": "user.injected_context",
  "task_id": "abc123",
  "data": {
    "message": "Use API v2, not v1"
  }
}'
```

### Mobile Client Options

**1. Shell Script (Termux)**
```bash
#!/bin/bash
agneto-mobile approve abc123
```

**2. iOS Shortcut**
- One-tap approve via home screen widget

**3. Simple Web App (PWA)**
```html
<button onclick="fetch('/events', {
  method: 'POST',
  body: JSON.stringify({type: 'user.approved_plan', task_id: 'abc123'})
})">Approve</button>

<script>
const events = new EventSource('/events/abc123/stream');
events.onmessage = (e) => updateUI(JSON.parse(e.data));
</script>
```

**4. Native App**
- Full Bubbletea-style mobile TUI
- NATS WebSocket client

### Push Notifications

Bridge can watch for critical events and send push:

```go
nc.Subscribe("agneto.events.*.plan.ready", func(msg *nats.Msg) {
    var event Event
    json.Unmarshal(msg.Data, &event)

    // Send push notification to registered devices
    sendPush(event.TaskID, "Plan ready for review")
})
```

**Complete Mobile Flow:**
```
Start task from laptop
  ↓
Phone receives push: "Plan ready"
  ↓
Open web UI, review plan
  ↓
Tap "Approve" button
  ↓
Bridge publishes user.approved_plan event
  ↓
Desktop TUI receives event, updates UI
  ↓
Orchestrator transitions state, continues execution
```

---

## Multi-TUI Scenario

**5 TUIs watching same task:**

```
TUI-1 (Mac)     ──┐
TUI-2 (Linux)   ──┤
TUI-3 (Windows) ──┼──►  NATS  ◄──── agneto-server
TUI-4 (Remote)  ──┤
TUI-5 (iPad)    ──┘
```

**All TUIs see exactly the same state:**
- Same events replayed
- Same reduction function
- Same UI rendered
- All in sync within ~10ms

**Any TUI can send commands:**
```
User at TUI-2 presses "a" to approve
  ↓
TUI-2 emits: agneto.events.abc123.user.approved_plan
  ↓
NATS broadcasts to all subscribers
  ↓
TUI-1, TUI-3, TUI-4, TUI-5 receive event
  ↓
All TUIs reduce event, update state, re-render
  ↓
Orchestrator receives event, transitions, continues work
```

This is **eventually consistent** but practically instant (<10ms typical latency).

---

## Testing Strategy

Event sourcing makes testing trivial - no mocks, no stubs, just pure functions.

### 1. Reducer Testing (Pure Functions)

```go
func TestPlanApproval(t *testing.T) {
    // Given: initial state
    state := TaskState{Phase: "plan_review", Plan: &Plan{...}}

    // When: event occurs
    event := Event{Type: "user.approved_plan", TaskID: "abc123"}
    newState := Reduce(state, event)

    // Then: state transitions correctly
    assert.Equal(t, "executing", newState.Phase)
}
```

### 2. Integration Testing (Event Sequences)

```go
func TestFullTaskLifecycle(t *testing.T) {
    events := []Event{
        {Type: "task.created", Data: marshal(TaskCreatedData{...})},
        {Type: "task.started"},
        {Type: "plan.ready", Data: marshal(PlanReadyData{...})},
        {Type: "user.approved_plan"},
        {Type: "chunk.started", Data: marshal(ChunkStartedData{ChunkID: 1})},
        {Type: "chunk.completed", Data: marshal(ChunkCompletedData{ChunkID: 1})},
        {Type: "task.completed"},
    }

    state := ReplayEvents(events)

    assert.Equal(t, "completed", state.Phase)
    assert.Equal(t, 1, state.CompletedChunks)
}
```

### 3. Property-Based Testing (Invariants)

```go
func TestStateInvariants(t *testing.T) {
    rapid.Check(t, func(t *rapid.T) {
        // Generate random valid event sequence
        events := rapid.SliceOf(rapid.Custom(genValidEvent)).Draw(t, "events")

        state := ReplayEvents(events)

        // Verify invariants always hold
        assert.True(t, state.CompletedChunks <= state.TotalChunks)
        assert.True(t, validPhaseTransition(state.Phase))
    })
}
```

### 4. Regression Testing (Production Logs)

```bash
# Capture production event stream
nats stream get agneto-events \
  --subject agneto.events.abc123.> \
  > test_fixtures/bug_reproduction.json

# Replay in test
func TestBugFix_Issue_456(t *testing.T) {
    events := loadFixture("bug_reproduction.json")
    state := ReplayEvents(events)

    // Verify bug is fixed
    assert.NotNil(t, state)
    assert.False(t, state.HasPanic)
}
```

### 5. Time-Travel Debugging

```bash
# CLI tool for debugging
agneto-debug replay --task-id abc123 --stop-at-seq 42

State at sequence 42:
  Phase: executing
  CurrentChunk: 2
  Error: nil

agneto-debug replay --task-id abc123 --stop-at-seq 43

State at sequence 43:
  Phase: error
  CurrentChunk: 2
  Error: "coder agent timeout"

# Found it! Event 43 caused the error
```

### 6. Chaos Testing

```go
func TestErrorRecovery(t *testing.T) {
    events := []Event{
        {Type: "task.started"},
        {Type: "agent.invoked", Data: marshal(AgentData{Agent: "coder"})},
        {Type: "error.occurred", Data: marshal(ErrorData{Error: "timeout"})},
        {Type: "user.requested_retry"},
        {Type: "agent.invoked", Data: marshal(AgentData{Agent: "coder"})},
        {Type: "chunk.completed"},
    }

    state := ReplayEvents(events)

    // System should recover gracefully
    assert.Equal(t, "executing", state.Phase)
    assert.Equal(t, 1, state.RetryCount)
}
```

**Benefits:**
- No timing issues (events are ordered)
- No network issues (just data)
- No external dependencies (pure computation)
- Fast (thousands of scenarios per second)
- Portable (share fixtures as JSON)

---

## Package Structure

```
github.com/durch/agneto/v2/
├── cmd/
│   ├── server/           # agneto-server binary
│   │   └── main.go
│   ├── tui/              # agneto-tui binary
│   │   └── main.go
│   └── bridge/           # agneto-bridge binary
│       └── main.go
│
├── pkg/
│   ├── bus/              # Event bus interface + NATS impl
│   │   ├── bus.go        # Interface
│   │   ├── nats.go       # NATS implementation
│   │   └── mock.go       # In-memory mock for testing
│   │
│   ├── events/           # Event catalog (THE CONTRACT)
│   │   ├── catalog.go    # All event type constants
│   │   ├── types.go      # Event struct
│   │   └── schemas.go    # Data schemas for each event
│   │
│   ├── state/            # State and reduction logic (shared)
│   │   ├── state.go      # TaskState struct
│   │   ├── reducer.go    # Reduce() function
│   │   └── reducer_test.go
│   │
│   ├── orchestrator/     # Business logic
│   │   ├── orchestrator.go
│   │   ├── agents.go     # Agent invocation
│   │   └── machine.go    # State machine
│   │
│   ├── tui/              # Bubbletea UI
│   │   ├── model.go      # Bubbletea model
│   │   ├── view.go       # Rendering
│   │   ├── update.go     # Event handling
│   │   └── components/   # Reusable UI components
│   │
│   └── bridge/           # HTTP API
│       ├── server.go
│       ├── handlers.go
│       └── auth.go
│
├── go.mod
└── go.sum
```

**Key Design Decisions:**

1. **`pkg/events` is the contract** - Both orchestrator and TUI import this. Changing event schemas requires coordinated updates.

2. **`pkg/state` is shared** - Both orchestrator and TUI use the same `Reduce()` function to ensure consistent state.

3. **`pkg/bus` is abstracted** - Interface allows swapping NATS for other implementations (e.g., Kafka, in-memory).

---

## Event Bus Interface

```go
// pkg/bus/bus.go
package bus

type EventBus interface {
    // Publish a new event to the stream
    Publish(ctx context.Context, event events.Event) error

    // Subscribe to events (from specific sequence onwards)
    Subscribe(ctx context.Context, opts SubscribeOpts) (<-chan events.Event, error)

    // Get all events for a task (replay)
    Replay(ctx context.Context, taskID string, fromSeq int64) ([]events.Event, error)

    // Close connection
    Close() error
}

type SubscribeOpts struct {
    TaskID      string   // Filter by task ID
    FromSeq     int64    // Start from sequence (0 = beginning)
    EventTypes  []string // Filter by event types (optional)
}
```

**NATS Implementation:**
```go
// pkg/bus/nats.go
package bus

import (
    "github.com/nats-io/nats.go"
)

type NATSBus struct {
    nc *nats.Conn
    js nats.JetStreamContext
}

func NewNATSBus(url string) (*NATSBus, error) {
    nc, err := nats.Connect(url)
    if err != nil {
        return nil, err
    }

    js, err := nc.JetStream()
    if err != nil {
        return nil, err
    }

    return &NATSBus{nc: nc, js: js}, nil
}

func (b *NATSBus) Publish(ctx context.Context, event events.Event) error {
    subject := fmt.Sprintf("agneto.events.%s.%s", event.TaskID, event.Type)
    data, _ := json.Marshal(event)
    _, err := b.js.Publish(subject, data)
    return err
}

func (b *NATSBus) Subscribe(ctx context.Context, opts SubscribeOpts) (<-chan events.Event, error) {
    ch := make(chan events.Event, 100)

    subject := fmt.Sprintf("agneto.events.%s.>", opts.TaskID)

    sub, err := b.js.Subscribe(subject, func(msg *nats.Msg) {
        var event events.Event
        json.Unmarshal(msg.Data, &event)

        if event.Sequence >= opts.FromSeq {
            ch <- event
        }
    }, nats.DeliverAll()) // Replay from beginning

    if err != nil {
        return nil, err
    }

    go func() {
        <-ctx.Done()
        sub.Unsubscribe()
        close(ch)
    }()

    return ch, nil
}
```

---

## Installation & Deployment

### Quick Start (Docker Compose)

```yaml
# docker-compose.yml
version: '3.8'
services:
  nats:
    image: nats:latest
    command: -js -m 8222
    ports:
      - "4222:4222"  # Client connections
      - "8222:8222"  # Monitoring
    volumes:
      - nats-data:/data

  agneto-server:
    image: durch/agneto-server:latest
    environment:
      - NATS_URL=nats://nats:4222
    depends_on:
      - nats

  agneto-bridge:
    image: durch/agneto-bridge:latest
    environment:
      - NATS_URL=nats://nats:4222
    ports:
      - "8080:8080"
    depends_on:
      - nats

volumes:
  nats-data:
```

```bash
docker-compose up -d
agneto-tui --nats-url nats://localhost:4222
```

### Native Installation

**1. Install NATS**
```bash
# Mac
brew install nats-server
brew services start nats-server

# Linux
curl -sf https://binaries.nats.dev/nats-io/nats-server@latest | sh

# Start as systemd service
sudo systemctl enable --now nats-server
```

**2. Install Agneto**
```bash
# Go install
go install github.com/durch/agneto/v2/cmd/server@latest
go install github.com/durch/agneto/v2/cmd/tui@latest
go install github.com/durch/agneto/v2/cmd/bridge@latest

# Or download binaries
curl -L https://github.com/durch/agneto/releases/latest/download/agneto-server-$(uname -s) -o agneto-server
curl -L https://github.com/durch/agneto/releases/latest/download/agneto-tui-$(uname -s) -o agneto-tui
chmod +x agneto-*
```

**3. Run**
```bash
# Terminal 1: Start orchestrator
agneto-server start "implement auth feature"
# → Task ID: abc123

# Terminal 2: Attach TUI
agneto-tui --task-id abc123
```

---

## Configuration

### Default Config Locations
```
~/.config/agneto/config.toml
./.agneto/config.toml (project-specific)
```

```toml
[nats]
url = "nats://localhost:4222"
stream_name = "agneto-events"

[server]
workers = 1
log_level = "info"

[tui]
auto_discover = true
theme = "default"
refresh_rate = "100ms"

[bridge]
port = 8080
auth_enabled = true
```

### Environment Variables
```bash
export AGNETO_NATS_URL="nats://localhost:4222"
export AGNETO_LOG_LEVEL="debug"
export AGNETO_AUTH_TOKEN="secret123"
```

---

## Security Considerations

### NATS Authentication
```bash
# Generate credentials
nats-server -js --user admin --pass secret

# Or use token auth
nats-server -js --auth secret_token

# Client connects with auth
agneto-server start "task" --nats-url nats://admin:secret@localhost:4222
```

### Bridge Authentication
```go
// Simple bearer token
func (b *Bridge) AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")
        if !strings.HasPrefix(token, "Bearer ") || !b.validateToken(token[7:]) {
            http.Error(w, "Unauthorized", 401)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

### TLS
```bash
# NATS with TLS
nats-server -js --tlscert server.crt --tlskey server.key

# Clients connect with TLS
agneto-server start "task" --nats-url tls://localhost:4222
```

---

## Benefits of This Architecture

✅ **Decoupled** - Components don't know about each other
✅ **Testable** - Pure functions, replay event sequences
✅ **Debuggable** - Time-travel through event history
✅ **Resilient** - Crash and replay to recover
✅ **Auditable** - Complete history of what happened
✅ **Scalable** - Multiple TUIs, orchestrators can run in parallel
✅ **Reproducible** - Same events = same state (deterministic)
✅ **Mobile-friendly** - Events can come from anywhere
✅ **Collaborative** - Team members can watch same task

---

## Implementation Roadmap

### Phase 1: Core Event System
- [ ] Define event catalog (`pkg/events`)
- [ ] Implement event bus interface (`pkg/bus`)
- [ ] NATS implementation
- [ ] State reducer (`pkg/state`)
- [ ] Unit tests for reducer

### Phase 2: Orchestrator
- [ ] Port state machine from Node.js
- [ ] Agent invocation framework
- [ ] Event emission on state transitions
- [ ] Integration tests with mock bus

### Phase 3: TUI
- [ ] Bubbletea model with event subscription
- [ ] State reduction in TUI
- [ ] Rendering logic
- [ ] User input → command events
- [ ] Multi-TUI testing

### Phase 4: Bridge
- [ ] HTTP server
- [ ] POST /events (publish)
- [ ] GET /events/:id/stream (SSE)
- [ ] Authentication middleware
- [ ] Mobile web UI (simple PWA)

### Phase 5: Deployment
- [ ] Docker images
- [ ] docker-compose.yml
- [ ] Installation scripts
- [ ] Documentation
- [ ] Release binaries

---

## Design Decisions & Trade-offs

### Why NATS over Kafka?
- Lighter weight (20MB vs 500MB+)
- Simpler operations (single binary vs Zookeeper cluster)
- JetStream provides persistence
- Built-in request/reply pattern
- Native Go client

### Why Event Sourcing over REST API?
- Complete audit trail (every state change captured)
- Time-travel debugging
- Easy to add new components (just subscribe)
- Testability (replay events)
- Mobile integration is trivial (just publish events)

### Why Separate TUI from Orchestrator?
- Crash resilience (TUI crash doesn't affect task)
- Multiple observers (5+ TUIs)
- Remote monitoring
- Testing orchestrator without UI

### Event Retention Strategy
- **Development**: In-memory, no persistence
- **Production**: File-based JetStream, retain completed tasks for 30 days
- **Compliance**: EventStoreDB for permanent audit trail

---

## Future Enhancements

- **Snapshotting**: Periodic state snapshots to speed up replay for long-running tasks
- **Event versioning**: Schema evolution strategy for backwards compatibility
- **Multi-task orchestrator**: Single server managing multiple tasks in parallel
- **Collaborative editing**: Multiple users collaborating on same task with conflict resolution
- **Real-time collaboration**: Show which users are watching, who sent which command
- **Analytics**: Query event stream for metrics (completion rates, error patterns, etc.)
- **Distributed orchestrator**: Multiple orchestrator instances for high availability

---

## References

- [NATS Documentation](https://docs.nats.io/)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Bubbletea Framework](https://github.com/charmbracelet/bubbletea)
- [CQRS Journey](https://docs.microsoft.com/en-us/previous-versions/msp-n-p/jj554200(v=pandp.10))

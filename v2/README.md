# Agneto v2 - Event-Sourced TUI POC

This is a minimal proof of concept demonstrating the core architecture of Agneto v2:
- Events published to NATS
- Bubbletea TUI subscribing to events
- Real-time event display

## Architecture

```
Publisher (CLI) ──► NATS ──► TUI (Bubbletea)
                    ▲
                    │
                test.events subject
```

## Prerequisites

1. **NATS Server** - Install and start:
   ```bash
   # Mac
   brew install nats-server
   nats-server

   # Linux
   curl -sf https://binaries.nats.dev/nats-io/nats-server@latest | sh
   ./nats-server

   # Or using Docker
   docker run -p 4222:4222 nats:latest
   ```

2. **Go 1.24+** - The project requires Go 1.24 or later

## Quick Start

### 1. Start NATS Server

In a terminal:
```bash
nats-server
```

You should see:
```
[1] 2024/10/13 21:00:00.000000 [INF] Starting nats-server
[2] 2024/10/13 21:00:00.000000 [INF] Listening for client connections on 0.0.0.0:4222
```

### 2. Start the TUI

In another terminal:
```bash
cd v2
go run cmd/tui/main.go
```

You should see:
```
=== Agneto Event Monitor ===

Listening for events on test.events
Press 'q' to quit

Events received:
---
(no events yet)
```

### 3. Publish Events

In a third terminal:
```bash
cd v2
go run cmd/publisher/main.go "Hello from NATS!"
go run cmd/publisher/main.go "This is event number 2"
go run cmd/publisher/main.go "Events are flowing!"
```

The TUI will update in real-time showing each event as it arrives.

## Project Structure

```
v2/
├── CLAUDE.md              # Architecture documentation
├── README.md              # This file
├── go.mod
├── go.sum
├── cmd/
│   ├── tui/
│   │   └── main.go       # Bubbletea TUI (subscriber)
│   └── publisher/
│       └── main.go       # CLI publisher (test tool)
└── pkg/
    └── events/
        └── types.go      # Event struct definition
```

## How It Works

### Events

Events are simple JSON structures:

```go
type Event struct {
    ID        string    `json:"id"`        // UUID
    Type      string    `json:"type"`      // "test.message"
    Timestamp time.Time `json:"timestamp"` // When it occurred
    Message   string    `json:"message"`   // Event payload
}
```

### Publisher

1. Connects to NATS
2. Creates an event with a unique ID
3. Serializes to JSON
4. Publishes to `test.events` subject

### TUI (Subscriber)

1. Connects to NATS on startup
2. Subscribes to `test.events` subject
3. Listens for incoming events
4. Updates UI in real-time via Bubbletea's message system
5. Displays last 10 events

## Configuration

Both components use the `NATS_URL` environment variable:

```bash
# Default: nats://localhost:4222
export NATS_URL="nats://localhost:4222"

# Remote NATS server
export NATS_URL="nats://remote-server:4222"
```

## Next Steps

This POC validates the core concept. Next phases would add:

1. **JetStream** - Persistent event storage (event sourcing)
2. **Event Catalog** - Typed events with schemas
3. **State Reduction** - Replay events to rebuild state
4. **Multiple TUIs** - Multiple instances watching same stream
5. **Task Isolation** - Separate streams per task
6. **Command Events** - User actions (approve, reject, etc.)

See `CLAUDE.md` for the complete architecture design.

## Testing

### Run the full flow:

```bash
# Terminal 1: NATS
nats-server

# Terminal 2: TUI
go run cmd/tui/main.go

# Terminal 3: Send events
for i in {1..5}; do
  go run cmd/publisher/main.go "Event $i"
  sleep 1
done
```

### Expected behavior:

- TUI connects and shows "Listening for events"
- Each published event appears immediately in the TUI
- Events are displayed with timestamp and message
- Press 'q' to quit cleanly

## Troubleshooting

**"Connection refused"**
- Make sure NATS server is running: `nats-server`
- Check it's listening on 4222: `lsof -i :4222`

**"No events appearing"**
- Verify NATS is running
- Check both TUI and publisher are using same NATS URL
- Try: `export NATS_URL=nats://localhost:4222`

**Build errors**
- Ensure Go 1.24+: `go version`
- Run: `go mod tidy`
- Reinstall deps: `go get -u ./...`

## License

MIT

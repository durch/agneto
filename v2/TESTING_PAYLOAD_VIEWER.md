# Testing Payload Viewer Feature

## Overview

The TUI now supports event selection and payload viewing:
- **Left pane**: Event list with cursor navigation
- **Right pane**: Detailed payload view of selected event
- **Clearing behavior**: Payload pane clears between selections (important for large payloads)

## Features Implemented

1. **Event Selection**
   - Navigate with `↑`/`↓` arrow keys or `j`/`k` (vim-style)
   - Selected event highlighted with `>` cursor and background color

2. **Payload Viewer**
   - Right pane shows formatted JSON payload of selected event
   - Automatically clears when switching to a different event
   - Handles large payloads with word wrapping
   - Shows event metadata when payload is empty

3. **Clear-on-Render**
   - The `renderPayloadPane()` function is called fresh each render
   - Old payload is automatically cleared before new one is displayed
   - No manual clearing logic needed - architectural benefit

## How to Test

### Prerequisites

1. **NATS server must be running:**
   ```bash
   nats-server -js
   ```

2. **Binaries must be built:**
   ```bash
   go build -o bin/tui ./cmd/tui
   go build -o bin/publisher ./cmd/publisher
   ```

   Note: The `nats` CLI is **not required** - the test script uses `./bin/publisher`.

### Test Steps

1. **Start the TUI** (Terminal 1):
   ```bash
   ./bin/tui
   ```

2. **Run the test script** (Terminal 2):
   ```bash
   ./test-payload-viewer.sh
   ```

   This will publish 5 test events with varying payloads:
   - Event 1: Small payload (2 fields)
   - Event 2: Medium payload (nested objects)
   - Event 3: Large payload (complex task data)
   - Event 4: No payload (shows metadata)
   - Event 5: Navigation test event

3. **Test Navigation**:
   - Press `↓` or `j` to move down through events
   - Press `↑` or `k` to move up
   - Observe the right pane clearing and displaying each event's payload

4. **Test Clearing Behavior**:
   - Navigate to event 3 (large payload)
   - Observe the large JSON payload displayed
   - Navigate to event 5
   - **The large payload should clear before event 5's payload appears**
   - This is the key feature - no remnants of the previous payload

### Manual Testing

You can also publish custom events using the publisher:

```bash
# Event with custom payload
./bin/publisher --type "custom.test" \
  --data-json '{"your":"data","goes":"here"}' \
  "Custom test event"

# Event with no payload
./bin/publisher --type "simple.event" "Just a message"

# Event to right pane
./bin/publisher --pane right --type "error.event" \
  --data-json '{"error_code":500,"details":"Something went wrong"}' \
  "Error occurred"
```

## Expected Behavior

### Left Pane (Event List)
```
Left Pane
──────────────────────────────
  [15:04:01] test.small_payload: Event with small payload
> [15:04:02] test.medium_payload: Event with medium payload  ← Selected
  [15:04:03] test.large_payload: Event with large payload
  [15:04:04] test.no_payload: Event with no payload data
  [15:04:05] test.navigation: Navigate here to see clearing
```

### Right Pane (Payload Viewer)
```
Event Payload
──────────────────────────────
Type: test.medium_payload | Time: 15:04:02

{
  "size": "medium",
  "user": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "metadata": {
    "created_at": "2025-10-14T15:04:02Z",
    "tags": [
      "test",
      "demo",
      "payload"
    ]
  }
}
```

## Implementation Details

### Clear-on-Render Pattern

The clearing behavior is achieved through the render architecture:

```go
// renderPayloadPane is called fresh each render
func renderPayloadPane(selectedEvent *events.Event, width, height int) string {
    var content strings.Builder  // Fresh buffer each time

    // AIDEV-NOTE: Clear-on-render - this function is called fresh each time,
    // so old payload is automatically cleared before rendering new one

    if selectedEvent == nil {
        // Show "no event selected"
    } else if selectedEvent.Data == nil {
        // Show event metadata
    } else {
        // Format and display JSON payload
        jsonBytes, _ := json.MarshalIndent(selectedEvent.Data, "", "  ")
        // ... render JSON
    }

    return paneStyle.Render(content.String())
}
```

Key points:
- Function is **stateless** - no persistent state between calls
- Creates fresh `strings.Builder` each invocation
- Previous render is completely discarded
- This is the Bubbletea/functional rendering pattern

### State Management

Selection state is stored in the model:

```go
type model struct {
    selectedEventIndex int  // Index in left pane's event list
    // ... other fields
}
```

Keyboard navigation updates this index:
```go
case "up", "k":
    if m.selectedEventIndex > 0 {
        m.selectedEventIndex--
    }
case "down", "j":
    if m.selectedEventIndex < len(events) - 1 {
        m.selectedEventIndex++
    }
```

Each render uses current index to:
1. Highlight the selected event in left pane
2. Fetch the event by index
3. Render its payload in right pane

## Troubleshooting

**Q: Payload not updating when navigating?**
- Check that events have `pane: "left"` (not "right")
- Ensure events have valid `data` field

**Q: Selection not visible?**
- Look for `>` cursor next to selected event
- Selected event should have highlighted background

**Q: Old payload still visible?**
- This shouldn't happen with current architecture
- If it does, it's a bug - the render is not being called fresh

## Next Steps

Potential enhancements:
- [ ] Scrolling for very large payloads
- [ ] Search/filter events
- [ ] Copy payload to clipboard
- [ ] Export payload to file
- [ ] Syntax highlighting for JSON
- [ ] Collapsible JSON tree view

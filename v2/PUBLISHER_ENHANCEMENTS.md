# Publisher Enhancements

## Overview

The `publisher` utility has been extended with two new flags to support custom event types and data payloads, making it more flexible for testing and demonstration purposes.

## New Flags

### `--type <event-type>`
Customizes the event type field (defaults to `"test.message"`).

**Example:**
```bash
./bin/publisher --type "user.login" "User logged in successfully"
```

### `--data-json <json-object>`
Adds a custom data payload to the event. Accepts inline JSON object as a string.

**Example:**
```bash
./bin/publisher --data-json '{"user_id":123,"ip":"192.168.1.1"}' "User activity"
```

## Combined Usage

Both flags can be used together:

```bash
./bin/publisher \
  --type "task.completed" \
  --data-json '{"task_id":"abc123","duration":45,"status":"success"}' \
  "Task completed successfully"
```

## Updated Usage

```
Usage: publisher [options] <message>

Options:
  --pane <left|right>        Target pane (default: left)
  --type <event-type>        Event type (default: test.message)
  --data-json <json>         Event data payload as JSON object
  --actions-json <json>      Actions as inline JSON array
  --actions-file <path>      Actions from JSON file

Examples:
  publisher "hello"
  publisher --pane right "error message"
  publisher --type "custom.event" "Custom event"
  publisher --data-json '{"count":42,"status":"ok"}' "With payload"
  publisher --actions-file examples/approve-reject.json "Plan ready"
```

## Test Script Updated

The `test-payload-viewer.sh` script has been rewritten to use these new flags instead of the `nats` CLI:

**Before (required nats CLI):**
```bash
nats pub test.events "$(cat <<EOF
{
  "id": "test-1",
  "type": "test.small_payload",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "message": "Event with small payload",
  "pane": "left",
  "data": {
    "size": "small",
    "count": 42
  }
}
EOF
)"
```

**After (uses publisher):**
```bash
./bin/publisher --type "test.small_payload" \
  --data-json '{"size":"small","count":42}' \
  "Event with small payload"
```

## Benefits

1. **No external dependencies** - Test script works with just the publisher binary
2. **Cleaner syntax** - Flags are easier to read than JSON heredocs
3. **Better validation** - Publisher validates JSON and provides clear error messages
4. **Consistent timestamps** - Publisher generates timestamps automatically
5. **More flexible** - Can easily customize event types and payloads for testing

## Implementation Details

### Data Parsing

The `--data-json` flag is parsed and validated:

```go
if *dataJSON != "" {
    var data map[string]interface{}
    if err := json.Unmarshal([]byte(*dataJSON), &data); err != nil {
        log.Fatalf("Failed to parse --data-json: %v", err)
    }
    event.Data = data
    fmt.Printf("Loaded data payload with %d fields\n", len(data))
}
```

### Type Customization

The event type is now configurable via flag:

```go
event := events.Event{
    ID:        uuid.New().String(),
    Type:      *typeFlag,  // Previously hardcoded to "test.message"
    Timestamp: time.Now(),
    Message:   message,
    Pane:      *paneFlag,
}
```

## Testing

The enhanced publisher has been tested with:

```bash
# Simple custom type
./bin/publisher --type "test.custom" "Custom message"

# Custom data payload
./bin/publisher --data-json '{"foo":"bar"}' "Message with data"

# Combined
./bin/publisher --type "test.combined" \
  --data-json '{"nested":{"value":123}}' \
  "Both type and data"

# Complex nested payload
./bin/publisher --type "test.large" \
  --data-json '{"task":{"id":"abc","chunks":[1,2,3]}}' \
  "Complex payload"
```

All tests pass successfully.

## Backwards Compatibility

All existing functionality is preserved:
- Default event type is still `"test.message"`
- All existing flags work as before
- Scripts using basic `./bin/publisher "message"` continue to work
- Actions (--actions-json, --actions-file) work with new flags

## Future Enhancements

Potential additions:
- `--data-file <path>` to load payload from JSON file
- `--pane-data <json>` to set different pane per event based on payload
- Validation schemas for specific event types

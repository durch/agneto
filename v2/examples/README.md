# Action Examples

This directory contains example JSON files for defining dynamic actions (buttons) in the TUI.

## Structure

Each JSON file is an array of actions:

```json
[
  {
    "id": "unique-id",
    "label": "Button Text",
    "key": "keyboard-shortcut",
    "event": {
      "type": "event.type",
      "message": "Event message",
      "pane": "left|right",
      "data": {
        "key": "value"
      }
    }
  }
]
```

## Available Examples

### `approve-reject.json`

Standard approval workflow with two buttons:
- **[a] Approve** → Publishes `user.approved` to left pane
- **[r] Reject** → Publishes `user.rejected` to right pane

**Usage:**
```bash
./bin/publisher --actions-file examples/approve-reject.json "Plan ready - 5 chunks, \$0.50 cost"
```

### `retry-skip-abort.json`

Error recovery workflow with three options:
- **[r] Retry** → Publishes `user.retry`
- **[s] Skip** → Publishes `user.skip`
- **[a] Abort** → Publishes `user.abort` to right pane

**Usage:**
```bash
./bin/publisher --actions-file examples/retry-skip-abort.json "Chunk 3 failed - what do you want to do?"
```

### `choice-1-2-3.json`

Multiple choice selection with context:
- **[1] Option 1: Fast Path** → `user.chose.1` (fast)
- **[2] Option 2: Safe Path** → `user.chose.2` (safe)
- **[3] Option 3: Experimental** → `user.chose.3` (experimental, right pane)

**Usage:**
```bash
./bin/publisher --actions-file examples/choice-1-2-3.json "Select deployment strategy"
```

### `multiline-input.json`

Multiline text input for free-form user responses:
- **Provide Context** → Opens textarea in right pane, user types response
- **Ctrl+Enter** to submit → Publishes `context.provided` with user input
- **Esc** to cancel → Returns to normal mode

**Usage:**
```bash
./bin/publisher --actions-file examples/multiline-input.json "Please provide additional context for this task"
```

**Note:** When `input_type: "multiline"` is set, the action doesn't use a keyboard shortcut. Instead, it automatically enters input mode and the right pane becomes a textarea. The user's input is published in the `data.input` field when they press Ctrl+Enter.

## Creating Custom Actions

You can create your own action files or pass inline JSON:

### From File

```bash
cat > my-actions.json <<EOF
[
  {
    "id": "yes",
    "label": "Yes, continue",
    "key": "y",
    "event": {
      "type": "user.confirmed",
      "message": "User confirmed to continue",
      "data": {"confirmed": true}
    }
  },
  {
    "id": "no",
    "label": "No, stop",
    "key": "n",
    "event": {
      "type": "user.cancelled",
      "message": "User cancelled operation",
      "data": {"confirmed": false}
    }
  }
]
EOF

./bin/publisher --actions-file my-actions.json "Continue with operation?"
```

### Inline JSON

```bash
./bin/publisher --actions-json '[{"id":"ok","label":"OK","key":"o","event":{"type":"user.ok","message":"OK pressed"}}]' "Press OK to continue"
```

## Field Reference

### Action Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the action |
| `label` | string | Yes | Text displayed on button or input prompt |
| `key` | string | Conditional | Keyboard shortcut (single character). Not used when `input_type` is set. |
| `input_type` | string | No | Set to "multiline" to trigger textarea input mode |
| `event` | Event | Yes | Complete event to publish when triggered |

### Event Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Event type (e.g., "user.approved") |
| `message` | string | No | Event message displayed in pane |
| `pane` | string | No | Target pane: "left", "right", or empty for default |
| `data` | object | No | Arbitrary JSON data to include with event |

## Tips

1. **Keep key shortcuts unique** - Avoid conflicts with built-in keys like 'q' (quit)
2. **Use descriptive event types** - Follow pattern: `category.action` (e.g., `user.approved`, `plan.rejected`)
3. **Include context in data** - Add task_id, chunk_id, timestamps, etc. for rich responses
4. **Route strategically** - Use panes to separate approval/rejection or different types of responses
5. **Test with publisher** - Use `--actions-file` to quickly iterate on your action definitions

## Orchestrator Integration

In your orchestrator, create events with actions like this:

```go
event := events.Event{
    Type: "plan.ready",
    Message: "Plan has 5 chunks, $0.50 estimated cost",
    Data: map[string]interface{}{
        "chunks": 5,
        "cost": 0.50,
        "task_id": "abc123",
    },
    Actions: loadActionsFromFile("examples/approve-reject.json"),
}
```

The TUI will display the buttons, and when clicked, publish the exact events you defined.

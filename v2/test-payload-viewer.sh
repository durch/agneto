#!/bin/bash
# Test script for payload viewer functionality
# This script publishes several events with different payloads to test the new navigation and payload display

set -e

echo "Testing Payload Viewer Feature"
echo "=============================="
echo ""
echo "This script will publish several events with different payloads."
echo "In the TUI, use ↑/↓ or j/k to navigate between events."
echo "The right pane will show the payload of the selected event and clear between selections."
echo ""
echo "Press Enter to start..."
read

# Event 1: Small payload
echo "Publishing event 1 with small payload..."
./bin/publisher --type "test.small_payload" \
  --data-json '{"size":"small","count":42}' \
  "Event with small payload"

sleep 1

# Event 2: Medium payload
echo "Publishing event 2 with medium payload..."
./bin/publisher --type "test.medium_payload" \
  --data-json '{"size":"medium","user":{"id":123,"name":"John Doe","email":"john@example.com"},"metadata":{"created_at":"2025-10-14T12:00:00Z","tags":["test","demo","payload"]}}' \
  "Event with medium payload"

sleep 1

# Event 3: Large payload
echo "Publishing event 3 with large payload..."
./bin/publisher --type "test.large_payload" \
  --data-json '{"size":"large","task":{"id":"task-abc-123","description":"Implement feature X","status":"in_progress","chunks":[{"id":1,"status":"completed","files_modified":5},{"id":2,"status":"completed","files_modified":3},{"id":3,"status":"in_progress","files_modified":0},{"id":4,"status":"pending","files_modified":0},{"id":5,"status":"pending","files_modified":0}],"metrics":{"tokens_used":15000,"cost_usd":0.045,"duration_seconds":120},"errors":[],"warnings":["Potential type error in chunk 3","Consider adding tests"]},"context":{"repo":"github.com/user/project","branch":"feature/x","commit":"a1b2c3d4"}}' \
  "Event with large payload - shows clearing behavior"

sleep 1

# Event 4: Empty payload (no --data-json flag)
echo "Publishing event 4 with no payload..."
./bin/publisher --type "test.no_payload" \
  "Event with no payload data"

sleep 1

# Event 5: Another event to navigate to
echo "Publishing event 5..."
./bin/publisher --type "test.navigation" \
  --data-json '{"note":"When you navigate from event 3 to this event, the large payload should clear first","clearing_works":true}' \
  "Navigate here to see clearing"

echo ""
echo "✓ Published 5 test events!"
echo ""
echo "Now in the TUI:"
echo "  • Use ↑/↓ or j/k to navigate between events"
echo "  • Watch the right pane clear and display each event's payload"
echo "  • Event 3 has a large payload - navigating away should clear it"
echo "  • Event 4 has no payload - should show metadata instead"

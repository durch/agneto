#!/bin/bash
# Test script for blocking action behavior
# This script tests that events with actions block further events until action is taken

set -e

echo "Testing Blocking Action Behavior"
echo "=================================="
echo ""
echo "This script will:"
echo "  1. Publish Event #1 (no actions) - should appear immediately"
echo "  2. Publish Event #2 WITH actions - should BLOCK new events"
echo "  3. Wait 2 seconds"
echo "  4. Publish Event #3 (no actions) - should NOT appear until you respond to Event #2"
echo ""
echo "Expected behavior:"
echo "  - Event #1 appears"
echo "  - Event #2 appears with orange highlight and [a] Approve [r] Reject buttons"
echo "  - Action bar shows: ⚠️  Event #1 requires action (blocking new events)"
echo "  - Event #3 does NOT appear yet (blocked)"
echo "  - After you press 'a' or 'r', Event #3 appears"
echo ""
echo "Press Enter to start..."
read

echo "Publishing Event #1 (no actions)..."
./bin/publisher --type "test.normal" \
  --data-json '{"step":1,"has_actions":false}' \
  "Event 1 - normal event"

sleep 2

echo "Publishing Event #2 WITH ACTIONS (this should block)..."
./bin/publisher --type "plan.ready" \
  --data-json '{"step":2,"plan_chunks":5,"estimated_cost":0.50}' \
  --actions-file examples/approve-reject.json \
  "Event 2 - Plan ready (approve or reject)"

echo ""
echo "⏳ Waiting 2 seconds before publishing Event #3..."
sleep 2

echo "Publishing Event #3 (should be blocked until you respond to Event #2)..."
./bin/publisher --type "test.blocked" \
  --data-json '{"step":3,"note":"This event should not appear until Event 2 action is taken"}' \
  "Event 3 - This should be blocked"

echo ""
echo "✓ All events published!"
echo ""
echo "In the TUI, you should see:"
echo "  - Event #1 displayed"
echo "  - Event #2 displayed with ⚠️ orange highlight"
echo "  - Action bar: ⚠️  Event #1 requires action (blocking new events) [a] Approve [r] Reject"
echo "  - Event #3 NOT visible yet"
echo ""
echo "After you press 'a' or 'r':"
echo "  - Event #2's orange highlight should disappear"
echo "  - Event #3 should appear"
echo "  - Action bar should show: (no actions available)"
echo ""
echo "Test one-shot behavior:"
echo "  - Try pressing 'a' or 'r' again - nothing should happen (action consumed)"

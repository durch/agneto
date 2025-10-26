package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/durch/agneto/v2/pkg/events"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

func main() {
	// Define flags
	paneFlag := flag.String("pane", "left", "Target pane: left or right")
	typeFlag := flag.String("type", "test.message", "Event type")
	dataJSON := flag.String("data-json", "", "Inline JSON object for event data/payload")
	actionsJSON := flag.String("actions-json", "", "Inline JSON array of actions")
	actionsFile := flag.String("actions-file", "", "Path to JSON file containing actions")
	flag.Parse()

	// Get message from remaining args
	if flag.NArg() < 1 {
		fmt.Println("Usage: publisher [options] <message>")
		fmt.Println("\nOptions:")
		fmt.Println("  --pane <left|right>        Target pane (default: left)")
		fmt.Println("  --type <event-type>        Event type (default: test.message)")
		fmt.Println("  --data-json <json>         Event data payload as JSON object")
		fmt.Println("  --actions-json <json>      Actions as inline JSON array")
		fmt.Println("  --actions-file <path>      Actions from JSON file")
		fmt.Println("\nExamples:")
		fmt.Println("  publisher \"hello\"")
		fmt.Println("  publisher --pane right \"error message\"")
		fmt.Println("  publisher --type \"custom.event\" \"Custom event\"")
		fmt.Println("  publisher --data-json '{\"count\":42,\"status\":\"ok\"}' \"With payload\"")
		fmt.Println("  publisher --actions-file examples/approve-reject.json \"Plan ready\"")
		os.Exit(1)
	}
	message := flag.Arg(0)

	// Connect to NATS
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = nats.DefaultURL // localhost:4222
	}

	nc, err := nats.Connect(natsURL)
	if err != nil {
		log.Fatal(err)
	}
	defer nc.Close()

	fmt.Printf("Connected to NATS at %s\n", natsURL)

	// Create event
	event := events.Event{
		ID:        uuid.New().String(),
		Type:      *typeFlag,
		Timestamp: time.Now(),
		Message:   message,
		Pane:      *paneFlag,
	}

	// Parse data JSON if provided
	if *dataJSON != "" {
		var data map[string]interface{}
		if err := json.Unmarshal([]byte(*dataJSON), &data); err != nil {
			log.Fatalf("Failed to parse --data-json: %v", err)
		}
		event.Data = data
		fmt.Printf("Loaded data payload with %d fields\n", len(data))
	}

	// Parse actions from JSON if provided
	var actions []events.Action

	if *actionsJSON != "" && *actionsFile != "" {
		log.Fatal("Cannot specify both --actions-json and --actions-file")
	}

	if *actionsJSON != "" {
		var err error
		actions, err = parseActionsFromJSON([]byte(*actionsJSON))
		if err != nil {
			log.Fatalf("Failed to parse --actions-json: %v", err)
		}
		fmt.Printf("Loaded %d actions from inline JSON\n", len(actions))
	} else if *actionsFile != "" {
		data, err := os.ReadFile(*actionsFile)
		if err != nil {
			log.Fatalf("Failed to read --actions-file: %v", err)
		}
		var parseErr error
		actions, parseErr = parseActionsFromJSON(data)
		if parseErr != nil {
			log.Fatalf("Failed to parse actions from file: %v", parseErr)
		}
		fmt.Printf("Loaded %d actions from %s\n", len(actions), *actionsFile)
	}

	if len(actions) > 0 {
		event.Actions = actions
		// Display what actions were added
		for _, action := range actions {
			if action.InputType == "multiline" {
				fmt.Printf("  [INPUT] %s → event type: %s\n", action.Label, action.Event.Type)
			} else {
				fmt.Printf("  [%s] %s → event type: %s\n", action.Key, action.Label, action.Event.Type)
			}
		}
	}

	// Serialize to JSON
	data, err := event.ToJSON()
	if err != nil {
		log.Fatal(err)
	}

	// Publish to test.events subject
	subject := "test.events"
	err = nc.Publish(subject, data)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Published event to %s (pane: %s): %s\n", subject, *paneFlag, message)

	// If actions were included, wait for response
	if len(actions) > 0 {
		fmt.Println("\nWaiting for user response (timeout: 30s)...")
		waitForResponse(nc, actions, 30*time.Second)
	}
}

// parseActionsFromJSON parses a JSON array of actions
func parseActionsFromJSON(data []byte) ([]events.Action, error) {
	var actions []events.Action
	if err := json.Unmarshal(data, &actions); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	// Validate each action
	for i, action := range actions {
		if action.ID == "" {
			return nil, fmt.Errorf("action[%d]: missing 'id' field", i)
		}
		if action.Label == "" {
			return nil, fmt.Errorf("action[%d]: missing 'label' field", i)
		}
		// Key is only required for non-input actions
		if action.Key == "" && action.InputType == "" {
			return nil, fmt.Errorf("action[%d]: missing 'key' field (required unless input_type is set)", i)
		}
		if action.Event.Type == "" {
			return nil, fmt.Errorf("action[%d]: missing 'event.type' field", i)
		}
	}

	return actions, nil
}

// waitForResponse subscribes to events and waits for a response matching expected action types
func waitForResponse(nc *nats.Conn, actions []events.Action, timeout time.Duration) {
	// Extract expected response types from actions
	expectedTypes := make(map[string]bool)
	for _, action := range actions {
		expectedTypes[action.Event.Type] = true
	}

	// Create subscription
	msgChan := make(chan *nats.Msg, 64)
	sub, err := nc.ChanSubscribe("test.events", msgChan)
	if err != nil {
		fmt.Printf("Failed to subscribe for response: %v\n", err)
		return
	}
	defer sub.Unsubscribe()

	// Wait for response or timeout
	timeoutChan := time.After(timeout)

	for {
		select {
		case msg := <-msgChan:
			// Parse event
			event, err := events.FromJSON(msg.Data)
			if err != nil {
				continue
			}

			// Check if this is a response we're looking for
			if expectedTypes[event.Type] {
				fmt.Printf("\n✓ Received response!\n")
				fmt.Printf("  Type: %s\n", event.Type)
				fmt.Printf("  Time: %s\n", event.Timestamp.Format("15:04:05"))
				fmt.Printf("  Message: %s\n", event.Message)
				fmt.Printf("  Pane: %s\n", event.Pane)
				if len(event.Data) > 0 {
					fmt.Printf("  Data:\n")
					for key, value := range event.Data {
						fmt.Printf("    %s: %v\n", key, value)
					}
				}
				return
			}

		case <-timeoutChan:
			fmt.Println("\n⏱ Timeout - no response received")
			return
		}
	}
}

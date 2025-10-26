package events

import (
	"encoding/json"
	"time"
)

// Event represents a basic event in the system
type Event struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Timestamp time.Time              `json:"timestamp"`
	Message   string                 `json:"message"`
	Pane      string                 `json:"pane,omitempty"`    // Target pane: "left", "right", or empty for default
	Content   string                 `json:"content,omitempty"` // Raw text/markdown content for display (no preprocessing)
	Data      map[string]interface{} `json:"data,omitempty"`    // Arbitrary payload data (formatted as JSON if Content is empty)
	Actions   []Action               `json:"actions,omitempty"` // Optional actions (dynamic buttons)
}

// Action represents a user action that can be triggered (e.g., button press)
// When triggered, the complete Event is published (with ID and Timestamp added by TUI)
type Action struct {
	ID        string `json:"id"`                   // Unique action ID
	Label     string `json:"label"`                // Button display text (e.g., "Approve")
	Key       string `json:"key"`                  // Keyboard shortcut (e.g., "a") - ignored when InputType is set
	InputType string `json:"input_type,omitempty"` // Optional: "multiline" triggers textarea input mode
	Event     Event  `json:"event"`                // Complete event to publish when action is triggered
}

// ToJSON serializes the event to JSON
func (e Event) ToJSON() ([]byte, error) {
	return json.Marshal(e)
}

// FromJSON deserializes an event from JSON
func FromJSON(data []byte) (*Event, error) {
	var event Event
	err := json.Unmarshal(data, &event)
	if err != nil {
		return nil, err
	}
	return &event, nil
}

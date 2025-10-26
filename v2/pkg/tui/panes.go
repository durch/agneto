package tui

import (
	"github.com/durch/agneto/v2/pkg/events"
)

// Pane represents a single display pane in the TUI
type Pane struct {
	Name      string          // Pane identifier (e.g., "left", "right")
	Title     string          // Display title
	Events    []events.Event  // Events in this pane
	MaxEvents int             // Maximum events to keep
	Scroll    int             // Scroll position (for future use)
}

// NewPane creates a new pane with the given name and title
func NewPane(name, title string, maxEvents int) *Pane {
	return &Pane{
		Name:      name,
		Title:     title,
		Events:    make([]events.Event, 0),
		MaxEvents: maxEvents,
		Scroll:    0,
	}
}

// AddEvent adds an event to the pane, maintaining the max events limit
func (p *Pane) AddEvent(event events.Event) {
	p.Events = append(p.Events, event)

	// Keep only the last MaxEvents
	if len(p.Events) > p.MaxEvents {
		p.Events = p.Events[1:]
	}
}

// Clear removes all events from the pane
func (p *Pane) Clear() {
	p.Events = make([]events.Event, 0)
}

// PaneManager manages multiple panes and routes events to them
type PaneManager struct {
	Panes       map[string]*Pane
	DefaultPane string // Pane to use when event.Pane is empty
}

// NewPaneManager creates a new pane manager with left and right panes
func NewPaneManager(maxEventsPerPane int) *PaneManager {
	return &PaneManager{
		Panes: map[string]*Pane{
			"left":  NewPane("left", "Left Pane", maxEventsPerPane),
			"right": NewPane("right", "Right Pane", maxEventsPerPane),
		},
		DefaultPane: "left",
	}
}

// RouteEvent routes an event to the appropriate pane
func (pm *PaneManager) RouteEvent(event events.Event) {
	// Use event's pane field, or default if empty
	targetPane := event.Pane
	if targetPane == "" {
		targetPane = pm.DefaultPane
	}

	// Add to the target pane if it exists
	if pane, exists := pm.Panes[targetPane]; exists {
		pane.AddEvent(event)
	} else {
		// Fallback to default pane if target doesn't exist
		if pane, exists := pm.Panes[pm.DefaultPane]; exists {
			pane.AddEvent(event)
		}
	}
}

// GetPane returns a pane by name
func (pm *PaneManager) GetPane(name string) *Pane {
	return pm.Panes[name]
}

// GetEventByIndex returns an event from a specific pane by index
// Returns nil if pane doesn't exist or index is out of bounds
func (pm *PaneManager) GetEventByIndex(paneName string, index int) *events.Event {
	pane := pm.GetPane(paneName)
	if pane == nil || index < 0 || index >= len(pane.Events) {
		return nil
	}
	return &pane.Events[index]
}

package tui

import (
	"sort"

	"github.com/durch/agneto/v2/pkg/events"
)

// ActionManager manages dynamic actions (buttons) that can be triggered by user input
type ActionManager struct {
	activeActions map[string]events.Action // Map key → Action
	eventIndex    int                      // Index of event these actions belong to
}

// NewActionManager creates a new action manager
func NewActionManager() *ActionManager {
	return &ActionManager{
		activeActions: make(map[string]events.Action),
	}
}

// RegisterActions adds new actions to the manager, tied to a specific event index
// If an action with the same key already exists, it will be replaced
func (am *ActionManager) RegisterActions(actions []events.Action, eventIndex int) {
	// Clear previous actions (only one event can have pending actions at a time)
	am.activeActions = make(map[string]events.Action)
	am.eventIndex = eventIndex

	for _, action := range actions {
		am.activeActions[action.Key] = action
	}
}

// GetEventIndex returns the index of the event that owns the current actions
func (am *ActionManager) GetEventIndex() int {
	return am.eventIndex
}

// HandleKeyPress checks if a key matches an active action
// If found, returns the action and removes ALL active actions (making a decision clears all options)
func (am *ActionManager) HandleKeyPress(key string) (events.Action, bool) {
	if action, exists := am.activeActions[key]; exists {
		am.ClearAll() // Clear all actions - once you make a decision, other options disappear
		return action, true
	}
	return events.Action{}, false
}

// GetActiveActions returns a sorted list of currently active actions
// Sorted by key for consistent rendering
func (am *ActionManager) GetActiveActions() []events.Action {
	if len(am.activeActions) == 0 {
		return []events.Action{}
	}

	actions := make([]events.Action, 0, len(am.activeActions))
	for _, action := range am.activeActions {
		actions = append(actions, action)
	}

	// Sort by key for predictable order
	sort.Slice(actions, func(i, j int) bool {
		return actions[i].Key < actions[j].Key
	})

	return actions
}

// ClearAll removes all active actions
func (am *ActionManager) ClearAll() {
	am.activeActions = make(map[string]events.Action)
}

// HasActions returns true if there are any active actions
func (am *ActionManager) HasActions() bool {
	return len(am.activeActions) > 0
}

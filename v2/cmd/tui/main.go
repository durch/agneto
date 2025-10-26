package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/durch/agneto/v2/pkg/events"
	"github.com/durch/agneto/v2/pkg/tui"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go"
)

// eventReceivedMsg is sent when we receive an event from NATS
type eventReceivedMsg events.Event

// actionExecutedMsg is sent when an action is successfully published
type actionExecutedMsg struct{ action events.Action }

// inputSubmittedMsg is sent when input is successfully submitted
type inputSubmittedMsg struct{ action events.Action }

// errMsg is sent when an error occurs
type errMsg struct{ err error }

func (e errMsg) Error() string { return e.err.Error() }

// model holds the TUI state
type model struct {
	nc                 *nats.Conn
	sub                *nats.Subscription
	msgChan            chan *nats.Msg    // Channel for receiving events
	paneManager        *tui.PaneManager
	actionManager      *tui.ActionManager
	err                error
	initialized        bool
	width              int
	height             int
	selectedEventIndex int              // Index of selected event in left pane (for payload viewer)
	blockingEventIndex *int             // If non-nil, event index waiting for action (blocks new events)
	consumedActions    map[int]bool     // Track which events have had actions consumed (one-shot)
	inputMode          bool             // If true, right pane shows textarea for input
	inputAction        *events.Action   // The action that triggered input mode
	textarea           textarea.Model   // Textarea component for multiline input
}

// Init is called when the program starts
func (m model) Init() tea.Cmd {
	return connectToNATS
}

// connectToNATS connects to NATS and subscribes to events
func connectToNATS() tea.Msg {
	// Get NATS URL from environment or use default
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = nats.DefaultURL // localhost:4222
	}

	// Connect to NATS
	nc, err := nats.Connect(natsURL)
	if err != nil {
		return errMsg{err}
	}

	return natsConnectedMsg{nc: nc}
}

// natsConnectedMsg is sent when NATS connection is established
type natsConnectedMsg struct{ nc *nats.Conn }

// subscribeToEvents subscribes to the test.events subject
func subscribeToEvents(nc *nats.Conn) tea.Cmd {
	return func() tea.Msg {
		// Create a channel to receive NATS messages
		msgChan := make(chan *nats.Msg, 64)

		// Subscribe to test.events
		sub, err := nc.ChanSubscribe("test.events", msgChan)
		if err != nil {
			return errMsg{err}
		}

		return subscriptionReadyMsg{
			sub:     sub,
			msgChan: msgChan,
		}
	}
}

// subscriptionReadyMsg is sent when subscription is ready
type subscriptionReadyMsg struct {
	sub     *nats.Subscription
	msgChan chan *nats.Msg
}

// waitForEvent waits for the next NATS message
func waitForEvent(msgChan chan *nats.Msg) tea.Cmd {
	return func() tea.Msg {
		msg := <-msgChan
		event, err := events.FromJSON(msg.Data)
		if err != nil {
			return errMsg{err}
		}
		return eventReceivedMsg(*event)
	}
}

// Update handles messages and updates the model
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		// INPUT MODE: Handle textarea input
		if m.inputMode {
			keyStr := msg.String()

			// Check for Alt+Enter (works cross-platform) or specific Ctrl combinations
			// In Bubbletea, Ctrl+Enter is often sent as "ctrl+m" (Enter = Ctrl+M in ASCII)
			if keyStr == "alt+enter" || keyStr == "ctrl+m" ||
			   (msg.Type == tea.KeyEnter && msg.Alt) {
				// Submit input
				if m.inputAction != nil && m.nc != nil {
					inputText := m.textarea.Value()
					return m, publishInputResponseCmd(m.nc, *m.inputAction, inputText)
				}
				return m, nil
			}

			switch keyStr {
			case "ctrl+c":
				// Always allow quit
				if m.sub != nil {
					m.sub.Unsubscribe()
				}
				if m.nc != nil {
					m.nc.Close()
				}
				return m, tea.Quit

			case "esc":
				// Cancel input mode
				m.inputMode = false
				m.inputAction = nil
				m.blockingEventIndex = nil
				// Resume listening for events
				if m.msgChan != nil {
					return m, waitForEvent(m.msgChan)
				}
				return m, nil

			default:
				// Pass all other keys to textarea
				var cmd tea.Cmd
				m.textarea, cmd = m.textarea.Update(msg)
				return m, cmd
			}
		}

		// NORMAL MODE: Handle navigation and actions
		switch msg.String() {
		case "q", "ctrl+c":
			// Clean up
			if m.sub != nil {
				m.sub.Unsubscribe()
			}
			if m.nc != nil {
				m.nc.Close()
			}
			return m, tea.Quit

		case "up", "k":
			// Navigate up in event list
			if m.selectedEventIndex > 0 {
				m.selectedEventIndex--
			}

		case "down", "j":
			// Navigate down in event list
			leftPane := m.paneManager.GetPane("left")
			if leftPane != nil && m.selectedEventIndex < len(leftPane.Events)-1 {
				m.selectedEventIndex++
			}

		default:
			// Check if key matches an active action
			if m.actionManager != nil && m.nc != nil {
				if action, found := m.actionManager.HandleKeyPress(msg.String()); found {
					// Get the event index this action belongs to
					eventIndex := m.actionManager.GetEventIndex()

					// Check if this event's actions have already been consumed (one-shot)
					if m.consumedActions[eventIndex] {
						// Action already taken for this event - ignore
						return m, nil
					}

					// Execute the action
					return m, publishActionResponseCmd(m.nc, action)
				}
			}
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case natsConnectedMsg:
		m.nc = msg.nc
		return m, subscribeToEvents(msg.nc)

	case subscriptionReadyMsg:
		m.sub = msg.sub
		m.msgChan = msg.msgChan
		m.initialized = true
		// Start listening for events
		return m, waitForEvent(msg.msgChan)

	case eventReceivedMsg:
		// Route event to appropriate pane
		event := events.Event(msg)
		m.paneManager.RouteEvent(event)

		// Get the index of this event in the left pane
		leftPane := m.paneManager.GetPane("left")
		eventIndex := len(leftPane.Events) - 1

		// Handle actions if present
		if len(event.Actions) > 0 && m.actionManager != nil {
			// Check if any action has InputType=="multiline"
			var inputAction *events.Action
			for i := range event.Actions {
				if event.Actions[i].InputType == "multiline" {
					inputAction = &event.Actions[i]
					break
				}
			}

			if inputAction != nil {
				// ENTER INPUT MODE
				m.inputMode = true
				m.inputAction = inputAction
				m.blockingEventIndex = &eventIndex
				m.selectedEventIndex = eventIndex

				// Initialize textarea
				ta := textarea.New()
				ta.Placeholder = "" // No placeholder (text is in header above)
				ta.Focus()
				ta.CharLimit = 0              // No limit
				ta.ShowLineNumbers = false    // No line numbers
				ta.Prompt = ""                // Remove prompt prefix

				// Calculate textarea width to match pane content area
				// Pane width = (termWidth - 8) / 2
				// Usable width = pane width - 2 (to match separator line in layout.go:166)
				paneWidth := (m.width - 8) / 2
				textareaWidth := paneWidth - 2
				ta.SetWidth(textareaWidth)
				ta.SetHeight(m.height - 12)
				m.textarea = ta

				// Return textarea's initial command
				return m, textarea.Blink
			}

			// Regular actions (not input) - register them
			m.actionManager.RegisterActions(event.Actions, eventIndex)

			// BLOCK: Set blocking event index and DON'T resume listening
			m.blockingEventIndex = &eventIndex
			m.selectedEventIndex = eventIndex // Auto-select the blocking event

			// Return nil - we're blocked, no new events until action taken
			return m, nil
		}

		// No actions - continue listening for more events
		if m.msgChan != nil {
			return m, waitForEvent(m.msgChan)
		}

	case actionExecutedMsg:
		// Action was successfully published
		// Mark the event as consumed (one-shot)
		if m.blockingEventIndex != nil {
			m.consumedActions[*m.blockingEventIndex] = true
			m.blockingEventIndex = nil // Clear blocking state
		}

		// Resume listening for new events
		if m.msgChan != nil {
			return m, waitForEvent(m.msgChan)
		}

	case inputSubmittedMsg:
		// Input was successfully submitted
		// Clear input mode and resume
		m.inputMode = false
		m.inputAction = nil
		if m.blockingEventIndex != nil {
			m.consumedActions[*m.blockingEventIndex] = true
			m.blockingEventIndex = nil
		}

		// Resume listening for new events
		if m.msgChan != nil {
			return m, waitForEvent(m.msgChan)
		}

	case errMsg:
		m.err = msg.err
		return m, tea.Quit
	}

	return m, nil
}

// subscribeAndWait is a helper to continuously listen for events
func subscribeAndWait(nc *nats.Conn) tea.Cmd {
	return func() tea.Msg {
		msgChan := make(chan *nats.Msg, 64)
		sub, err := nc.ChanSubscribe("test.events", msgChan)
		if err != nil {
			return errMsg{err}
		}
		defer sub.Unsubscribe()

		msg := <-msgChan
		event, err := events.FromJSON(msg.Data)
		if err != nil {
			return errMsg{err}
		}
		return eventReceivedMsg(*event)
	}
}

// publishActionResponseCmd creates a command that publishes an action response to NATS
func publishActionResponseCmd(nc *nats.Conn, action events.Action) tea.Cmd {
	return func() tea.Msg {
		// Use the complete event from the action, just add ID and timestamp
		responseEvent := action.Event
		responseEvent.ID = uuid.New().String()
		responseEvent.Timestamp = time.Now()

		// Serialize to JSON
		data, err := responseEvent.ToJSON()
		if err != nil {
			return errMsg{err}
		}

		// Publish to NATS
		if err := nc.Publish("test.events", data); err != nil {
			return errMsg{err}
		}

		return actionExecutedMsg{action: action}
	}
}

// publishInputResponseCmd creates a command that publishes an input response to NATS
func publishInputResponseCmd(nc *nats.Conn, action events.Action, inputText string) tea.Cmd {
	return func() tea.Msg {
		// Use the complete event from the action
		responseEvent := action.Event
		responseEvent.ID = uuid.New().String()
		responseEvent.Timestamp = time.Now()

		// Add the user's input to the event data
		if responseEvent.Data == nil {
			responseEvent.Data = make(map[string]interface{})
		}
		responseEvent.Data["input"] = inputText

		// Serialize to JSON
		data, err := responseEvent.ToJSON()
		if err != nil {
			return errMsg{err}
		}

		// Publish to NATS
		if err := nc.Publish("test.events", data); err != nil {
			return errMsg{err}
		}

		return inputSubmittedMsg{action: action}
	}
}

// renderActionBar renders the dynamic action buttons at the bottom of the UI
func renderActionBar(actions []events.Action, eventIndex int, isBlocking bool) string {
	if len(actions) == 0 {
		return lipgloss.NewStyle().
			Foreground(lipgloss.Color("240")).
			Render("(no actions available)")
	}

	var result strings.Builder

	// Show warning if blocking
	if isBlocking {
		warning := lipgloss.NewStyle().
			Bold(true).
			Background(lipgloss.Color("214")).
			Foreground(lipgloss.Color("0")).
			Padding(0, 1).
			Render(fmt.Sprintf("⚠️  Event #%d requires action (blocking new events)  ", eventIndex))
		result.WriteString(warning)
		result.WriteString("  ")
	}

	// Render action buttons
	var buttons []string
	for _, action := range actions {
		btn := lipgloss.NewStyle().
			Bold(true).
			Background(lipgloss.Color("62")).   // Green background
			Foreground(lipgloss.Color("230")).  // White text
			Padding(0, 2).
			Render(fmt.Sprintf("[%s] %s", action.Key, action.Label))
		buttons = append(buttons, btn)
	}
	result.WriteString(strings.Join(buttons, "  "))

	return lipgloss.NewStyle().
		MarginTop(1).
		Render(result.String())
}

// renderInputInstructions renders instructions for input mode
func renderInputInstructions(action *events.Action) string {
	if action == nil {
		return ""
	}

	var result strings.Builder

	// Show input mode indicator
	indicator := lipgloss.NewStyle().
		Bold(true).
		Background(lipgloss.Color("62")).
		Foreground(lipgloss.Color("0")).
		Padding(0, 1).
		Render(fmt.Sprintf("📝 INPUT MODE: %s", action.Label))
	result.WriteString(indicator)
	result.WriteString("  ")

	// Show instructions
	instructions := lipgloss.NewStyle().
		Foreground(lipgloss.Color("252")).
		Render("Alt+Enter or Ctrl+M: submit | Esc: cancel")
	result.WriteString(instructions)

	return lipgloss.NewStyle().
		MarginTop(1).
		Render(result.String())
}

// View renders the UI
func (m model) View() string {
	if m.err != nil {
		return fmt.Sprintf("Error: %v\n", m.err)
	}

	if !m.initialized {
		return "Connecting to NATS...\n"
	}

	// Header
	header := "=== Agneto Split-Pane Monitor ===\n"
	header += "Listening for events on test.events | ↑/↓ or j/k: navigate | q: quit\n\n"

	// Use default dimensions if window size not yet received
	width := m.width
	height := m.height
	if width == 0 {
		width = 120
	}
	if height == 0 {
		height = 30
	}

	// Render split layout (reserve space for header and action bar)
	layout := tui.RenderSplitLayout(m.paneManager, m.selectedEventIndex, m.blockingEventIndex, width, height-8, m.inputMode, m.textarea) // -8 for header + action bar

	// Render action bar (or input instructions if in input mode)
	var actionBar string
	if m.inputMode {
		actionBar = renderInputInstructions(m.inputAction)
	} else {
		eventIndex := m.actionManager.GetEventIndex()
		isBlocking := m.blockingEventIndex != nil
		actionBar = renderActionBar(m.actionManager.GetActiveActions(), eventIndex, isBlocking)
	}

	return header + layout + "\n\n" + actionBar
}

func main() {
	// Initialize model with pane manager and action manager
	m := model{
		paneManager:     tui.NewPaneManager(20), // 20 events per pane
		actionManager:   tui.NewActionManager(),
		consumedActions: make(map[int]bool),
	}

	// Start Bubbletea program with alt screen
	p := tea.NewProgram(m, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		log.Fatal(err)
	}
}

package tui

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/lipgloss"
	"github.com/durch/agneto/v2/pkg/events"
)

var (
	// Style for pane borders
	paneStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("240")).
			Padding(0, 1)

	// Style for pane titles
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("99"))

	// Style for event text
	eventStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("252"))

	// Style for timestamps
	timestampStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("243"))
)

// RenderSplitLayout renders a two-pane horizontal split layout
// Left pane shows event list with selection, right pane shows selected event's payload or textarea
func RenderSplitLayout(pm *PaneManager, selectedIndex int, blockingIndex *int, termWidth, termHeight int, inputMode bool, textareaModel textarea.Model) string {
	// Calculate pane dimensions
	// Account for borders: 2 chars per border + 1 char separator = 5 chars total overhead
	// Each pane gets padding: 2 chars (left + right)
	// Total overhead: 4 chars for borders + 4 chars for padding = 8 chars
	paneWidth := (termWidth - 8) / 2

	// Height for content area (minus title, borders, and some padding)
	contentHeight := termHeight - 6

	// Render left pane (event list with selection)
	leftPane := pm.GetPane("left")
	leftContent := renderPane(leftPane, paneWidth, contentHeight, selectedIndex, blockingIndex)

	// Render right pane (payload viewer or textarea)
	selectedEvent := pm.GetEventByIndex("left", selectedIndex)
	rightContent := renderPayloadPane(selectedEvent, paneWidth, contentHeight, inputMode, textareaModel)

	// Join panes horizontally
	layout := lipgloss.JoinHorizontal(
		lipgloss.Top,
		leftContent,
		rightContent,
	)

	return layout
}

// renderPane renders a single pane with its title and events
// If selectedIndex >= 0, that event will be highlighted
// If blockingIndex is non-nil, that event is highlighted as blocking (waiting for action)
func renderPane(pane *Pane, width, height int, selectedIndex int, blockingIndex *int) string {
	var content strings.Builder

	// Render title
	title := titleStyle.Render(pane.Title)
	content.WriteString(title)
	content.WriteString("\n")
	content.WriteString(strings.Repeat("─", width-2))
	content.WriteString("\n\n")

	// Render events
	if len(pane.Events) == 0 {
		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("243")).
			Render("(no events yet)"))
	} else {
		// Calculate how many events we can show
		maxEvents := height - 3 // Account for title and separators

		// Show most recent events
		startIdx := 0
		if len(pane.Events) > maxEvents {
			startIdx = len(pane.Events) - maxEvents
		}

		// Style for selected event
		selectedStyle := lipgloss.NewStyle().
			Background(lipgloss.Color("240")).
			Foreground(lipgloss.Color("255"))

		// Style for blocking event (waiting for action)
		blockingStyle := lipgloss.NewStyle().
			Background(lipgloss.Color("214")). // Orange background
			Foreground(lipgloss.Color("0")).   // Black text
			Bold(true)

		for i := startIdx; i < len(pane.Events); i++ {
			event := pane.Events[i]

			// Format timestamp
			timestamp := timestampStyle.Render(
				fmt.Sprintf("[%s]", event.Timestamp.Format("15:04:05")),
			)

			// Format event type and message
			eventText := eventStyle.Render(
				fmt.Sprintf("%s: %s", event.Type, event.Message),
			)

			// Combine and truncate if needed
			line := fmt.Sprintf("%s %s", timestamp, eventText)

			// Determine cursor and styling
			var cursor string
			isBlocking := blockingIndex != nil && i == *blockingIndex

			if isBlocking {
				// Blocking event (waiting for action)
				cursor = "⚠ "
				if len(line) > width-6 {
					line = line[:width-9] + "..."
				}
				line = blockingStyle.Render(cursor + line)
			} else if i == selectedIndex {
				// Selected event (navigation cursor)
				cursor = "> "
				if len(line) > width-6 {
					line = line[:width-9] + "..."
				}
				line = selectedStyle.Render(cursor + line)
			} else {
				// Normal event
				cursor = "  "
				if len(line) > width-6 {
					line = line[:width-9] + "..."
				}
				line = cursor + line
			}

			content.WriteString(line)
			content.WriteString("\n")
		}
	}

	// Apply pane style (border and padding)
	return paneStyle.
		Width(width).
		Height(height).
		Render(content.String())
}

// renderPayloadPane renders a pane showing the detailed payload of a selected event or textarea for input
func renderPayloadPane(selectedEvent *events.Event, width, height int, inputMode bool, textareaModel textarea.Model) string {
	var content strings.Builder

	// Render title
	title := titleStyle.Render("Event Payload")
	content.WriteString(title)
	content.WriteString("\n")
	content.WriteString(strings.Repeat("─", width-2))
	content.WriteString("\n\n")

	// AIDEV-NOTE: Clear-on-render - this function is called fresh each time,
	// so old payload is automatically cleared before rendering new one

	// INPUT MODE: Render textarea for user input
	if inputMode {
		// Use event's Content or Message as the prompt text
		promptText := "Enter your response below:"
		if selectedEvent != nil {
			if selectedEvent.Content != "" {
				promptText = selectedEvent.Content
			} else if selectedEvent.Message != "" {
				promptText = selectedEvent.Message
			}
		}

		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("62")).
			Bold(true).
			Render(fmt.Sprintf("✍️  %s\n\n", promptText)))

		// Render the textarea
		content.WriteString(textareaModel.View())

		// Apply pane style (border and padding)
		return paneStyle.
			Width(width).
			Height(height).
			Render(content.String())
	}

	// NORMAL MODE: Render event payload
	if selectedEvent == nil {
		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("243")).
			Render("(no event selected)"))
	} else if selectedEvent.Content != "" {
		// Display raw text/markdown content (no preprocessing)
		// Display event metadata header
		header := fmt.Sprintf("Type: %s | Time: %s\n\n",
			selectedEvent.Type,
			selectedEvent.Timestamp.Format("15:04:05"))
		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("99")).
			Render(header))

		// Display raw content as-is (text or markdown)
		content.WriteString(eventStyle.Render(selectedEvent.Content))
	} else if selectedEvent.Data == nil || len(selectedEvent.Data) == 0 {
		// Show event metadata when there's no payload
		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("243")).
			Render("(no payload data)\n\n"))

		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("252")).
			Render(fmt.Sprintf("Type: %s\n", selectedEvent.Type)))
		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("252")).
			Render(fmt.Sprintf("Message: %s\n", selectedEvent.Message)))
		content.WriteString(lipgloss.NewStyle().
			Foreground(lipgloss.Color("252")).
			Render(fmt.Sprintf("Time: %s\n", selectedEvent.Timestamp.Format("15:04:05"))))
	} else {
		// Fallback: Show formatted JSON payload (backward compatible)
		jsonBytes, err := json.MarshalIndent(selectedEvent.Data, "", "  ")
		if err != nil {
			content.WriteString(lipgloss.NewStyle().
				Foreground(lipgloss.Color("196")).
				Render(fmt.Sprintf("Error formatting payload: %v", err)))
		} else {
			// Display event metadata header
			header := fmt.Sprintf("Type: %s | Time: %s\n\n",
				selectedEvent.Type,
				selectedEvent.Timestamp.Format("15:04:05"))
			content.WriteString(lipgloss.NewStyle().
				Foreground(lipgloss.Color("99")).
				Render(header))

			// Display formatted JSON payload
			payloadStr := string(jsonBytes)

			// Word wrap for long lines
			lines := strings.Split(payloadStr, "\n")
			for _, line := range lines {
				if len(line) > width-6 {
					// Wrap long lines
					for i := 0; i < len(line); i += width - 6 {
						end := i + width - 6
						if end > len(line) {
							end = len(line)
						}
						content.WriteString(eventStyle.Render(line[i:end]))
						content.WriteString("\n")
					}
				} else {
					content.WriteString(eventStyle.Render(line))
					content.WriteString("\n")
				}
			}
		}
	}

	// Apply pane style (border and padding)
	return paneStyle.
		Width(width).
		Height(height).
		Render(content.String())
}

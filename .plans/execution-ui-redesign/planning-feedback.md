# Planning Feedback History

Curmudgeon simplification request: # Curmudgeon Review: Execution UI Redesign Plan

This plan is **appropriately scoped and reasonably simple** for the requirements. You're making focused changes to a single file, using existing React patterns, and leveraging infrastructure that's already there (TaskStateMachine API, FullscreenModal). Good discipline.

However, I have **two specific concerns** about unnecessary complexity:

## 1. Blinking Indicator Complexity

You're adding a `useEffect` with a 750ms interval timer and cleanup logic just to toggle opacity/color on status indicators. This adds:
- State management (`isBlinking` boolean)
- Interval lifecycle handling
- Cleanup coordination
- Potential memory leak surface area

**Simpler alternative**: Use a CSS animation or Ink's built-in spinner/loading indicators. Most terminal UIs use static colored indicators (●/○) or simple spinners rather than custom blink logic. The color alone (green vs gray) already conveys active/inactive state clearly.

**If you must keep blinking**: At minimum, question whether you need it at all. Static colored indicators are standard and clearer.

## 2. Verbose Status Text Switch

You're mapping execution states to contextual strings inline:
```
PLANNING → "Proposing implementation..."
IMPLEMENTING → "Writing code..."
etc.
```

This is fine, but it's spread across the component render logic. If this mapping grows or changes frequently, it becomes scattered. Consider extracting a tiny helper function:

```typescript
const getStatusText = (state: ExecutionState): string => {
  switch(state) {
    case PLANNING: return "Proposing implementation...";
    case IMPLEMENTING: return "Writing code...";
    // ...
  }
}
```

Not strictly necessary now, but keeps render logic focused on layout rather than text selection.

## What I Like

- **Single file changes**: No new components, no new utilities
- **Existing patterns**: Using FullscreenModal, TaskStateMachine APIs, standard React hooks
- **Focused scope**: Only modifying right pane behavior, left pane untouched
- **Clear verification steps**: Each step has concrete success criteria
- **Proper conditional rendering**: Only showing execution UI during EXECUTING state

## Verdict

**Simplify** - but only slightly. Remove the blinking indicator logic entirely (use static colors or Ink spinners), and consider extracting the status text mapping to a helper function. Everything else is proportional to the problem.

The core approach is solid: vertical split in right pane, keyboard shortcuts, fullscreen modals. Don't overthink it further - just drop the blink timer and you're good.

**Specific recommendation for next iteration**:
- Replace blinking logic with static colored circles or `<Spinner />` component from Ink
- Optional: Extract status text mapping to `getAgentStatusText(state)` helper
- Proceed with everything else as planned

This is a straightforward UI enhancement that doesn't introduce architectural complexity. Just trim the blink timer and ship it.
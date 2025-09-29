# Planning Feedback History

Curmudgeon simplification request: Looking at this plan, I see a classic case of over-engineering for what should be a straightforward integration task. You're creating multiple new abstraction layers and services when the problem is simply that the UI component isn't calling the existing feedback function.

The core issue is dead simple: PlanningLayout captures user actions but doesn't tell the orchestrator about them. The solution? Just call the existing `getPlanFeedback()` function or emit an event when the user clicks approve/reject. That's it.

But instead, this plan proposes:
- A new "feedback bridge service" (Step 1)
- A new "UI mode detection mechanism" (Step 6) 
- A new "ui-context.ts" file for detecting UI vs CLI mode
- Multiple layers of routing and delegation

This is architectural astronautics. You're building a space station when you need a doorbell.

Here's what actually needs to happen:
1. Remove the truncation in PlanningLayout (one line change)
2. Make the approve/reject handlers emit events or call a callback that the orchestrator can listen to
3. Wire up PlanningLayout in App.tsx during planning states
4. Done.

The existing `getPlanFeedback()` function already handles the orchestrator communication. The Ink components already have event handling. You don't need a "bridge service" - you need to connect two existing pieces with a simple callback or event emitter.

The "UI mode detection" is particularly egregious - if the Ink UI is running, it's running. If it's not, use CLI. This doesn't need a detection mechanism or context system.

This plan takes a 20-line fix and turns it into a 200-line architecture exercise with multiple new files and abstractions that will need to be maintained forever.

**Verdict: simplify**

The plan needs to focus on the minimal connection required: making the UI buttons actually trigger the orchestrator workflow. Skip the bridge service, skip the detection mechanism, skip the context system. Just wire up the existing pieces.
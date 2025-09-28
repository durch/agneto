# Phase Transition Event Instrumentation Implementation Plan

## Context
The Agneto system uses two state machines for task lifecycle management. The TaskStateMachine handles overall task flow (TASK_INIT → TASK_REFINING → TASK_PLANNING → etc.) while the CoderReviewerStateMachine manages execution cycles (BEAN_COUNTING → PLANNING → IMPLEMENTING → CODE_REVIEW). Both machines log state transitions but don't emit audit events. The audit system already supports 'phase_transition' events and the dashboard has phase progress visualization that can handle these events.

## Acceptance Criteria
- TaskStateMachine transitions emit 'phase_transition' audit events with old/new state metadata
- CoderReviewerStateMachine transitions emit similar audit events  
- Dashboard receives and highlights phase transition events in the phase progress UI
- Events include sufficient metadata to track state progression
- No disruption to existing state machine behavior or audit system functionality
- Dashboard visually distinguishes phase transition events from other event types

## Steps

### 1. Add AuditLogger support to TaskStateMachine
**Intent:** Enable TaskStateMachine to emit phase_transition audit events
**Files:** `src/task-state-machine.ts`
**Verification:** AuditLogger property added, constructor accepts optional auditLogger parameter

### 2. Instrument TaskStateMachine transition method
**Intent:** Capture phase transitions as audit events after successful state changes
**Files:** `src/task-state-machine.ts` (lines 259-263)
**Verification:** Successful state transitions emit 'phase_transition' events with oldState/newState metadata

### 3. Add AuditLogger support to CoderReviewerStateMachine  
**Intent:** Enable execution state machine to emit phase_transition audit events
**Files:** `src/state-machine.ts`
**Verification:** AuditLogger property and constructor parameter added, similar to TaskStateMachine

### 4. Instrument CoderReviewerStateMachine transition method
**Intent:** Capture execution phase transitions as audit events
**Files:** `src/state-machine.ts` (around lines 195-197)
**Verification:** Successful state transitions emit 'phase_transition' events with execution state metadata

### 5. Update orchestrator to inject AuditLogger instances
**Intent:** Provide AuditLogger reference to both state machines during initialization
**Files:** `src/orchestrator.ts` (lines 192 and 78)
**Verification:** Both TaskStateMachine and CoderReviewerStateMachine receive auditLogger parameter

### 6. Enhance dashboard phase transition highlighting
**Intent:** Visually distinguish phase_transition events and improve phase progress updates
**Files:** `dashboard/public/index.html` (handleNewEvent method around line 754)
**Verification:** Phase transition events trigger visual highlighting and phase progress updates

## Risks & Rollbacks
- **Risk:** Adding AuditLogger dependency could break existing state machine instantiation
  **Mitigation:** Make auditLogger parameter optional in constructors
- **Risk:** Performance impact from additional audit event generation
  **Mitigation:** Audit events only generated on actual state changes (existing condition)
- **Rollback:** Remove auditLogger parameters and instrumentation calls, revert to original logging-only behavior

## Confidence Level
I'm confident this approach will work. The audit system already supports phase_transition events, the dashboard has phase progress components, and the instrumentation points are clearly identified. The changes are additive and maintain backward compatibility through optional parameters.

---
_Plan created after 1 iteration(s) with human feedback_

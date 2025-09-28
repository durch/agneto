# Dashboard Event Emitter Integration Plan

## Context

Integrate a lightweight HTTP event forwarding system with Agneto's existing AuditLogger to send events to an external dashboard service. The system will hook into the established `captureEvent()` method without modifying its interface, using environment variable activation and fire-and-forget error handling.

## Acceptance Criteria

- Create `DashboardEventEmitter` class in new `src/dashboard/event-emitter.ts` file
- Environment variable `DASHBOARD_ENDPOINT` controls activation (no-op when unset)
- Each `AuditEvent` forwarded via HTTP POST with `taskId` added to payload
- Integration hooks into `AuditLogger.captureEvent()` without changing method signature
- All HTTP errors caught and silently ignored (fire-and-forget pattern)
- Existing audit functionality remains unchanged and unaffected
- TypeScript compilation passes without errors

## Steps

1. **Research existing audit system structure**
   - Intent: Understand current AuditLogger implementation and AuditEvent interface
   - Files: `src/audit/audit-logger.ts`, related audit type definitions
   - Verify: Can describe existing captureEvent method signature and AuditEvent structure

2. **Create dashboard directory and event emitter class**
   - Intent: Establish new module with core HTTP forwarding functionality
   - Files: Create `src/dashboard/event-emitter.ts`
   - Verify: File exists with DashboardEventEmitter class that accepts endpoint URL in constructor

3. **Implement HTTP POST forwarding with error handling**
   - Intent: Add method to send events to dashboard endpoint with fire-and-forget pattern
   - Files: `src/dashboard/event-emitter.ts`
   - Verify: Method accepts AuditEvent, adds taskId, sends HTTP POST, catches all errors silently

4. **Add environment variable detection and activation logic**
   - Intent: Enable conditional activation based on DASHBOARD_ENDPOINT environment variable
   - Files: `src/dashboard/event-emitter.ts`
   - Verify: Class only performs HTTP requests when endpoint is configured, no-op otherwise

5. **Integrate emitter with AuditLogger.captureEvent()**
   - Intent: Hook dashboard forwarding into existing audit capture without changing interface
   - Files: `src/audit/audit-logger.ts`
   - Verify: captureEvent method calls dashboard emitter when configured, maintains original behavior

6. **Add taskId to forwarded events**
   - Intent: Enhance event payload with task correlation identifier for dashboard
   - Files: `src/dashboard/event-emitter.ts` or integration point
   - Verify: HTTP POST payload includes taskId field alongside original AuditEvent data

7. **Test TypeScript compilation and basic functionality**
   - Intent: Ensure changes compile cleanly and don't break existing functionality
   - Files: Run `npm run build`
   - Verify: No compilation errors, existing audit tests still pass if available

## Risks & Rollbacks

**Risks:**
- HTTP requests could introduce latency if not properly fire-and-forget
- Integration point might affect audit performance
- Environment variable parsing could fail silently

**Rollback Strategy:**
- Remove dashboard emitter calls from AuditLogger.captureEvent()
- Delete `src/dashboard/` directory
- Changes are additive and easily reversible

**Confidence Level:** High confidence in approach - leveraging established patterns and maintaining strict separation of concerns.

---
_Plan created after 1 iteration(s) with human feedback_

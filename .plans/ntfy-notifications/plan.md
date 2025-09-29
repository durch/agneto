# Add ntfy.sh Push Notification Integration

## Context
Agneto currently alerts users with terminal bells when human intervention is required. Adding push notifications via ntfy.sh will provide an additional notification layer for remote or distracted users. The integration follows existing patterns from the dashboard event emitter for HTTP requests and silent failure handling.

## Acceptance Criteria
- Push notifications sent before terminal bell for human review prompts
- Support for custom ntfy server via environment variables
- Silent failure when ntfy service unavailable - never breaks application flow
- Contextual notifications include step description and reviewer feedback
- Environment variables documented in CLAUDE.md
- No functional changes to existing behavior

## Steps

1. **Create ntfy notification service**
   - Intent: Implement HTTP notification service following existing dashboard event emitter patterns
   - File: `src/utils/ntfy-notifier.ts`
   - Verify: Service exports `sendNotification()` function and handles environment variables correctly

2. **Integrate notifications into human review function**
   - Intent: Add push notification before terminal bell in first human review function
   - File: `src/ui/human-review.ts:30`
   - Verify: Notification sent before `bell()` call with step description and reviewer feedback context

3. **Integrate notifications into super reviewer function**
   - Intent: Add push notification before terminal bell in final quality gate function
   - File: `src/ui/human-review.ts:88`
   - Verify: Notification sent before `bell()` call with summary and issues context

4. **Update environment variables documentation**
   - Intent: Document new NTFY_TOPIC and NTFY_SERVER variables in existing reference section
   - File: `CLAUDE.md:377-404`
   - Verify: New "Push Notification Variables" subsection added with proper table format

## Risks & Rollbacks

**Risks:**
- Network timeouts could delay human prompts slightly
- Invalid ntfy configuration might cause silent failures

**Rollbacks:**
- Remove notifier import and function calls from human-review.ts
- Delete ntfy-notifier.ts file
- Revert CLAUDE.md documentation changes

**Confidence:** I'm confident this approach will work - it follows established patterns from the dashboard event emitter for HTTP requests, environment variable handling, and silent failure modes. The integration points are clearly identified and the changes are minimal and isolated.

---
_Plan created after 1 iteration(s) with human feedback_

Perfect! Now I have a comprehensive understanding of the codebase. Let me create the plan based on my research findings.

# Terminal Bell Notifications for User Interaction Points

## Context

The Agneto system currently has three key user interaction points where the system waits for human input but provides no audible notification. Adding terminal bell notifications at these points will help users notice when their attention is required, especially when working in background terminals or during longer execution cycles.

## Acceptance Criteria

- ✅ Create a simple, reusable terminal bell utility in `src/utils/terminal-bell.ts`
- ✅ Add bell notifications before user prompts in planning interface (lines 52, 65, 81)
- ✅ Add bell notifications before user prompts in human review interface (lines 29, 86)  
- ✅ Add bell notifications at task completion points in orchestrator (lines 332, 357)
- ✅ Bell function uses ASCII `\x07` character for maximum terminal compatibility
- ✅ System continues to function normally if terminal doesn't support bells
- ✅ No interference with existing logging or UI systems

## Steps

1. **Create terminal bell utility**
   - **Intent**: Implement a simple, cross-platform terminal bell function
   - **File**: `src/utils/terminal-bell.ts`
   - **Verify**: Function exports correctly and uses `\x07` character
   - **Details**: Export a `bell()` function that writes `\x07` to process.stdout, handling any errors silently

2. **Add bell to planning interface select prompt**
   - **Intent**: Notify user when plan feedback is requested  
   - **File**: `src/ui/planning-interface.ts:52`
   - **Verify**: Bell sounds before the select prompt appears
   - **Details**: Import bell function and call it just before the `select()` call in `getPlanFeedback()`

3. **Add bell to planning interface input prompt**
   - **Intent**: Notify user when feedback details are requested
   - **File**: `src/ui/planning-interface.ts:65` 
   - **Verify**: Bell sounds before the input prompt appears
   - **Details**: Call bell function just before the `input()` call for rejection details

4. **Add bell to planning interface confirm prompt**
   - **Intent**: Notify user when plan approval confirmation is needed
   - **File**: `src/ui/planning-interface.ts:81`
   - **Verify**: Bell sounds before the confirm prompt appears  
   - **Details**: Call bell function just before the `confirm()` call in `confirmPlanApproval()`

5. **Add bell to human review select prompt**
   - **Intent**: Notify user when code review decision is needed
   - **File**: `src/ui/human-review.ts:29`
   - **Verify**: Bell sounds before the review decision prompt appears
   - **Details**: Call bell function just before the `select()` call in `promptHumanReview()`

6. **Add bell to super reviewer select prompt**
   - **Intent**: Notify user when final quality gate decision is needed
   - **File**: `src/ui/human-review.ts:86`
   - **Verify**: Bell sounds before the super reviewer decision prompt appears
   - **Details**: Call bell function just before the `select()` call in `promptForSuperReviewerDecision()`

7. **Add bell to task completion success**
   - **Intent**: Notify user when task has completed successfully
   - **File**: `src/orchestrator.ts:332`
   - **Verify**: Bell sounds when task completion message is logged
   - **Details**: Import bell function and call it just before the success log message

8. **Add bell to audit completion**
   - **Intent**: Notify user when audit task completion occurs
   - **File**: `src/orchestrator.ts:357`
   - **Verify**: Bell sounds when audit completion happens
   - **Details**: Call bell function just before the `auditLogger.completeTask()` call

9. **Verify TypeScript compilation**
   - **Intent**: Ensure all changes compile without errors
   - **Command**: `npm run build`
   - **Verify**: Build succeeds with no TypeScript errors
   - **Details**: Run the build script to verify the new import statements and function calls are valid

## Risks & Rollbacks

**Risks:**
- Terminal bell might be annoying in some environments
- Some terminals might not support bell character
- Could interfere with CI/automated environments

**Rollbacks:**
- Bell function is isolated in utils - easy to modify or disable
- All bell calls are simple function calls that can be easily removed
- No changes to core logic or data flow

**Confidence Level:** I'm confident this approach will work well. The implementation is simple, follows existing patterns in the codebase, and the bell utility can be easily modified if needed. The placement of bell calls at user interaction points is straightforward and non-invasive.

---
_Plan created after 1 iteration(s) with human feedback_

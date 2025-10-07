# Remove Unused Filtering Logic in PlanningLayout Live Activity Display

## Context
The PlanningLayout component contains unused filtering logic (lines 629-644) that checks for multiline content and length (`isLongContent`) before displaying live activity messages. This filter serves no functional purpose since the filtered result is rendered with the same conditional logic that determines whether to filter. The simplification will display messages directly while preserving the existing `liveActivity` variable and its integration points.

## Acceptance Criteria
- Lines 629-644 simplified to display `liveActivity.message` directly without `isLongContent` check
- Live activity message format preserved: `{agent}: {message}`
- Variable `liveActivity` (line 103) and its usage in `isQueryInProgress` (line 344) remain unchanged
- TypeScript compilation succeeds (`npm run build`)
- Visual output behavior unchanged (message displays when `liveActivity` exists)

## Steps

1. **Read target file to verify current structure**
   - **Intent**: Confirm exact lines, variable names, and surrounding context
   - **File**: `src/ui/ink/components/PlanningLayout.tsx`
   - **Verify**: Lines 629-644 contain `isLongContent` logic; line 103 has `getLiveActivityMessage()`; line 344 uses `liveActivity` in `isQueryInProgress`

2. **Simplify lines 629-644 to remove filtering**
   - **Intent**: Replace conditional filtering logic with direct message display
   - **File**: `src/ui/ink/components/PlanningLayout.tsx`
   - **Change**: Replace lines 629-644 with simple conditional rendering:
     ```tsx
     {liveActivity && (
       <Text>
         {liveActivity.agent}: {liveActivity.message}
       </Text>
     )}
     ```
   - **Verify**: Code reads naturally; no TypeScript errors in editor

3. **Run TypeScript build**
   - **Intent**: Ensure no compilation errors introduced
   - **Command**: `npm run build`
   - **Verify**: Exit code 0; no TypeScript errors; build artifacts generated

4. **Verify integration points unchanged**
   - **Intent**: Confirm no unintended side effects on other usages
   - **File**: `src/ui/ink/components/PlanningLayout.tsx`
   - **Verify**: Line 103 still calls `getLiveActivityMessage()`; line 344 still references `liveActivity` in boolean expression

## Risks & Rollbacks

**Risks**:
- Potential whitespace/formatting differences if lines 629-644 are nested differently than expected
- TypeScript strict null checks might flag `liveActivity.agent` or `liveActivity.message` access

**Rollbacks**:
- Revert `src/ui/ink/components/PlanningLayout.tsx` to HEAD if build fails
- Git diff can show exact changes for surgical rollback

**Confidence**: High. This is a straightforward deletion of unused conditional logic with direct message display replacement. The integration points are read-only references that won't be affected.

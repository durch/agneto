# Gardener Agent: Simple Refactor Plan

## Context
Rename Reflector → Gardener and add pruning logic to keep CLAUDE.md under 40k characters. Current reflector works fine, we're just adding maintenance capabilities.

## Acceptance Criteria
- All "reflector" references changed to "gardener" (code, prompts, logs)
- CLAUDE.md size checked before writing
- Old "Recently Completed" entries pruned when file exceeds 35k chars
- Existing functionality preserved (still adds task summaries)
- Build succeeds, no broken imports

## Steps

### 1. Find and rename all references
**Intent:** Change reflector → gardener everywhere  
**Files:** 
- `src/agents/reflector.ts` → `src/agents/gardener.ts`
- `src/prompts/reflector.md` → `src/prompts/gardener.md`
- `src/orchestrator.ts` (import and function calls)
- Any other files found via grep

**Actions:**
```bash
# Find all references
grep -r "reflector" src/
grep -r "Reflector" src/

# Rename agent file
mv src/agents/reflector.ts src/agents/gardener.ts

# Rename prompt file
mv src/prompts/reflector.md src/prompts/gardener.md

# Update all code references (imports, function calls, log messages)
# Replace "reflector" → "gardener"
# Replace "Reflector" → "Gardener"
# Update emoji from whatever it is → 🌱
```

**Verify:** `npm run build` succeeds, `grep -r reflector src/` returns zero results

**Confidence:** High - straightforward find/replace operation

---

### 2. Add size monitoring before writing
**Intent:** Check CLAUDE.md size and trigger pruning if needed  
**Files:** `src/agents/gardener.ts`

**Actions:**
- Read CLAUDE.md file size with `fs.statSync()` before writing
- If size > 35,000 chars, call pruning function (step 3)
- Then proceed with normal append logic

**Verify:** 
- Read gardener.ts code, confirm size check exists
- Test with artificially large CLAUDE.md (manual test)
- Log message shows size check happening

**Confidence:** High - simple conditional check

---

### 3. Implement pruning logic
**Intent:** Remove old "Recently Completed" entries to reduce file size  
**Files:** `src/agents/gardener.ts`

**Actions:**
- Read CLAUDE.md content as string
- Find "## 🗺️ Roadmap" section
- Find "### ✅ Completed (Recently!)" subsection
- Parse list items (lines starting with `- **`)
- Keep only last 5 entries, remove older ones
- Write pruned content back to CLAUDE.md

**Example logic:**
```typescript
function pruneRecentlyCompleted(content: string): string {
  const lines = content.split('\n');
  // Find section boundaries
  // Keep last 5 completed items
  // Reconstruct content
  return prunedContent;
}
```

**Verify:**
- Create CLAUDE.md with 10 completed items
- Run agent, confirm only 5 remain
- Verify file size reduced
- Essential sections (golden rules, quick start, etc.) untouched

**Confidence:** Medium - String manipulation needs careful testing, but logic is straightforward

---

### 4. Update logging and comments
**Intent:** Reflect new gardening theme in all messages  
**Files:** `src/agents/gardener.ts`, `src/orchestrator.ts`

**Actions:**
- Change log messages: "Reflecting on task" → "Tending to documentation garden"
- Update comments: "reflector agent" → "gardener agent"
- Use 🌱 emoji consistently in logs
- Keep messages concise and gardening-themed

**Verify:** 
- Run a test task, check terminal output for gardening terminology
- Grep for old reflector language in logs

**Confidence:** High - cosmetic changes

---

### 5. Test full flow
**Intent:** Verify everything works end-to-end  
**Files:** None (testing step)

**Actions:**
- Run `npm run build` - must succeed
- Run a test task that calls gardener
- Verify CLAUDE.md updated with new content
- Artificially inflate CLAUDE.md to 36k chars
- Run task again, verify pruning happened
- Check git diff shows expected changes

**Verify:** 
- Build succeeds
- Task completes successfully
- CLAUDE.md shows new entry
- Large CLAUDE.md gets pruned automatically
- No runtime errors in logs

**Confidence:** High - straightforward integration test

---

## Risks & Rollbacks

**Risk:** Pruning logic removes too much or wrong content  
**Mitigation:** Only touch "Recently Completed" subsection, never main documentation  
**Rollback:** Git revert, restore CLAUDE.md from backup

**Risk:** Size check threshold too aggressive  
**Mitigation:** 35k threshold leaves 5k buffer before 40k limit  
**Rollback:** Adjust threshold constant if needed

**Risk:** Broken references after rename  
**Mitigation:** TypeScript compiler catches import errors  
**Rollback:** Git revert rename commits

---

## Implementation Notes

- Total estimated time: ~1 hour
- No new dependencies needed (use built-in `fs` module)
- Pruning only targets "Recently Completed" section for safety
- Threshold of 35k chars triggers maintenance (5k buffer)
- Existing gardener agent session/prompt handling unchanged
- All existing orchestrator integration preserved

---
_Plan created after 1 iteration(s) with human feedback_

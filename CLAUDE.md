# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with Agneto - an agentic development system.

## ⚠️ GOLDEN RULES - READ FIRST
1. **ALWAYS run `npm run build` before making any changes** - TypeScript must compile
2. **NEVER modify files directly** - Use Agneto to make changes to itself
3. **DEBUG=true is your friend** - Use it whenever something seems wrong
4. **Interactive mode is DEFAULT** - The system will ask for your input on plans
5. **Worktrees are isolated** - Changes happen in `.worktrees/<task-id>`, not main branch

## 🚀 Quick Start

### CRITICAL: Before Any Changes
```bash
npm run build  # ALWAYS verify TypeScript compiles first
```

### If you're here to...

**Fix a bug in Agneto:**
```bash
# STEP 1: Verify the build
npm run build

# STEP 2: Test with debug output
DEBUG=true npm start -- test-1 "describe the fix" --non-interactive

# STEP 3: If empty responses, check provider
DEBUG=true npx tsx test-provider.ts
```

**Add a new feature to Agneto:**
```bash
# STEP 1: Start interactive planning (this is default)
npm start -- feat-1 "Add feature X"

# STEP 2: Refine plan when prompted (use 'simplify' if too complex)
# STEP 3: System executes all steps automatically
# STEP 4: Review in worktree before merging
cd .worktrees/feat-1 && git diff master
```

**Debug empty planner responses:**
```bash
# Test in this exact order:
echo "Say OK" | claude -p --permission-mode plan  # Test CLI directly
DEBUG=true npx tsx test-provider.ts               # Test provider wrapper
DEBUG=true npm start -- debug-1 "simple task" --non-interactive  # Test full flow
```

**Work on an existing task:**
```bash
# IMPORTANT: Check what's been done first
cd .worktrees/<task-id>
git log --oneline -5
git status
git diff master

# Then continue
npm start -- <task-id> "continue work"
```

## 🎯 How Agneto Works (Essential Understanding)

Agneto is a **human-in-the-loop AI development system** with three personas:

1. **Planner** → Creates structured plans from your task description
2. **Coder** → Reads the repo and proposes changes (one file at a time)
3. **Reviewer** → Validates proposals against the plan

**Key Concept:** Everything happens in isolated git worktrees (`.worktrees/<task-id>`), so the main branch is never at risk.

### The Flow
```
You describe task → Interactive planning → Plan approved →
For each step: Coder proposes → Reviewer checks → Apply if approved →
All done → Review in worktree → Merge manually (or --auto-merge)
```

### Default Behavior (Important!)
- ✅ **Interactive planning ON** - You refine the plan before execution
- ✅ **Runs ALL steps** - No need to continue manually
- ✅ **Manual merge** - You review before merging to master
- ✅ **Conservative** - Reviewer often asks for human input

## 🔧 Common Tasks

### Running a Task (Most Common)
```bash
# Standard usage - interactive planning, full execution
npm start -- task-1 "implement user authentication"

# For CI/automation - skip interactive planning
npm start -- task-1 "fix typo in README" --non-interactive

# Auto-merge when complete (use with caution)
npm start -- task-1 "update dependencies" --auto-merge
```

### Understanding the Output
```
📝 Planner: Planning "your task"...        # Creating the plan
🤖 Coder: Proposing change for step 1/3... # Reading code, making proposal
👀 Reviewer: ✅ approve - correct implementation  # Reviewing proposal
🙋 Human: Applying approved proposal...    # System applying changes
```

### Working with Plans

**Plan gets generated empty?**
- The system prompt might be too complex
- Try simpler task descriptions
- Use DEBUG=true to see what's being sent

**Want to change the plan?**
Interactive mode offers these options:
- **Simplify** - Reduce complexity
- **Add Detail** - Be more specific
- **Wrong Approach** - Suggest alternative
- **Edit Steps** - Modify specific parts
- **Add Constraints** - "Must not break X"
- **Start Over** - New description

### Managing Worktrees
```bash
# See all worktrees
git worktree list

# Clean up a completed task
npm run cleanup-task task-1

# Manually check a worktree
cd .worktrees/task-1
git status
git diff master
```

## 🚨 Troubleshooting

### Empty Planner Output
**Symptom:** Plan comes back empty or just a title

**Root Causes & Solutions (in order of likelihood):**

1. **Claude CLI not responding properly**
   ```bash
   # Test CLI directly first
   echo "Say OK" | claude -p --permission-mode plan
   # Should return "OK" - if not, Claude CLI is the issue
   ```

2. **Provider message formatting issue**
   ```bash
   # Test provider wrapper
   DEBUG=true npx tsx test-provider.ts
   # Look for "Result 3" - should show a plan
   ```

3. **Task description too complex**
   - Simplify to basic terms
   - Avoid special characters
   - Keep under 100 words

4. **Check actual file content**
   ```bash
   cat .worktrees/<task-id>/.plans/<task-id>/plan.md
   # Sometimes plan exists but display is broken
   ```

### Coder Can't Find Files
**Symptom:** Coder proposes creating files that already exist

**Solution:** Coder only has ReadFile, ListDir, Grep tools. It's working from the worktree directory. Check:
```bash
ls .worktrees/<task-id>/src/  # Is the structure there?
```

### Reviewer Always Rejects
**Symptom:** Reviewer keeps saying "revise" or "needs-human"

**Solutions:**
- Check the plan is specific enough
- Reviewer is conservative by design - this is normal
- After 3 attempts, it stops - review the feedback

### Git Worktree Issues
**Symptom:** "fatal: branch already exists" or worktree errors

**Solutions:**
```bash
git worktree prune           # Clean up stale worktrees
git branch -D sandbox/task-1  # Delete branch if needed
rm -rf .worktrees/task-1     # Remove directory
```

## 🏗️ Architecture Reference

### Key Files to Know

| File | Purpose | Modify when... |
|------|---------|----------------|
| `src/orchestrator.ts` | Main control flow | Changing the task flow |
| `src/agents/planner.ts` | Planning logic | Improving plan generation |
| `src/agents/coder.ts` | Code generation | Changing proposal format |
| `src/agents/reviewer.ts` | Review logic | Adjusting approval criteria |
| `src/providers/anthropic.ts` | Claude CLI integration | Fixing LLM communication |
| `src/ui/planning-interface.ts` | Interactive prompts | Changing feedback types |
| `src/prompts/*.md` | Agent instructions | Improving agent behavior |

### Data Formats

**Coder Proposal Format (MUST be exact):**
```
FILE: path/to/file.ts
---8<---
file contents here
---8<---
RATIONALE: One sentence explaining the change
```

**Reviewer Verdicts:**
- `✅ approve` - Apply the change
- `✏️ revise` - Try again with feedback
- `🟡 needs-human` - Human decision required
- `🔴 reject` - Stop execution

### Provider & Claude CLI

The system uses Claude CLI in headless mode:
- **plan mode**: Read-only for Planner/Reviewer
- **default mode**: With tools for Coder (ReadFile, ListDir, Grep)
- Prompts sent via stdin, not as arguments
- No JSON parsing - expects plain text responses

## 🛠️ Development Guide

### Adding a New Agent
1. Create `src/agents/newagent.ts`
2. Add prompt in `src/prompts/newagent.md`
3. Integrate in `src/orchestrator.ts`
4. Follow existing patterns from planner/coder/reviewer

### Modifying Agent Behavior
1. Edit the prompt in `src/prompts/<agent>.md`
2. Keep instructions clear and concise
3. Test with `DEBUG=true` to see actual prompts/responses

### Testing Changes
```bash
# Build first
npm run build

# Test with debug output
DEBUG=true npm start -- test-change "test description" --non-interactive

# Test provider directly
DEBUG=true npx tsx test-provider.ts
```

### Debug Mode
Set `DEBUG=true` to see:
- Exact prompts being sent
- Raw responses from Claude CLI
- Command construction
- Message formatting

## 💡 Design Philosophy

### Why These Choices?

**Git Worktrees Instead of Branches**
- Complete isolation from main codebase
- Can review entire change in separate directory
- No risk of polluting main branch
- Easy cleanup

**Interactive Planning by Default**
- Plans often need refinement
- Human expertise shapes approach
- Prevents wasted execution on bad plans
- Builds trust through transparency

**Conservative Reviewer**
- Better to ask than break things
- Human can always override
- Catches potential issues early
- Maintains code quality

**One File at a Time**
- Easier to review
- Simpler to revert
- Clear git history
- Reduces blast radius

## 📊 Current State

### What Works Well
- ✅ Interactive planning with feedback loop
- ✅ Safe sandbox execution
- ✅ Multi-step task completion
- ✅ Clear separation of concerns
- ✅ Good retry mechanism

### Known Limitations
- ⚠️ Coder only has read-only tools (no testing)
- ⚠️ Single file changes only
- ⚠️ No parallel task execution
- ⚠️ Limited to Claude CLI capabilities

### Common Gotchas
- Plans must have numbered steps (1., 2., etc.) for counting
- Coder can't see previous proposals (stateless)
- Reviewer doesn't see actual file contents, just the proposal
- Each retry starts fresh - no memory of previous attempts

## 🗺️ Roadmap

### Next: Phase 2 - Enhanced Safety
- Interactive approval for each code change
- Add RunTests tool for Coder
- Rollback capability during execution

### Future: Phase 3 - Curmudgeon
- Fourth persona to prevent over-engineering
- Reviews plans before execution
- Keeps solutions simple and pragmatic

### Long-term: TUI Interface
- Three-pane view of all agents
- Real-time execution monitoring
- Hotkey controls for approvals
- Better visibility into agent thinking

## 🎯 Pro Tips (From Experience)

1. **Start with "Add a hello world function"** - Simplest test that works
2. **When in doubt, simplify the plan** - Choose "simplify" in interactive mode
3. **Empty responses = check provider first** - `DEBUG=true npx tsx test-provider.ts`
4. **Coder proposals fail? Check the plan specificity** - Vague plans = bad proposals
5. **Always `git diff master` before merging** - See exactly what changed
6. **Break large tasks into multiple small ones** - Better success rate
7. **If reviewer keeps rejecting, the plan needs more detail** - Not a code problem

### What Actually Works Best
- Task descriptions under 50 words
- Plans with 3-5 concrete steps
- One file change per step
- Clear verification criteria in plans
- Using 'simplify' when plan is over 10 steps

## 🆘 Getting Help

### Quick Diagnosis Checklist
```bash
# Run these in order when something's wrong:
npm run build                     # 1. Does it compile?
echo "OK" | claude -p              # 2. Is Claude CLI working?
DEBUG=true npx tsx test-provider.ts  # 3. Is provider working?
git worktree list                 # 4. Any stuck worktrees?
```

### If All Else Fails
1. **Start fresh**: `rm -rf .worktrees/<task-id> && git branch -D sandbox/<task-id>`
2. **Use simplest possible task**: "Add a comment"
3. **Check the actual prompts**: `cat src/prompts/planner.md`
4. **Verify your changes compile**: `npm run build`

### Remember
- **Conservative is GOOD** - Prevents breaking changes
- **"needs-human" is NORMAL** - Not an error
- **Empty plans mean provider issues** - Not prompt issues
- **Retry mechanism exists** - 3 attempts is intentional
- **Worktrees protect you** - Main branch is always safe
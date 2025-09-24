# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with Agneto - an agentic development system.

## ⚠️ GOLDEN RULES - READ FIRST
1. **ALWAYS run `npm run build` before making any changes** - TypeScript must compile
2. **NEVER modify files directly** - Use Agneto to make changes to itself
3. **DEBUG=true is your friend** - Use it whenever something seems wrong
4. **Interactive mode is DEFAULT** - The system will ask for your input on plans
5. **Worktrees are isolated** - Changes happen in `.worktrees/<task-id>`, not main branch
6. **Check worktree state before continuing** - Old worktrees may be on outdated master
7. **Rebase worktrees when needed** - `git rebase master` to get latest fixes

## 🚀 Quick Start

### CRITICAL: Before Any Changes
```bash
npm run build  # ALWAYS verify TypeScript compiles first
```

### With the new Makefile (easier!)
```bash
make build     # Build TypeScript
make task ID=fix-1 DESC="fix the bug"  # Start a task
make merge ID=fix-1  # Auto-merge and cleanup (non-interactive!)
make list      # See all worktrees
```

### If you're here to...

**Fix a bug in Agneto:**
```bash
# STEP 1: Verify the build
npm run build

# STEP 2: Test with debug output (auto-generates task ID!)
DEBUG=true npm start -- "describe the fix" --non-interactive

# STEP 3: If empty responses, check provider
DEBUG=true npx tsx test-provider.ts
```

**Add a new feature to Agneto:**
```bash
# STEP 1: Start interactive planning (ID auto-generated!)
npm start -- "Add feature X"

# STEP 2: Refine task description if prompted (NEW: Task Refiner!)
# STEP 3: Refine plan when prompted (use 'simplify' if too complex)
# STEP 4: System executes all steps automatically
# STEP 5: SuperReviewer performs final quality check
# STEP 6: Review in worktree before merging
cd .worktrees/task-<generated-id> && git diff master
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

Agneto is a **human-in-the-loop AI development system** with five personas:

1. **Task Refiner** → Pre-processes vague task descriptions (interactive mode only)
2. **Planner** → Creates structured plans from your task description
3. **Coder** → Reads the repo and proposes changes (multi-file support via MultiEdit)
4. **Reviewer** → Validates proposals against the plan
5. **SuperReviewer** → Final quality gate checking acceptance criteria and tests

**Key Concept:** Everything happens in isolated git worktrees (`.worktrees/<task-id>`), so the main branch is never at risk.

### The Flow
```
You describe task → Task refinement (optional) → Interactive planning → Plan approved →
For each step: Coder proposes → Reviewer checks → Apply if approved →
All done → SuperReviewer final check → Review in worktree → Merge (auto or manual)
```

### Default Behavior (Important!)
- ✅ **Interactive planning ON** - You refine the plan before execution
- ✅ **Runs ALL steps** - No need to continue manually
- ✅ **Manual merge** - You review before merging to master
- ✅ **Conservative** - Reviewer often asks for human input

## 🔧 Common Tasks

### Running a Task (Most Common)
```bash
# NEW: No need to specify task ID - auto-generated!
npm start -- "implement user authentication"

# With custom ID (still supported)
npm start -- auth-1 "implement user authentication"

# For CI/automation - skip interactive planning
npm start -- "fix typo in README" --non-interactive

# Auto-merge when complete (use with caution)
npm start -- "update dependencies" --auto-merge
```

### Understanding the Output
```
📝 Planner: Planning "your task"...        # Creating the plan
🤖 Coder: Proposing change (attempt 1)...  # Reading code, making proposal
👀 Reviewer: ✅ approve - correct implementation  # Reviewing proposal
🙋 Orchestrator: ✅ Change applied successfully  # System applying changes
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

# Review a worktree before merging
cd .worktrees/<task-id>
git log --oneline -5       # Recent commits
git diff master --stat      # Files changed
npm run build              # Verify it compiles

# Merge and auto-cleanup (non-interactive!)
npm run merge-task <task-id>

# Manual cleanup if needed
npm run cleanup-task <task-id>
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

### Coder Completion Signals
**Coder signals completion via JSON:**

```json
{"action": "complete"}
```

**This triggers:**
- System recognizes all plan work is done
- Logs show clear completion status
- SuperReviewer runs final quality check

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
| `src/agents/coder.ts` | Code generation | Changing implementation logic |
| `src/agents/reviewer.ts` | Review logic | Adjusting approval criteria |
| `src/providers/anthropic.ts` | Claude CLI integration | Fixing LLM communication |
| `src/protocol/interpreter.ts` | Natural language interpreter | Changing response interpretation |
| `src/protocol/schemas.ts` | Legacy JSON schemas (deprecated) | Historical reference only |
| `src/protocol/validators.ts` | Legacy validation (deprecated) | Historical reference only |
| `src/protocol/prompt-template.ts` | Template rendering | Changing prompt injection |
| `src/prompts/interpreter-*.md` | Interpreter prompts | Improving response interpretation |
| `src/ui/planning-interface.ts` | Interactive prompts | Changing feedback types |
| `src/prompts/*.md` | Agent instructions | Improving agent behavior |

### Data Formats (Natural Language → Interpreter Protocol)

**Agent Communication Flow:**
```
Agent Response (Natural Language) → Interpreter (Stateless Sonnet) → Structured Decision (JSON)
```

**Coder Natural Language Examples:**
```
"I need to implement user authentication by adding middleware to src/auth.ts..."
"All the planned features have been implemented successfully."
"I've added the authentication middleware to src/middleware/auth.ts"
```

**Reviewer Natural Language Examples:**
```
"I approve this approach. The steps are logical and files make sense."
"Please add error handling for expired tokens in the validation logic."
"This requires human review because of security compliance concerns."
```

**Interpreter Output (Internal):**
- Coder: `{action: "continue|complete|implemented", description, steps, files}`
- Reviewer: `{verdict: "approve|revise|reject|needs_human", feedback, continueNext}`

**Key Features:**
- Natural language responses from agents (no JSON requirements)
- Stateless interpreter extracts decisions using fast Sonnet calls
- Robust handling of any response format or style
- Same structured data delivered to orchestrator
- Enhanced logging shows both raw responses and interpretations

### Provider & Claude CLI

The system uses Claude CLI in headless mode with natural language interpretation:
- **JSON output**: All calls use `--output-format json` for structured metadata
- **plan mode**: Read-only for Planner, Task Refiner, and Interpreter
- **default mode**: With tools for Coder, Reviewer, and SuperReviewer
  - Coder tools: ReadFile, ListDir, Grep, Bash, Write, Edit, MultiEdit
  - Reviewer tools: ReadFile, Grep, Bash (to verify file state)
  - SuperReviewer tools: ReadFile, Grep, Bash (for tests/build)
  - Interpreter: No tools needed (stateless interpretation)
- **Session separation**: Coder and Reviewer maintain independent sessions
- **Token efficiency**: System prompts sent only once per session via template injection
- **Natural interpretation**: Responses interpreted by stateless Sonnet calls
- **Metadata capture**: Automatic cost, duration, and session ID tracking
- Tools are Claude's built-in - no custom implementation needed

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

**Natural Language → Interpreter Protocol**
- Agents communicate naturally in readable language
- Stateless LLM interpreter extracts structured decisions
- No JSON parsing failures or schema validation errors
- Robust handling of any response format variations
- Better debugging through readable agent responses

**Focused Changes**
- Multi-file support available
- Easier to review when related
- Clear git history
- Reduces blast radius

## 📊 Current State

### What Works Well
- ✅ Interactive planning with feedback loop
- ✅ Safe sandbox execution
- ✅ Multi-step task completion
- ✅ Clear separation of concerns
- ✅ Good retry mechanism
- ✅ Human interaction for needs-human verdict
- ✅ Reject handling with enhanced feedback
- ✅ Bash tool for testing and verification
- ✅ Squash merge tooling for clean history

### Known Limitations
- ⚠️ No parallel task execution
- ⚠️ Limited to Claude CLI capabilities
- ⚠️ No built-in test suite yet

### Common Gotchas
- Coder works through plan naturally, no forced step ordering
- Coder and Reviewer maintain completely separate sessions (not shared)
- Agents communicate in natural language, interpreter extracts decisions
- System prompt sent only once per session, subsequent calls use conversation continuity
- Multi-file changes supported but best to keep changes focused
- Interpreter uses additional Sonnet calls (minimal cost) for decision extraction

## 🗺️ Roadmap

### ✅ Completed (Recently!)
- **Natural Language Protocol** - Agents respond naturally, interpreter extracts decisions
- **Stateless Interpreter** - Fast Sonnet calls convert language to structured data
- **No More JSON Failures** - Robust handling of any response format
- **Enhanced Logging** - Shows both raw responses and interpreted decisions
- **Multi-file Support** - Coder can modify multiple files via MultiEdit
- **Task Refiner** - Pre-processes vague task descriptions
- **SuperReviewer** - Final quality gate after all steps
- **Auto-generated IDs** - No friction, just provide description
- **No-op handling** - Gracefully handles "already implemented" cases
- **Non-interactive merge** - Automatic merge and cleanup
- **Semantic progress tracking** - No more confusing step numbers
- **Independent sessions** - Coder and Reviewer have separate sessions for clarity
- **Natural plan execution** - Coder works through plan organically
- Human interaction for needs-human verdict
- Reject handling with retry and enhanced feedback
- Bash tool for Coder (testing/verification)
- Squash merge tooling
- Makefile for easier operations
- AI playbook integration in prompts

### Next: Test Suite
- Add comprehensive test suite for Agneto itself
- Integration tests for the full flow
- Unit tests for individual agents

### Future: Phase 3 - Curmudgeon
- Fourth persona to prevent over-engineering
- Reviews plans before execution
- Keeps solutions simple and pragmatic

### Long-term: Enhanced UX
- TUI Interface with three-pane view
- Real-time execution monitoring
- Parallel task execution
- Memory between retries (context passing)

## 🎯 Pro Tips (From Experience)

1. **Just provide the description** - IDs are auto-generated now!
2. **Review worktrees before merging** - `cd .worktrees/<id> && git diff master --stat`
3. **Merge is now automatic** - `npm run merge-task <id>` does everything
4. **When in doubt, simplify the plan** - Choose "simplify" in interactive mode
5. **Empty responses = check provider first** - `DEBUG=true npx tsx test-provider.ts`
6. **Coder proposals fail? Check the plan specificity** - Vague plans = bad proposals
7. **Always `git diff master` before merging** - See exactly what changed
8. **Break large tasks into multiple small ones** - Better success rate
9. **If reviewer keeps rejecting, the plan needs more detail** - Not a code problem
10. **Rebase old worktrees before continuing** - They may lack critical fixes
11. **Use `make` commands** - Shorter and validated parameters
12. **Claude CLI tools are built-in** - Don't create custom tools, use Bash
13. **Completion signals work well** - Coder clearly states when task is finished
14. **Sessions are efficient** - System prompts sent only once, saves tokens
15. **Natural execution** - No forced step ordering, Coder works plan organically

### What Actually Works Best
- Task descriptions under 50 words
- Plans with 3-5 concrete steps
- Focused changes (multi-file supported but keep related)
- Clear verification criteria in plans
- Using 'simplify' when plan is over 10 steps
- Let Coder work through plan naturally rather than forcing sequence

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
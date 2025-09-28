# Planning Feedback History

Curmudgeon simplification request: Looking at this plan, I see unnecessary complexity creeping in for what should be a straightforward feature.

The core issue: You're creating a new file, a new prompt file, and spreading logic across multiple places for what is essentially a single function that makes an LLM call. This is classic over-engineering - creating "architecture" for a simple feature.

Here's what's wrong:
1. **Separate prompt file** - For a simple "give me 2-3 words in kebab-case" instruction? That's a one-liner that belongs inline with the function. The Scribe agent has complex formatting requirements; this doesn't.

2. **New utility file** - You already have `id-generator.ts`. Why not just add a function there? Creating new files for every feature is how codebases become mazes.

3. **Over-specified steps** - Steps 2 and 5 are artificial separation. The provider is already initialized in the CLI flow; you don't need a separate verification step for it.

**Simpler approach:**
1. Add `generateTaskName()` function to existing `src/utils/id-generator.ts`
2. Update CLI to call this new function with the provider
3. Done.

The function itself should be maybe 20-30 lines including the prompt string, error handling, and validation. No need for separate files, no need for complex coordination. Just a function that tries to get a name from the LLM and falls back to the existing ID generator.

This is a perfect example of making a mountain out of a molehill. You're not building a naming service; you're adding one smart function to replace random IDs.

**Verdict: simplify**

The plan needs to be condensed to focus on the actual change: adding a single function that generates better names. Keep it in the existing file structure, keep the prompt inline, and stop treating every feature like it needs its own architecture.
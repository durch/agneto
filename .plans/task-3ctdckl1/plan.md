# Add Terminal Markdown Rendering with marked-terminal

## Context
Agneto currently displays markdown content (plans and agent responses) as raw markdown text in the terminal. The project has a sophisticated chalk-based colored UI system with phase badges and agent-specific formatting. The `displayPlan()` function in `src/ui/planning-interface.ts:37` directly outputs raw markdown with `console.log(planMd)`.

## Acceptance Criteria
- Plans and agent responses with markdown are rendered with proper terminal formatting (headers, lists, code blocks, etc.)
- Existing agent color schemes and phase badges are preserved
- No breaking changes to LogUI system or console output
- marked-terminal dependency is properly added
- Integration works seamlessly with existing `console.log`-based output

## Steps

1. **Install marked-terminal dependency**
   - Intent: Add the marked-terminal library for terminal markdown rendering
   - Files: `package.json`
   - Verify: `npm list marked-terminal` shows the package is installed

2. **Create markdown rendering utility**
   - Intent: Build a utility function that renders markdown while preserving existing chalk formatting
   - Files: `src/ui/markdown-renderer.ts` (new file)
   - Verify: Function properly renders markdown and integrates with chalk colors

3. **Update displayPlan function to use markdown rendering**
   - Intent: Replace raw markdown output with formatted terminal rendering
   - Files: `src/ui/planning-interface.ts:37`
   - Verify: Plans display with proper headers, lists, and formatting while maintaining existing UI structure

4. **Verify integration and test build**
   - Intent: Ensure TypeScript compiles and existing functionality works
   - Files: Run `npm run build` and basic functionality tests
   - Verify: Build succeeds and no regressions in existing colored output

## Risks & Rollbacks
- **Risk**: marked-terminal might conflict with existing chalk styling
- **Mitigation**: Test integration carefully and use marked-terminal's theming options
- **Rollback**: Revert `displayPlan` function to direct `console.log(planMd)` if issues arise

**Confidence**: I'm confident this approach will work based on examination of the codebase structure. The integration point is well-isolated in the `displayPlan` function, and marked-terminal is designed to work alongside existing terminal coloring libraries.

---
_Plan created after 1 iteration(s) with human feedback_

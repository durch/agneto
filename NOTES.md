+ [ ] Approve plan menu does not show up, after crumudgeon approves the plan, weird interplay, analyse with the debug modal
+ [ ] Kicking off a new cycle from superreviewer is broken, bean counter has stale state, and just calls the task completed
+ [ ] There should be no text input on human superreviewer new task, the SR feedback should be fed to planner, and the loop resets
+ [ ] Clean up all remanants of resolver hell
+ [ ] Prompt injection is broken
+ [x] Merge commands should just be dropped into the terminal, no need for a separate merge flow, we exit the UI after Gardener is done, and plain log the commands to terminal
+ [ ] There are a bunch of place where the flow gets stuck, ultrathink review for these. Transition to ExecutionLayout also gets stuck. I believe these are remanants from the commandbus migration
+ [ ] npm run merge should merge to active branch
+ [ ] Terrible rendering of text input modals
+ [ ] Support for codex for planning and superreviewing
+ [ ] Initial chunk code review feedback does not show
+ [ ] Bean counter output has not markdown rendering
+ [ ] Comprehensive review and possible unification of the event emission across the board

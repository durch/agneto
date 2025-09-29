# Planning Feedback History

Curmudgeon simplification request: Looking at this plan, I see a textbook case of over-engineering a simple feature.

You're proposing to create **6 new files** including a schema definition, TypeScript types, validators, configuration loaders, a dedicated file copying utility, and an example configuration file - all for what is essentially reading a JSON file and copying some files. This is like building a factory to make a sandwich.

The biggest red flag is creating separate schema and validator infrastructure when you just need to read a simple list of file paths. You don't need AJV validation, TypeScript interfaces, and schema exports for what will likely be a JSON file with an array of strings. The existing codebase already has `copyDirectoryRecursive()` - just use it directly instead of wrapping it in yet another abstraction layer.

Here's what this should actually look like:

1. **Single function in the existing worktrees.ts**: Add a `copyUntrackedFiles()` function that reads `.agneto.json` if it exists, gets the list of files to copy, and copies them. About 30-40 lines total.

2. **Simple config format**: Just `{ "copyToWorktree": ["path1", "path2"] }`. No schema validation needed - if the JSON is malformed or missing, skip copying and move on.

3. **Direct integration**: Call your new function at the end of `ensureWorktree()`. One line added.

That's it. Three changes to one existing file instead of 6 new files. The current plan treats a 50-line feature like it's a distributed microservices architecture. You're not building a plugin system here - you're copying a few files based on a config.

The validation overhead alone (schema, types, validators) would be more code than the actual feature. And creating a separate "file-copier" utility for functionality that already exists in the codebase? That's abstraction for abstraction's sake.

**Verdict: simplify**

Keep it dead simple - read config, copy files, done. No schemas, no validators, no separate utilities. Just practical code that solves the actual problem.
import type { LLMProvider } from "../providers/index.js";

/**
 * Generate a commit message by analyzing staged git changes
 * Uses Sonnet model for fast, efficient commit message generation
 */
export async function generateCommitMessage(
  provider: LLMProvider,
  cwd: string
): Promise<string> {
  const prompt = `You are a commit message generator. Analyze git changes and create a proper commit message.

First check for staged changes with 'git diff --cached'. If there are no staged changes, check unstaged changes with 'git diff'.
Run the appropriate git diff commands to understand what changed, then write a concise, descriptive commit message.

Output ONLY the commit message, nothing else.`;

  const response = await provider.query({
    cwd,
    mode: "default",
    model: "haiku", // Use fast haiku model
    allowedTools: ["Bash"],
    messages: [{ role: "user", content: prompt }],
  });

  return response?.trim() || "Update code";
}
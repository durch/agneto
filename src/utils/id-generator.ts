import type { LLMProvider } from "../providers/index.js";

/**
 * Generate a short, unique, git-safe task ID
 */
export function generateTaskId(): string {
  // Use timestamp for uniqueness and convert to base36 for compactness
  const timestamp = Date.now().toString(36).slice(-4);
  
  // Add random component to avoid collisions
  const random = Math.random().toString(36).slice(2, 6);
  
  return `task-${timestamp}${random}`;
}

/**
 * Generate a valid UUID v4
 * Required for Claude CLI's --resume flag
 */
export function generateUUID(): string {
  // Generate a valid UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Check if a string is a valid git branch name
 */
export function isValidGitBranchName(name: string): boolean {
  // Basic git branch name rules
  if (!name || name.length === 0) return false;
  
  // Cannot start with dot, dash, or slash
  if (/^[.-\/]/.test(name)) return false;
  
  // Cannot end with .lock
  if (name.endsWith('.lock')) return false;
  
  // Cannot contain certain characters
  if (/[\s~^:?*\[\]\\]/.test(name)) return false;
  
  // Cannot contain consecutive dots or slashes
  if (/\.\.|\/{2,}/.test(name)) return false;
  
  return true;
}

/**
 * Generate a descriptive task name from task description using LLM
 * Falls back to generateTaskId() on any error to ensure CLI reliability
 */
export async function generateTaskName(
  provider: LLMProvider,
  taskDescription: string
): Promise<string> {
  try {
    const prompt = `Generate a short, descriptive task name from this description: "${taskDescription}"

Requirements:
- Use 2-3 words maximum
- Use kebab-case format (lowercase, dash-separated)
- Focus on the main action or feature
- Must be valid for git branch names
- Examples: "fix-auth", "add-login", "update-tests"

Output ONLY the task name, nothing else.`;

    const response = await provider.query({
      cwd: process.cwd(),
      mode: "plan", // Read-only mode, no tools needed
      model: "sonnet", // Use fast Sonnet model
      messages: [{ role: "user", content: prompt }],
    });

    if (!response || typeof response !== 'string') {
      return generateTaskId();
    }

    // Clean and format the response
    let taskName = response.trim().toLowerCase();

    // Convert spaces to dashes for kebab-case
    taskName = taskName.replace(/\s+/g, '-');

    // Remove any non-alphanumeric characters except dashes
    taskName = taskName.replace(/[^a-z0-9-]/g, '');

    // Remove consecutive dashes
    taskName = taskName.replace(/-+/g, '-');

    // Remove leading/trailing dashes
    taskName = taskName.replace(/^-|-$/g, '');

    // Validate the generated name using existing git validation
    if (taskName && isValidGitBranchName(taskName)) {
      return taskName;
    }

    // Fall back to generated ID if validation fails
    return generateTaskId();

  } catch (error) {
    // On any error, fall back to generated ID to ensure CLI never breaks
    return generateTaskId();
  }
}
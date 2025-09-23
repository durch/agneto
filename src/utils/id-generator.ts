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
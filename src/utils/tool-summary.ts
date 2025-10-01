/**
 * Utility for summarizing tool parameters into concise, human-readable format
 * Used for displaying tool status in UI and logs
 */

export function summarizeToolParams(tool: string, params?: any): string {
  if (!params) return '';

  // Handle common tool types with smart formatting
  switch (tool.toLowerCase()) {
    case 'readfile':
    case 'read':
      return params.file_path ? `${params.file_path}` : '';

    case 'write':
    case 'edit':
    case 'multiedit':
      return params.file_path ? `${params.file_path}` : '';

    case 'grep':
      if (params.pattern) {
        const pattern = params.pattern.length > 30
          ? params.pattern.slice(0, 27) + '...'
          : params.pattern;
        const scope = params.glob || params.path || 'all files';
        return `'${pattern}' in ${scope}`;
      }
      return '';

    case 'bash':
      if (params.command) {
        const command = params.command.length > 50
          ? params.command.slice(0, 47) + '...'
          : params.command;
        return `${command}`;
      }
      return '';

    case 'listdir':
    case 'ls':
      return params.path ? `${params.path}` : '';

    case 'todowrite':
      if (params.todos && Array.isArray(params.todos)) {
        return `${params.todos.length} todos`;
      }
      return '';

    default:
      // Fallback for unknown tools - truncate JSON at reasonable length
      try {
        const jsonStr = JSON.stringify(params);
        if (jsonStr.length > 50) {
          return `${jsonStr.slice(0, 47)}...`;
        }
        return jsonStr;
      } catch {
        return 'complex params';
      }
  }
}

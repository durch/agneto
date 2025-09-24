/**
 * Simple template rendering system for injecting dynamic content into prompts
 */

/**
 * Renders a template string by replacing placeholders with values
 * @param template The template string containing {{placeholders}}
 * @param variables Object mapping placeholder names to values
 * @returns The rendered string with placeholders replaced
 */
export function renderPrompt(template: string, variables: Record<string, string>): string {
  let rendered = template;

  for (const [key, value] of Object.entries(variables)) {
    // Replace all occurrences of {{key}} with the value
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(placeholder, value);
  }

  // Check for any remaining placeholders (indicates missing variables)
  const remainingPlaceholders = rendered.match(/{{[^}]+}}/g);
  if (remainingPlaceholders) {
    console.warn(`Warning: Unresolved placeholders in prompt: ${remainingPlaceholders.join(', ')}`);
  }

  return rendered;
}

/**
 * Helper to inject common variables into all prompts
 */
export function renderAgentPrompt(
  template: string,
  schema: string,
  additionalVars: Record<string, string> = {}
): string {
  return renderPrompt(template, {
    SCHEMA: schema,
    ...additionalVars
  });
}
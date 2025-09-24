/**
 * Clean markdown-wrapped JSON responses from LLMs
 * Many LLMs wrap JSON in markdown code blocks even when asked for raw JSON
 */
export function cleanJsonResponse(response: string): string {
    // Remove markdown code block wrappers if present
    // Matches ```json or ``` followed by content and closing ```
    const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
        return jsonMatch[1].trim();
    }
    return response.trim();
}
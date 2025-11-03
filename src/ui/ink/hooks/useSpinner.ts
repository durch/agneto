/**
 * Spinner frames using Braille patterns - all same character width
 * These are the standard spinner characters used by many CLI tools (npm, yarn, etc.)
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Custom hook that provides a static spinner character
 *
 * @param isActive - Controls whether the spinner should be displayed
 * @returns Static spinner character when active, empty string otherwise
 *
 * Note: This hook returns a constant character (no animation) to reduce
 * terminal re-rendering and improve performance.
 */
export function useSpinner(isActive: boolean): string {
  return isActive ? SPINNER_FRAMES[0] : '';
}

/**
 * Terminal bell utility for audio notifications
 *
 * Provides a simple way to trigger terminal bell sounds for user notifications.
 * Uses the ASCII BEL control character (\x07) for maximum cross-platform compatibility.
 *
 * @example
 * ```typescript
 * import { bell } from './utils/terminal-bell.js';
 *
 * // Ring the terminal bell
 * bell();
 * ```
 */

/**
 * Ring the terminal bell using ASCII BEL character
 *
 * This function writes the ASCII bell character (\x07) to stdout, which
 * triggers an audio notification in most terminal emulators. The function
 * handles errors silently to ensure it never breaks the application flow.
 *
 * Cross-platform compatible with:
 * - macOS Terminal, iTerm2
 * - Windows Command Prompt, PowerShell, Windows Terminal
 * - Linux terminal emulators (gnome-terminal, konsole, xterm, etc.)
 *
 * @returns void
 */
export function bell(): void {
  try {
    // Write ASCII BEL character directly to stdout
    // \x07 is the standard ASCII control character for terminal bell
    process.stdout.write('\x07');
  } catch (error) {
    // Silent failure - bell notifications should never break the application
    // If stdout is not available or there's any error, we simply ignore it
  }
}
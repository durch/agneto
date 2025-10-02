import { useState, useEffect } from 'react';

/**
 * Spinner frames using Braille patterns - all same character width
 * These are the standard spinner characters used by many CLI tools (npm, yarn, etc.)
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Animation interval in milliseconds
 * 150ms = ~6.7 fps - smooth but not excessive to prevent flickering
 */
const FRAME_INTERVAL = 150;

/**
 * Custom hook that provides an animated spinner character
 *
 * @param isActive - Controls whether the spinner should animate
 * @returns Current spinner frame character
 *
 * Performance notes:
 * - Only animates when isActive is true
 * - Properly cleans up interval on unmount
 * - React only re-renders the Text component, not the entire layout
 * - Braille characters are monospace width = no layout reflow
 */
export function useSpinner(isActive: boolean): string {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    // Only run animation when active
    if (!isActive) {
      setFrame(0); // Reset to first frame when inactive
      return;
    }

    // Set up animation interval
    const interval = setInterval(() => {
      setFrame((prevFrame) => (prevFrame + 1) % SPINNER_FRAMES.length);
    }, FRAME_INTERVAL);

    // Cleanup interval on unmount or when isActive changes
    return () => clearInterval(interval);
  }, [isActive]);

  return SPINNER_FRAMES[frame];
}

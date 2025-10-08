import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';

/**
 * Humorous phrases the Bean Counter cycles through while working
 * These reflect the Bean Counter's role: breaking down work, preventing over-engineering,
 * and coordinating small, manageable chunks.
 */
const BEAN_COUNTER_PHRASES = [
  "Counting the beans...",
  "Breaking work into bite-sized chunks...",
  "Avoiding over-engineering...",
  "Making sure Coder doesn't get overwhelmed...",
  "Chunking responsibly...",
  "Dividing and conquering...",
  "Keeping it small and focused...",
  "Planning the next sprint...",
  "Organizing the chaos...",
  "Doing the math...",
  "Calculating optimal chunk size...",
  "Preventing scope creep...",
  "Being conservative with estimates...",
  "Making bean soup out of feature requests...",
  "Consulting the ancient scrolls of Agile...",
  "Summoning the spirits of incremental development...",
  "Polishing the abacus...",
  "Channeling inner Scrum Master energy...",
  "Splitting hairs and tasks...",
  "Practicing extreme decomposition...",
  "Negotiating with complexity...",
  "Herding cats into neat little boxes...",
  "Tetris-ing the work breakdown...",
  "Applying the sacred art of chunking...",
];

/**
 * Phrase rotation interval in milliseconds
 * Changes phrase every 2 seconds for variety without being distracting
 */
const PHRASE_INTERVAL = 2000;

/**
 * BeanCounterAnimation - Animated display for Bean Counter activity
 *
 * Memoized component that manages its own animation state.
 * Only this component re-renders during animation, preventing parent flickering.
 *
 * Features:
 * - Rotating humorous phrases about work breakdown
 * - Animated spinner using Braille patterns
 * - Separate animation intervals for spinner (150ms) and phrases (2000ms)
 * - No phrase repeats until all have been shown
 */
export const BeanCounterAnimation = React.memo(() => {
  const [currentPhrase, setCurrentPhrase] = useState(BEAN_COUNTER_PHRASES[0]);
  const [unusedPhrases, setUnusedPhrases] = useState<string[]>([...BEAN_COUNTER_PHRASES]);

  // Phrase rotation effect - cycles through all phrases before repeating
  useEffect(() => {
    const intervalId = setInterval(() => {
      setUnusedPhrases((prevUnused) => {
        // If we've used all phrases, reset the pool
        if (prevUnused.length === 0) {
          const newPool = [...BEAN_COUNTER_PHRASES];
          const randomIndex = Math.floor(Math.random() * newPool.length);
          const nextPhrase = newPool[randomIndex];
          setCurrentPhrase(nextPhrase);
          return newPool.filter((p) => p !== nextPhrase);
        }

        // Pick a random phrase from the unused pool
        const randomIndex = Math.floor(Math.random() * prevUnused.length);
        const nextPhrase = prevUnused[randomIndex];
        setCurrentPhrase(nextPhrase);

        // Remove the selected phrase from the pool
        return prevUnused.filter((_, index) => index !== randomIndex);
      });
    }, PHRASE_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" paddingY={1}>
      <Box>
        <Text dimColor>{currentPhrase}</Text>
      </Box>
    </Box>
  );
});

BeanCounterAnimation.displayName = 'BeanCounterAnimation';

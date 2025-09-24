// Minimal TypeScript application
export function main(): void {
  console.log('Application starting...');

  const result = processData([1, 2, 3, 4, 5]);
  console.log('Result:', result);

  console.log('Application finished.');
}

function processData(numbers: number[]): number {
  return numbers.reduce((sum, n) => sum + n, 0);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
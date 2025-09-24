import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Extended timeouts for Claude CLI calls
    testTimeout: 30000,  // 30 seconds default
    hookTimeout: 10000,  // 10 seconds for setup/teardown

    // Global test configuration
    globals: false,
    environment: 'node',

    // Test file patterns
    include: ['test/**/*.test.ts', 'test/**/*.integration.test.ts'],
    exclude: ['node_modules', 'dist', '.worktrees', '.test-worktrees'],

    // Coverage configuration (for future use)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'test',
        '*.config.ts',
        'dist',
        '.worktrees',
        'scripts'
      ]
    },

    // Reporter options
    reporters: ['verbose'],

    // Retry flaky tests (Claude can sometimes timeout)
    retry: 1,

    // Run tests in sequence by default (git operations can conflict)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './test')
    }
  }
});
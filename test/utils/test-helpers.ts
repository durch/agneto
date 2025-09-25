import { execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach } from 'vitest';

/**
 * Test workspace manager for isolated test environments
 */
export class TestWorkspace {
  private tempDir: string | null = null;
  private worktreeDirs: string[] = [];

  /**
   * Set up a test workspace with git repo
   */
  async setup(name: string = 'test'): Promise<string> {
    // Create temp directory
    this.tempDir = mkdtempSync(join(tmpdir(), `agneto-test-${name}-`));

    // Initialize git repo
    execSync('git init', { cwd: this.tempDir });
    execSync('git config user.email "test@agneto.ai"', { cwd: this.tempDir });
    execSync('git config user.name "Test User"', { cwd: this.tempDir });

    // Create initial commit
    writeFileSync(join(this.tempDir, 'README.md'), '# Test Repository\n');
    execSync('git add .', { cwd: this.tempDir });
    execSync('git commit -m "Initial commit"', { cwd: this.tempDir });

    // Create master branch explicitly
    execSync('git branch -M master', { cwd: this.tempDir });

    // Set up a fake origin remote pointing to self (for tests)
    // This allows the worktree code to work with origin/main references
    execSync(`git remote add origin ${this.tempDir}`, { cwd: this.tempDir });
    execSync('git fetch origin', { cwd: this.tempDir });
    execSync('git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/master', { cwd: this.tempDir });

    return this.tempDir;
  }

  /**
   * Create a worktree for testing
   */
  createWorktree(taskId: string): string {
    if (!this.tempDir) throw new Error('Workspace not set up');

    const worktreeDir = join(this.tempDir, '.worktrees', taskId);
    const branch = `sandbox/${taskId}`;

    // Create worktree
    mkdirSync(join(this.tempDir, '.worktrees'), { recursive: true });
    execSync(`git worktree add -b ${branch} ${worktreeDir}`, { cwd: this.tempDir });

    this.worktreeDirs.push(worktreeDir);
    return worktreeDir;
  }

  /**
   * Clean up test workspace
   */
  async cleanup(): Promise<void> {
    if (!this.tempDir) return;

    // Clean up worktrees first
    for (const dir of this.worktreeDirs) {
      try {
        execSync(`git worktree remove ${dir} --force`, { cwd: this.tempDir });
      } catch (e) {
        // Ignore errors, we'll force delete anyway
      }
    }

    // Remove temp directory
    if (existsSync(this.tempDir)) {
      rmSync(this.tempDir, { recursive: true, force: true });
    }

    this.tempDir = null;
    this.worktreeDirs = [];
  }

  /**
   * Get the temp directory path
   */
  getPath(): string {
    if (!this.tempDir) throw new Error('Workspace not set up');
    return this.tempDir;
  }
}


/**
 * Higher-order function to run test with automatic workspace setup/cleanup
 */
export async function withTestRepo(
  callback: (repoPath: string) => Promise<void>,
  name: string = 'test'
): Promise<void> {
  const workspace = new TestWorkspace();
  try {
    const repoPath = await workspace.setup(name);
    await callback(repoPath);
  } finally {
    await workspace.cleanup();
  }
}

/**
 * Create a sample TypeScript project in the given directory
 */
export function createSampleTSProject(dir: string): void {
  // package.json
  const packageJson = {
    name: "test-project",
    version: "1.0.0",
    type: "module",
    scripts: {
      build: "tsc",
      test: "echo 'No tests yet'"
    },
    devDependencies: {
      typescript: "^5.0.0",
      "@types/node": "^20.0.0"
    }
  };
  writeFileSync(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ES2022",
      strict: true,
      esModuleInterop: true,
      outDir: "dist"
    },
    include: ["src/**/*"]
  };
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

  // Create src directory
  mkdirSync(join(dir, 'src'), { recursive: true });

  // Sample source file
  writeFileSync(join(dir, 'src/index.ts'), `// Main entry point
export function main(): void {
  console.log('Hello, World!');
}

main();
`);
}

/**
 * Create a sample plan markdown file
 */
export function createSamplePlan(simple: boolean = true): string {
  if (simple) {
    return `# Task: Add hello world function

## Goal
Create a simple hello world function

## Steps
1. Create a new file src/hello.ts
2. Add a function that returns "Hello, World!"
3. Export the function

## Success Criteria
- Function exists and is exported
- Function returns the correct string`;
  }

  return `# Task: Refactor logging system

## Goal
Refactor the existing console.log statements to use a proper logging library

## Steps
1. Install winston logging library
2. Create src/utils/logger.ts with winston configuration
3. Replace all console.log statements with logger calls
4. Add log levels (info, warn, error, debug)
5. Configure log output format

## Success Criteria
- All console.log statements replaced
- Logger properly configured
- Different log levels working
- No breaking changes to existing functionality`;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Timeout waiting for condition');
}

/**
 * Setup and teardown hooks for common test scenarios
 */
export function setupTestHooks() {
  let workspace: TestWorkspace;

  beforeEach(() => {
    workspace = new TestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  return {
    getWorkspace: () => workspace
  };
}
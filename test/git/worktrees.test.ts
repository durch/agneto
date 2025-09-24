import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ensureWorktree, listWorktrees, removeWorktree } from '../../src/git/worktrees.js';
import { TestWorkspace } from '../utils/test-helpers.js';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

describe('Git Worktrees', () => {
  let workspace: TestWorkspace;
  let repoPath: string;

  beforeEach(async () => {
    workspace = new TestWorkspace();
    repoPath = await workspace.setup('worktree-test');
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('creates isolated worktree', () => {
    const taskId = 'test-task-1';

    // Use the repo as working directory
    process.chdir(repoPath);

    const result = ensureWorktree(taskId);

    expect(result.dir).toBeDefined();
    expect(result.branch).toBe(`sandbox/${taskId}`);

    // Verify worktree exists
    expect(existsSync(result.dir)).toBe(true);

    // Verify it's a git worktree
    const worktrees = execSync('git worktree list', { encoding: 'utf8', cwd: repoPath });
    expect(worktrees).toContain(taskId);
    expect(worktrees).toContain(`sandbox/${taskId}`);

    // Verify correct branch
    const currentBranch = execSync('git branch --show-current', {
      encoding: 'utf8',
      cwd: result.dir
    }).trim();
    expect(currentBranch).toBe(`sandbox/${taskId}`);
  });

  it('handles existing worktree gracefully', () => {
    const taskId = 'test-task-2';

    process.chdir(repoPath);

    // Create worktree first time
    const result1 = ensureWorktree(taskId);
    expect(result1.dir).toBeDefined();

    // Try to create same worktree again
    const result2 = ensureWorktree(taskId);

    // Should return the same worktree
    expect(result2.dir).toBe(result1.dir);
    expect(result2.branch).toBe(result1.branch);

    // Should still exist and be valid
    expect(existsSync(result2.dir)).toBe(true);
  });

  it('creates worktree in correct directory structure', () => {
    const taskId = 'test-task-3';

    process.chdir(repoPath);

    const result = ensureWorktree(taskId);

    // Should be under .worktrees directory
    expect(result.dir).toContain('.worktrees');
    expect(result.dir).toContain(taskId);

    // Should end with the expected path structure
    expect(result.dir.endsWith(`.worktrees/${taskId}`)).toBe(true);
  });

  it('lists all worktrees correctly', () => {
    process.chdir(repoPath);

    // Create multiple worktrees
    const task1 = ensureWorktree('list-test-1');
    const task2 = ensureWorktree('list-test-2');

    const worktrees = listWorktrees();

    expect(worktrees).toBeDefined();
    expect(Array.isArray(worktrees)).toBe(true);

    // Should include our test worktrees
    const paths = worktrees.map(w => w.path);
    expect(paths).toContain(task1.dir);
    expect(paths).toContain(task2.dir);

    // Should have branch info
    const branches = worktrees.map(w => w.branch);
    expect(branches).toContain('sandbox/list-test-1');
    expect(branches).toContain('sandbox/list-test-2');
  });

  it('removes worktree completely', () => {
    const taskId = 'remove-test-1';

    process.chdir(repoPath);

    // Create worktree
    const result = ensureWorktree(taskId);
    expect(existsSync(result.dir)).toBe(true);

    // Remove it
    removeWorktree(taskId);

    // Should be gone
    expect(existsSync(result.dir)).toBe(false);

    // Should not be in worktree list
    const worktrees = execSync('git worktree list', { encoding: 'utf8', cwd: repoPath });
    expect(worktrees).not.toContain(taskId);

    // Branch should be deleted too
    const branches = execSync('git branch -a', { encoding: 'utf8', cwd: repoPath });
    expect(branches).not.toContain(`sandbox/${taskId}`);
  });

  it('handles removal of non-existent worktree', () => {
    process.chdir(repoPath);

    // Should not throw when removing non-existent worktree
    expect(() => removeWorktree('non-existent-task')).not.toThrow();
  });

  it('isolates changes between worktrees', () => {
    process.chdir(repoPath);

    const task1 = ensureWorktree('isolate-test-1');
    const task2 = ensureWorktree('isolate-test-2');

    // Make change in worktree 1
    const file1 = join(task1.dir, 'test1.txt');
    execSync(`echo "test1" > test1.txt`, { cwd: task1.dir });

    // Make different change in worktree 2
    const file2 = join(task2.dir, 'test2.txt');
    execSync(`echo "test2" > test2.txt`, { cwd: task2.dir });

    // Changes should be isolated
    expect(existsSync(join(task1.dir, 'test1.txt'))).toBe(true);
    expect(existsSync(join(task1.dir, 'test2.txt'))).toBe(false);

    expect(existsSync(join(task2.dir, 'test2.txt'))).toBe(true);
    expect(existsSync(join(task2.dir, 'test1.txt'))).toBe(false);
  });

  it('preserves main branch state', () => {
    process.chdir(repoPath);

    // Get initial files in main branch (excluding .worktrees)
    const initialFiles = execSync('ls -1 | grep -v worktrees || true', { encoding: 'utf8', cwd: repoPath }).trim();

    // Create and modify worktree
    const task = ensureWorktree('preserve-test');
    execSync('echo "new file" > newfile.txt', { cwd: task.dir });
    execSync('git add .', { cwd: task.dir });
    execSync('git commit -m "test commit"', { cwd: task.dir });

    // Main branch files should be unchanged (excluding .worktrees)
    const finalFiles = execSync('ls -1 | grep -v worktrees || true', { encoding: 'utf8', cwd: repoPath }).trim();
    expect(finalFiles).toBe(initialFiles);

    // Main branch should not have the new file
    expect(existsSync(join(repoPath, 'newfile.txt'))).toBe(false);
  });

  it('handles concurrent worktrees', () => {
    process.chdir(repoPath);

    // Create multiple worktrees simultaneously
    const tasks = ['concurrent-1', 'concurrent-2', 'concurrent-3'];
    const results = tasks.map(id => ensureWorktree(id));

    // All should be created successfully
    results.forEach((result, i) => {
      expect(existsSync(result.dir)).toBe(true);
      expect(result.branch).toBe(`sandbox/${tasks[i]}`);
    });

    // All should be in worktree list
    const worktreeList = execSync('git worktree list', { encoding: 'utf8', cwd: repoPath });
    tasks.forEach(task => {
      expect(worktreeList).toContain(task);
    });
  });
});
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { runPlanner } from '../../src/agents/planner.js';
import { selectProvider } from '../../src/providers/index.js';
import { TestWorkspace, validateClaudeCLI, createSampleTSProject } from '../utils/test-helpers.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Planner Agent Integration', () => {
  let provider: any;
  let workspace: TestWorkspace;

  beforeAll(async () => {
    // Skip validation - if Claude CLI isn't there, tests will fail anyway
    provider = await selectProvider();
  });

  beforeEach(async () => {
    workspace = new TestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('generates valid plan for simple task', async () => {
    const testDir = await workspace.setup('planner-simple');
    createSampleTSProject(testDir);

    const taskId = 'test-plan-1';
    const task = 'Add a hello world function to src/hello.ts';

    const result = await runPlanner(provider, testDir, task, taskId, false);

    // Verify plan was created
    expect(result.planMd).toBeDefined();
    expect(result.planPath).toBeDefined();

    // Verify plan content
    expect(result.planMd).toContain('hello');
    expect(result.planMd.length).toBeGreaterThan(50); // Not empty

    // Verify plan file was written
    expect(existsSync(result.planPath)).toBe(true);

    const savedPlan = readFileSync(result.planPath, 'utf-8');
    expect(savedPlan).toBe(result.planMd);

    // Verify plan has expected structure
    expect(result.planMd).toMatch(/#{1,2}\s+(Goal|Objective|Task)/i);
    expect(result.planMd).toMatch(/#{1,2}\s+(Steps|Plan|Implementation)/i);
  }, 60000);

  it('generates plan with multiple steps for complex task', async () => {
    const testDir = await workspace.setup('planner-complex');
    createSampleTSProject(testDir);

    const taskId = 'test-plan-2';
    const task = 'Add a complete logging system with winston, including configuration, different log levels, and file rotation';

    const result = await runPlanner(provider, testDir, task, taskId, false);

    expect(result.planMd).toBeDefined();

    // Should have multiple steps
    const steps = result.planMd.match(/^\d+\./gm) || [];
    expect(steps.length).toBeGreaterThan(2);

    // Should mention key components
    expect(result.planMd.toLowerCase()).toContain('winston');
    expect(result.planMd.toLowerCase()).toMatch(/log.*level/);
  }, 60000);

  it('creates plan in correct directory structure', async () => {
    const testDir = await workspace.setup('planner-dirs');
    createSampleTSProject(testDir);

    const taskId = 'test-plan-3';
    const task = 'Add a simple utility function';

    const result = await runPlanner(provider, testDir, task, taskId, false);

    // Verify directory structure
    const planDir = join(testDir, '.plans', taskId);
    expect(existsSync(planDir)).toBe(true);

    const planFile = join(planDir, 'plan.md');
    expect(existsSync(planFile)).toBe(true);
    expect(result.planPath).toBe(planFile);
  }, 60000);

  it('handles task with existing code context', async () => {
    const testDir = await workspace.setup('planner-context');
    createSampleTSProject(testDir);

    // Add some existing code
    const srcFile = join(testDir, 'src/calculator.ts');
    const existingCode = `export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}`;
    const { writeFileSync } = await import('fs');
    writeFileSync(srcFile, existingCode);

    const taskId = 'test-plan-4';
    const task = 'Add multiply and divide functions to the calculator';

    const result = await runPlanner(provider, testDir, task, taskId, false);

    expect(result.planMd).toBeDefined();

    // Should reference the calculator context
    expect(result.planMd.toLowerCase()).toMatch(/calculator|multiply|divide/);
  }, 60000);

  it('generates actionable plans with clear success criteria', async () => {
    const testDir = await workspace.setup('planner-criteria');
    createSampleTSProject(testDir);

    const taskId = 'test-plan-5';
    const task = 'Add input validation to ensure all functions handle edge cases';

    const result = await runPlanner(provider, testDir, task, taskId, false);

    expect(result.planMd).toBeDefined();

    // Should have success criteria or verification section
    expect(result.planMd.toLowerCase()).toMatch(
      /(success|criteria|verification|test|validate|ensure)/
    );
  }, 60000);

  it('handles non-interactive mode correctly', async () => {
    const testDir = await workspace.setup('planner-noninteractive');
    createSampleTSProject(testDir);

    const taskId = 'test-plan-6';
    const task = 'Add a configuration loader';

    // Non-interactive should complete without prompts
    const result = await runPlanner(provider, testDir, task, taskId, false);

    expect(result.planMd).toBeDefined();
    expect(result.planPath).toBeDefined();

    // Should generate a complete plan without interaction
    expect(result.planMd.length).toBeGreaterThan(100);
  }, 60000);
});
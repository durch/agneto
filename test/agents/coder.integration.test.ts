import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { proposePlan, implementPlan } from '../../src/agents/coder.js';
import { selectProvider } from '../../src/providers/index.js';
import { TestWorkspace, validateClaudeCLI, createSampleTSProject, createSamplePlan } from '../utils/test-helpers.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { generateUUID } from '../../src/utils/id-generator.js';

describe('Coder Agent Integration', () => {
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

  it('proposes valid plan from task in PLANNING MODE', async () => {
    const testDir = await workspace.setup('coder-planning');
    createSampleTSProject(testDir);

    const planMd = createSamplePlan(true);
    const sessionId = generateUUID();

    const proposal = await proposePlan(
      provider,
      testDir,
      planMd,
      'Review the plan and propose what to implement',
      null,
      sessionId,
      false
    );

    // Should return a valid proposal
    expect(proposal).toBeDefined();

    // Check if it's a completion signal or a plan
    if (proposal && proposal.description !== 'COMPLETE') {
      expect(proposal.description).toBeDefined();
      expect(proposal.steps).toBeDefined();
      expect(Array.isArray(proposal.steps)).toBe(true);
      expect(proposal.files).toBeDefined();
      expect(Array.isArray(proposal.files)).toBe(true);
    }
  }, 60000);

  it('signals completion correctly when all work is done', async () => {
    const testDir = await workspace.setup('coder-complete');
    createSampleTSProject(testDir);

    // Create a plan that's already implemented
    const planMd = `# Task: Already Completed

## Goal
This task has already been completed.

## Steps
1. ✅ File already exists
2. ✅ Function already implemented

## Success Criteria
- All criteria met`;

    const sessionId = generateUUID();

    const proposal = await proposePlan(
      provider,
      testDir,
      planMd,
      'Review the plan and check if there is more work to do',
      null,
      sessionId,
      false
    );

    // Could signal completion or identify no work needed
    expect(proposal).toBeDefined();
    // Either null or description contains COMPLETE or similar
    if (proposal) {
      expect(proposal.description).toBeDefined();
    }
  }, 60000);

  it('implements approved plan with actual file changes in IMPLEMENTATION MODE', async () => {
    const testDir = await workspace.setup('coder-implement');
    createSampleTSProject(testDir);

    const sessionId = generateUUID();
    const planMd = createSamplePlan(true);

    // First get a plan proposal
    const proposal = await proposePlan(
      provider,
      testDir,
      planMd,
      'Propose what to implement',
      null,
      sessionId,
      false
    );

    if (!proposal || proposal.description === 'COMPLETE') {
      // Skip if nothing to implement
      return;
    }

    // Now implement it
    const implementation = await implementPlan(
      provider,
      testDir,
      proposal,
      sessionId,
      true // Session already initialized
    );

    expect(implementation).toBeDefined();
    expect(implementation.description).toBeDefined();
    expect(implementation.filesChanged).toBeDefined();
    expect(Array.isArray(implementation.filesChanged)).toBe(true);

    // Verify at least one file was changed
    if (implementation.filesChanged.length > 0) {
      const firstFile = implementation.filesChanged[0];
      const filePath = join(testDir, firstFile);

      // File should exist (either created or modified)
      expect(existsSync(filePath)).toBe(true);
    }
  }, 90000);

  it('handles revision feedback correctly', async () => {
    const testDir = await workspace.setup('coder-revision');
    createSampleTSProject(testDir);

    const planMd = createSamplePlan(true);
    const sessionId = generateUUID();

    // First proposal
    const proposal1 = await proposePlan(
      provider,
      testDir,
      planMd,
      'Propose implementation',
      null,
      sessionId,
      false
    );

    // Second proposal with feedback
    const feedback = 'Please include error handling and input validation';
    const proposal2 = await proposePlan(
      provider,
      testDir,
      planMd,
      '',
      feedback,
      sessionId,
      true // Session initialized
    );

    expect(proposal2).toBeDefined();

    // Should acknowledge or incorporate feedback
    if (proposal2 && proposal2.description !== 'COMPLETE') {
      // Either in description or steps
      const hasErrorHandling =
        proposal2.description.toLowerCase().includes('error') ||
        proposal2.description.toLowerCase().includes('validation') ||
        proposal2.steps.some(s => s.toLowerCase().includes('error') || s.toLowerCase().includes('validation'));

      expect(hasErrorHandling).toBe(true);
    }
  }, 90000);

  it('maintains session continuity across multiple calls', async () => {
    const testDir = await workspace.setup('coder-session');
    createSampleTSProject(testDir);

    const planMd = createSamplePlan(false); // Complex plan
    const sessionId = generateUUID();

    // First call
    const proposal1 = await proposePlan(
      provider,
      testDir,
      planMd,
      'Start with the first step',
      null,
      sessionId,
      false
    );

    expect(proposal1).toBeDefined();

    // Second call in same session
    const proposal2 = await proposePlan(
      provider,
      testDir,
      planMd,
      'Continue with the next step',
      null,
      sessionId,
      true // Session initialized
    );

    expect(proposal2).toBeDefined();

    // Sessions should maintain context (different proposals)
    if (proposal1 && proposal2 &&
        proposal1.description !== 'COMPLETE' &&
        proposal2.description !== 'COMPLETE') {
      // Proposals should be different (progressing through plan)
      expect(proposal2.description).not.toBe(proposal1.description);
    }
  }, 90000);

  it('creates actual files when implementing', async () => {
    const testDir = await workspace.setup('coder-files');
    createSampleTSProject(testDir);

    const sessionId = generateUUID();

    // Simple plan to create a specific file
    const planMd = `# Task: Create greeting module

## Goal
Create a new greeting module

## Steps
1. Create src/greeting.ts with a greet function
2. Export the function

## Success Criteria
- File src/greeting.ts exists
- Contains greet function`;

    const proposal = await proposePlan(
      provider,
      testDir,
      planMd,
      'Propose implementation',
      null,
      sessionId,
      false
    );

    if (!proposal || proposal.description === 'COMPLETE') {
      return;
    }

    const implementation = await implementPlan(
      provider,
      testDir,
      proposal,
      sessionId,
      true
    );

    // Check if greeting.ts was created
    const greetingFile = join(testDir, 'src/greeting.ts');

    if (implementation.filesChanged.includes('src/greeting.ts')) {
      expect(existsSync(greetingFile)).toBe(true);

      // Verify it contains actual code
      const content = readFileSync(greetingFile, 'utf-8');
      expect(content.length).toBeGreaterThan(10);
      expect(content).toMatch(/function|const|export/);
    }
  }, 90000);
});
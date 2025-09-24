import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import anthropic from '../../src/providers/anthropic.js';
import { validateClaudeCLI, TestWorkspace } from '../utils/test-helpers.js';
import type { Msg } from '../../src/providers/index.js';

describe('Claude CLI Provider', () => {
  let workspace: TestWorkspace;

  beforeAll(() => {
    // Ensure Claude CLI is available
    const isValid = validateClaudeCLI();
    if (!isValid) {
      throw new Error('Claude CLI not available or not working. Please ensure claude CLI is installed.');
    }
  });

  beforeEach(async () => {
    workspace = new TestWorkspace();
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  it('executes simple query in plan mode', async () => {
    const testDir = await workspace.setup('provider-test');

    const messages: Msg[] = [
      { role: 'user', content: 'Respond with exactly: TEST_SUCCESS' }
    ];

    const response = await anthropic.query({
      cwd: testDir,
      messages,
      mode: 'plan'
    });

    // Verify we got a response
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);

    // Should contain our test marker
    expect(response).toContain('TEST_SUCCESS');
  }, 30000);

  it('handles session management with new session', async () => {
    const testDir = await workspace.setup('session-test');
    const sessionId = 'test-session-' + Date.now();

    const messages: Msg[] = [
      { role: 'user', content: 'Remember this number: 42' }
    ];

    const response = await anthropic.query({
      cwd: testDir,
      messages,
      mode: 'plan',
      sessionId
    });

    expect(response).toBeDefined();
    // Session should be established
    expect(response.length).toBeGreaterThan(0);
  }, 30000);

  it('continues existing session correctly', async () => {
    const testDir = await workspace.setup('session-continue');
    const sessionId = 'test-session-' + Date.now();

    // First call - establish session
    await anthropic.query({
      cwd: testDir,
      messages: [{ role: 'user', content: 'Remember this word: AGNETO' }],
      mode: 'plan',
      sessionId,
      isInitialized: false
    });

    // Second call - continue session
    const response = await anthropic.query({
      cwd: testDir,
      messages: [{ role: 'user', content: 'What word did I ask you to remember?' }],
      mode: 'plan',
      sessionId,
      isInitialized: true
    });

    expect(response).toBeDefined();
    expect(response).toContain('AGNETO');
  }, 60000);

  it('validates JSON output format', async () => {
    const testDir = await workspace.setup('json-test');

    // The provider always uses JSON format internally
    const messages: Msg[] = [
      { role: 'user', content: 'Say OK' }
    ];

    const response = await anthropic.query({
      cwd: testDir,
      messages,
      mode: 'plan'
    });

    // Response should be the extracted result from JSON
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
  }, 30000);

  it('passes tools correctly to CLI in default mode', async () => {
    const testDir = await workspace.setup('tools-test');

    const messages: Msg[] = [
      { role: 'user', content: 'List files in current directory using ListDir tool' }
    ];

    // This should work because default mode has tools
    const response = await anthropic.query({
      cwd: testDir,
      messages,
      mode: 'default',
      allowedTools: ['ListDir', 'ReadFile']
    });

    expect(response).toBeDefined();
    // Should be able to use tools in default mode
    expect(response.length).toBeGreaterThan(0);
  }, 30000);

  it('handles system and user messages correctly', async () => {
    const testDir = await workspace.setup('message-test');

    const messages: Msg[] = [
      { role: 'system', content: 'You are a helpful test assistant. Always end responses with: [TEST_END]' },
      { role: 'user', content: 'Say hello' }
    ];

    const response = await anthropic.query({
      cwd: testDir,
      messages,
      mode: 'plan'
    });

    expect(response).toBeDefined();
    expect(response).toContain('[TEST_END]');
  }, 30000);

  it('handles long prompts correctly', async () => {
    const testDir = await workspace.setup('long-prompt');

    // Create a long prompt
    const longContent = 'Test content. '.repeat(500); // ~6500 chars
    const messages: Msg[] = [
      { role: 'user', content: `${longContent}\n\nNow respond with: LONG_TEST_SUCCESS` }
    ];

    const response = await anthropic.query({
      cwd: testDir,
      messages,
      mode: 'plan'
    });

    expect(response).toBeDefined();
    expect(response).toContain('LONG_TEST_SUCCESS');
  }, 30000);

  it('handles provider errors gracefully', async () => {
    const testDir = await workspace.setup('error-test');

    // Try with invalid mode to trigger an error
    const messages: Msg[] = [
      { role: 'user', content: 'Test' }
    ];

    await expect(anthropic.query({
      cwd: testDir,
      messages,
      mode: 'invalid-mode' as any
    })).rejects.toThrow();
  });

  it('differentiates between plan and default modes', async () => {
    const testDir = await workspace.setup('mode-test');

    const messages: Msg[] = [
      { role: 'user', content: 'What tools do you have access to?' }
    ];

    // Plan mode - no tools
    const planResponse = await anthropic.query({
      cwd: testDir,
      messages,
      mode: 'plan'
    });

    // Default mode - has tools
    const defaultResponse = await anthropic.query({
      cwd: testDir,
      messages,
      mode: 'default'
    });

    expect(planResponse).toBeDefined();
    expect(defaultResponse).toBeDefined();

    // Responses should be different since modes have different capabilities
    expect(planResponse).not.toBe(defaultResponse);
  }, 60000);
});
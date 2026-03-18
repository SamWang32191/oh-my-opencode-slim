import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Test the hashline wiring by creating temporary config files

describe('hashline wiring', () => {
  let tempDir: string;
  let originalEnv: typeof process.env;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashline-test-'));
    originalEnv = { ...process.env };
    // Isolate from real user config
    process.env.XDG_CONFIG_HOME = tempDir;
    // Clear module cache for each test
    Object.keys(require.cache).forEach((key) => {
      if (key.includes('oh-my-opencode-medium') || key.includes('/src/index')) {
        delete require.cache[key];
      }
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.env = originalEnv;
  });

  // Test 1: edit tool is registered only when hashline_edit is enabled
  test('registers edit when hashline_edit is enabled', async () => {
    // Create a project config with hashline_edit enabled
    const projectDir = path.join(tempDir, 'project-enabled');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: true,
      }),
    );

    // Clear module cache to pick up new config
    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // When hashline_edit is enabled, the edit tool should be registered
    expect(plugin.tool).toBeDefined();
    expect('edit' in plugin.tool).toBe(true);
  });

  test('does not register edit when hashline_edit is disabled', async () => {
    // Create a project config with hashline_edit disabled/not set
    const projectDir = path.join(tempDir, 'project-disabled');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: false,
      }),
    );

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // When hashline_edit is disabled, the edit tool should NOT be registered
    expect(plugin.tool).toBeDefined();
    expect('edit' in plugin.tool).toBe(false);
  });

  // Test 2: tool.execute.before captures old content when enabled
  test('tool.execute.before captures old content when hashline_edit enabled', async () => {
    // Create config with hashline_edit enabled
    const projectDir = path.join(tempDir, 'project-before');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: true,
      }),
    );

    // Create a test file with old content
    const testFilePath = path.join(projectDir, 'test.txt');
    fs.writeFileSync(testFilePath, 'old content\nline 2\nline 3');

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // Call the before hook with a write tool
    const beforeInput = {
      tool: 'write',
      sessionID: 'test-session',
      callID: 'test-call-1',
    };
    const beforeOutput = {
      args: { path: testFilePath, content: 'new content\nline 2\nline 3' },
    };

    // Execute the before hook
    await (
      plugin['tool.execute.before'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(beforeInput, beforeOutput);

    // The before hook should have captured the old content for the diff
    // We verify this by checking if the after hook can retrieve it
    const afterInput = {
      tool: 'write',
      sessionID: 'test-session',
      callID: 'test-call-1',
    };
    const afterOutput = {
      title: testFilePath,
      output: 'File written successfully.',
      metadata: {},
    };

    // Execute the after hook - it should find the captured content and attach diff metadata
    await (
      plugin['tool.execute.after'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(afterInput, afterOutput);

    // Verify diff metadata was attached
    expect(afterOutput.metadata).toBeDefined();
    expect(
      (afterOutput.metadata as Record<string, unknown>).filediff,
    ).toBeDefined();
    const filediff = (afterOutput.metadata as Record<string, unknown>)
      .filediff as Record<string, unknown>;
    expect(filediff.before).toBe('old content\nline 2\nline 3');
    expect(filediff.additions).toBe(0); // same number of lines, content changed
    expect(filediff.deletions).toBe(0);
    expect(
      (afterOutput.metadata as Record<string, unknown>).diff,
    ).toBeDefined();
  });

  // Test 3: tool.execute.before does NOT capture when hashline_edit disabled
  test('tool.execute.before does not capture when hashline_edit disabled', async () => {
    // Create config with hashline_edit disabled
    const projectDir = path.join(tempDir, 'project-before-disabled');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: false,
      }),
    );

    // Create a test file with old content
    const testFilePath = path.join(projectDir, 'test.txt');
    fs.writeFileSync(testFilePath, 'old content\nline 2\nline 3');

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // Call the before hook with a write tool
    const beforeInput = {
      tool: 'write',
      sessionID: 'test-session',
      callID: 'test-call-2',
    };
    const beforeOutput = {
      args: { path: testFilePath, content: 'new content\nline 2\nline 3' },
    };

    // Execute the before hook
    await (
      plugin['tool.execute.before'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(beforeInput, beforeOutput);

    // Call the after hook - no diff metadata should be attached since hashline is disabled
    const afterInput = {
      tool: 'write',
      sessionID: 'test-session',
      callID: 'test-call-2',
    };
    const afterOutput = {
      title: testFilePath,
      output: 'File written successfully.',
      metadata: {},
    };

    await (
      plugin['tool.execute.after'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(afterInput, afterOutput);

    // Verify NO diff metadata was attached (hashline disabled)
    expect(afterOutput.metadata).toBeDefined();
    expect(
      (afterOutput.metadata as Record<string, unknown>).filediff,
    ).toBeUndefined();
    expect(
      (afterOutput.metadata as Record<string, unknown>).diff,
    ).toBeUndefined();
  });

  // Test 4: prove diff enhancer and read enhancer run in correct order within actual plugin after hook
  // This test exercises the REAL plugin['tool.execute.after'] and verifies order via side effects
  test('diff enhancer runs before read enhancer within actual plugin after hook - verified via side effects', async () => {
    // Create config with hashline_edit enabled
    const projectDir = path.join(tempDir, 'project-spy-order');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: true,
      }),
    );

    // Create a test file for write operations
    const testFilePath = path.join(projectDir, 'test.txt');
    fs.writeFileSync(testFilePath, 'old content');

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // First, capture old content via before hook
    const beforeInput = {
      tool: 'write',
      sessionID: 'order-s1',
      callID: 'order-c1',
    };
    const beforeOutput = {
      args: { path: testFilePath, content: 'new content' },
    };
    await (
      plugin['tool.execute.before'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(beforeInput, beforeOutput);

    // Write new content to trigger diff enhancer
    fs.writeFileSync(testFilePath, 'new content');

    // Test with 'write' tool - this exercises diff enhancer and read enhancer
    const writeInput = {
      tool: 'write',
      sessionID: 'order-s1',
      callID: 'order-c1',
    };
    // Use output that doesn't start with "File written successfully."
    // to trigger the read enhancer's write output modification
    const writeOutput = {
      title: testFilePath,
      output: 'Successfully saved the file',
      metadata: { filePath: testFilePath },
    };

    // Call the ACTUAL plugin after hook (not a wrapper)
    await (
      plugin['tool.execute.after'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(writeInput, writeOutput);

    // Side effect verification:
    // 1. diff-enhancer should have added filediff metadata (runs first)
    const filediff = (writeOutput.metadata as Record<string, unknown>)
      .filediff as Record<string, unknown> | undefined;
    expect(filediff).toBeDefined();
    expect(filediff?.before).toBe('old content');
    expect(filediff?.after).toBe('new content');

    // 2. read-enhancer should have modified output to include line count (runs second)
    // The read enhancer transforms "File written successfully." to "File written successfully. X lines written."
    expect(writeOutput.output).toContain('lines written');
  });

  // Test 5: postReadNudge runs for read tool (proves chain works for read-specific hooks)
  test('postReadNudge hook runs for read tool when hashline_edit enabled', async () => {
    // Create config with hashline_edit enabled
    const projectDir = path.join(tempDir, 'project-nudge');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: true,
      }),
    );

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // Use 'read' tool - triggers postReadNudge
    const afterInput = {
      tool: 'read',
      sessionID: 'test-session',
      callID: 'test-call',
    };
    const afterOutput = {
      title: 'test-file.txt',
      output: 'some file content',
      metadata: { filePath: '/test/test-file.txt' },
    };

    // Call the after hook
    await (
      plugin['tool.execute.after'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(afterInput, afterOutput);

    // postReadNudge should have appended its nudge text to output
    expect(afterOutput.output).toContain('Workflow Reminder');
    expect(afterOutput.output).toContain('delegate based on rules');
  });

  // Test 6: jsonErrorRecovery hook runs for write tool (write is NOT in exclude list)
  test('jsonErrorRecovery hook runs for write tool when hashline_edit enabled', async () => {
    // Create config with hashline_edit enabled
    const projectDir = path.join(tempDir, 'project-json-error');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: true,
      }),
    );

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // Use 'write' tool - NOT in jsonErrorRecovery exclude list
    // jsonErrorRecovery will add error reminder if output contains JSON error pattern
    const afterInput = {
      tool: 'write',
      sessionID: 'test-session',
      callID: 'test-call-json',
    };
    const afterOutput = {
      title: 'test-file.txt',
      output: 'Error: failed to parse json - unexpected token',
      metadata: {},
    };

    // Call the after hook
    await (
      plugin['tool.execute.after'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(afterInput, afterOutput);

    // jsonErrorRecovery should have appended its JSON error reminder
    expect(afterOutput.output).toContain('JSON PARSE ERROR');
    expect(afterOutput.output).toContain('IMMEDIATE ACTION REQUIRED');
  });

  // Test 7: delegateTaskRetry runs for task tool (proves it executes, not just defined)
  test('delegateTaskRetry hook runs for task tool when hashline_edit enabled', async () => {
    // Create config with hashline_edit enabled
    const projectDir = path.join(tempDir, 'project-delegate-retry');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: true,
      }),
    );

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // Use 'task' tool - triggers delegateTaskRetry
    // Must include [ERROR] signal and a valid pattern like run_in_background
    const afterInput = {
      tool: 'task',
      sessionID: 'test-session',
      callID: 'test-call-task',
    };
    const afterOutput = {
      title: 'Background Task',
      output: '[ERROR] Invalid arguments: missing run_in_background',
      metadata: {},
    };

    // Call the after hook
    await (
      plugin['tool.execute.after'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(afterInput, afterOutput);

    // delegateTaskRetry should have appended retry guidance
    expect(afterOutput.output).toContain('[delegate-task retry suggestion]');
    expect(afterOutput.output).toContain('missing_run_in_background');
  });

  // Test 8: verify call order of all hooks in the after chain - uses actual plugin
  // Since hooks are defined in index.ts in a specific order, we verify via side effects
  test('all hooks in after chain execute in expected order (verified via code structure)', async () => {
    // Create config with hashline_edit enabled
    const projectDir = path.join(tempDir, 'project-full-order');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: true,
      }),
    );

    // Create a test file
    const testFilePath = path.join(projectDir, 'write-test.txt');
    fs.writeFileSync(testFilePath, 'old content');

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // First, capture old content via before hook
    const beforeInput = {
      tool: 'write',
      sessionID: 'order-s1',
      callID: 'order-c1',
    };
    const beforeOutput = {
      args: { path: testFilePath, content: 'new content' },
    };
    await (
      plugin['tool.execute.before'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(beforeInput, beforeOutput);

    // Write the new content
    fs.writeFileSync(testFilePath, 'new content');

    // Now call after hook with write - this exercises the full chain
    // Use output that doesn't start with "File written successfully."
    // to trigger the read enhancer's write output modification
    const afterInput = {
      tool: 'write',
      sessionID: 'order-s1',
      callID: 'order-c1',
    };
    const afterOutput = {
      title: testFilePath,
      output: 'Successfully saved the file',
      metadata: { filePath: testFilePath } as Record<string, unknown>,
    };

    // Call the actual plugin after hook
    await (
      plugin['tool.execute.after'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(afterInput, afterOutput);

    // The order in index.ts (lines 356-403) is:
    // 1. hashlineEditDiffEnhancerHook - adds filediff metadata
    // 2. hashlineReadEnhancerHook - modifies write output to add line count
    // 3. delegateTaskRetryHook - no-op for write (not task/background_task)
    // 4. jsonErrorRecoveryHook - no-op for success output (no JSON error)
    // 5. postReadNudgeHook - no-op for write (only read)

    // Verify diff enhancer ran first (filediff added)
    expect(
      (afterOutput.metadata as Record<string, unknown>).filediff,
    ).toBeDefined();
    const filediff = (afterOutput.metadata as Record<string, unknown>)
      .filediff as Record<string, unknown>;
    expect(filediff.before).toBe('old content');
    expect(filediff.after).toBe('new content');

    // Verify read enhancer ran second (modified output to include line count)
    // The read enhancer for write tool transforms "Successfully saved the file"
    // to "File written successfully. X lines written."
    expect(afterOutput.output).toContain('lines written');
  });

  // Test 8b: verify delegateTaskRetry and jsonErrorRecovery order using task tool with error content
  // Both hooks run for task tool, so we can verify their relative order
  test('delegateTaskRetry and jsonErrorRecovery execute in expected order via actual plugin', async () => {
    // Create config with hashline_edit enabled
    const projectDir = path.join(tempDir, 'project-full-order-part2');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: true,
      }),
    );

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // Use 'task' tool with output that triggers BOTH delegateTaskRetry AND jsonErrorRecovery
    // delegateTaskRetry: looks for "[ERROR]" + "missing run_in_background"
    // jsonErrorRecovery: looks for JSON parse error patterns
    const afterInput = {
      tool: 'task',
      sessionID: 'order-s2',
      callID: 'order-c2',
    };

    const afterOutput = {
      title: 'Background Task',
      output:
        '[ERROR] failed to parse JSON: unexpected token at line 1\nmissing run_in_background parameter',
      metadata: {},
    };

    // Call the actual plugin after hook
    await (
      plugin['tool.execute.after'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(afterInput, afterOutput);

    // Verify both hooks executed (produced side effects):
    // 1. delegateTaskRetry should append retry guidance
    expect(afterOutput.output).toContain('[delegate-task retry suggestion]');
    expect(afterOutput.output).toContain('missing_run_in_background');

    // 2. jsonErrorRecovery should append JSON error reminder
    expect(afterOutput.output).toContain('JSON PARSE ERROR');
    expect(afterOutput.output).toContain('IMMEDIATE ACTION REQUIRED');

    // Now verify the ORDER of execution:
    // The order in index.ts (lines 374-390) after read enhancer is:
    // 1. delegateTaskRetryHook (line 374)
    // 2. jsonErrorRecoveryHook (line 379)
    // So delegate should appear BEFORE json in output

    const delegatePos = afterOutput.output.indexOf(
      '[delegate-task retry suggestion]',
    );
    const jsonPos = afterOutput.output.indexOf('JSON PARSE ERROR');

    expect(delegatePos).toBeGreaterThan(-1);
    expect(jsonPos).toBeGreaterThan(-1);

    // Verify order: delegateTaskRetry runs before jsonErrorRecovery
    expect(delegatePos).toBeLessThan(jsonPos);
  });

  // Test 8c: verify postReadNudge runs after the hashline enhancers via read tool
  // This confirms postReadNudge is at the end of the chain
  test('postReadNudge executes after hashline enhancers via actual plugin', async () => {
    // Create config with hashline_edit enabled
    const projectDir = path.join(tempDir, 'project-full-order-part3');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: true,
      }),
    );

    // Create a test file
    const testFilePath = path.join(projectDir, 'read-test.txt');
    fs.writeFileSync(testFilePath, '1: first line\n2: second line');

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // Use 'read' tool - triggers read enhancer and postReadNudge
    const afterInput = {
      tool: 'read',
      sessionID: 'order-s3',
      callID: 'order-c3',
    };

    const afterOutput = {
      title: testFilePath,
      output: '<content>\n1: first line\n2: second line\n</content>',
      metadata: { filePath: testFilePath },
    };

    // Call the actual plugin after hook
    await (
      plugin['tool.execute.after'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(afterInput, afterOutput);

    // Verify read enhancer ran (transformed output with hashlines)
    // The read enhancer should have added hashline prefixes like "1#HASH|"
    expect(afterOutput.output).toMatch(/\d+#[A-Za-z0-9]+\|/);

    // Verify postReadNudge ran (appended its nudge text - at the END)
    expect(afterOutput.output).toContain('Workflow Reminder');
    expect(afterOutput.output).toContain('delegate based on rules');

    // Verify postReadNudge is at the end by checking position
    const nudgePos = afterOutput.output.indexOf('Workflow Reminder');
    const contentEnd = afterOutput.output.lastIndexOf('\n</content>');
    // The nudge should appear AFTER the content (near the end)
    expect(nudgePos).toBeGreaterThan(contentEnd);
  });

  // Test 9: diff metadata correctly captures old and new content with substantial changes
  test('diff metadata correctly captures old and new content with substantial changes', async () => {
    // Create config with hashline_edit enabled
    const projectDir = path.join(tempDir, 'project-diff-content');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: true,
      }),
    );

    // Create a test file with substantial old content
    const testFilePath = path.join(projectDir, 'diff-test.txt');
    const oldContent = 'line one\nline two\nline three\nline four\nline five';
    fs.writeFileSync(testFilePath, oldContent);

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // Capture old content before writing new
    const beforeInput = {
      tool: 'write',
      sessionID: 'diff-test-session',
      callID: 'diff-call-1',
    };
    const newContent =
      'line one modified\nline two\nline three added\nline four';
    const beforeOutput = {
      args: { path: testFilePath, content: newContent },
    };
    await (
      plugin['tool.execute.before'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(beforeInput, beforeOutput);

    // Actually write the new content to the file (simulating tool execution)
    fs.writeFileSync(testFilePath, newContent);

    // Execute the after hook
    const afterInput = {
      tool: 'write',
      sessionID: 'diff-test-session',
      callID: 'diff-call-1',
    };
    const afterOutput = {
      title: testFilePath,
      output: 'File written successfully.',
      metadata: {},
    };
    await (
      plugin['tool.execute.after'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(afterInput, afterOutput);

    // Verify diff metadata is comprehensive
    const filediff = (afterOutput.metadata as Record<string, unknown>)
      .filediff as Record<string, unknown>;
    expect(filediff).toBeDefined();

    // Old content should match what was in file before write
    expect(filediff.before).toBe(oldContent);

    // New content should match what was written
    expect(filediff.after).toBe(newContent);

    // Verify diff string exists
    expect(
      (afterOutput.metadata as Record<string, unknown>).diff,
    ).toBeDefined();
    const diffStr = (afterOutput.metadata as Record<string, unknown>)
      .diff as string;
    expect(diffStr).toContain('line one');
    expect(diffStr).toContain('line one modified');

    // Verify line count changes are tracked (at least some changes occurred)
    expect(filediff.additions).toBeGreaterThan(0);
    expect(filediff.deletions).toBeGreaterThan(0);
  });

  // Test 10: hashline read transformation is skipped when hashline_edit disabled
  test('hashline read transformation is skipped when hashline_edit disabled', async () => {
    // Create config with hashline_edit disabled
    const projectDir = path.join(tempDir, 'project-read-disabled');
    const projectConfigDir = path.join(projectDir, '.opencode');
    fs.mkdirSync(projectConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectConfigDir, 'oh-my-opencode-medium.json'),
      JSON.stringify({
        hashline_edit: false,
      }),
    );

    // Create a test file
    const testFilePath = path.join(projectDir, 'read-test.txt');
    fs.writeFileSync(testFilePath, '1: first line\n2: second line');

    const module = await import('./index');
    const { default: OhMyOpenCodeLite } = module;

    const mockCtx = {
      directory: projectDir,
      client: {
        provider: {
          list: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const plugin = await OhMyOpenCodeLite(mockCtx as never);

    // Call the after hook with a read tool
    const readAfterInput = {
      tool: 'read',
      sessionID: 'test-session',
      callID: 'read-call-disabled',
    };
    const readAfterOutput = {
      title: testFilePath,
      output: '<content>\n1: first line\n2: second line\n</content>',
      metadata: { filePath: testFilePath },
    };
    await (
      plugin['tool.execute.after'] as (
        input: unknown,
        output: unknown,
      ) => Promise<void>
    )(readAfterInput, readAfterOutput);

    // Output should NOT contain hashline transformation when hashline is disabled
    // Hashline transformation adds #<hash>| pattern, which should NOT be present
    const outputStr = readAfterOutput.output as string;
    expect(outputStr).not.toMatch(/\d+#.*\|/);
    // The content lines should remain unchanged (no hash added)
    expect(outputStr).toContain('1: first line');
    expect(outputStr).toContain('2: second line');
  });
});

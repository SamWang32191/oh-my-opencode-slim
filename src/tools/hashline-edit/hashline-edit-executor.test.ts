import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolContext } from '@opencode-ai/plugin/tool';
import { computeLineHash } from './hash-computation';
import { executeHashlineEditTool } from './hashline-edit-executor';

let testCounter = 0;

function createTestDir(): string {
  testCounter += 1;
  return `/tmp/hashline-edit-test-${testCounter}-${Date.now()}`;
}

function createMockContext(dir: string): ToolContext {
  return {
    sessionID: 'test-session',
    workingDirectory: dir,
  } as ToolContext;
}

function _createMockContextWithMetadata(dir: string): ToolContext & {
  metadata: (value: unknown) => void;
} {
  let capturedMetadata: unknown;
  return {
    sessionID: 'test-session',
    workingDirectory: dir,
    metadata: (value: unknown) => {
      capturedMetadata = value;
    },
    getMetadata: () => capturedMetadata,
  } as ToolContext & {
    metadata: (value: unknown) => void;
    getMetadata: () => unknown;
  };
}

function computeHash(lineNumber: number, content: string): string {
  return computeLineHash(lineNumber, content.trimEnd());
}

describe('hashline-edit-executor', () => {
  const testDirs: string[] = [];

  afterEach(() => {
    // Clean up all test directories
    for (const dir of testDirs) {
      if (existsSync(dir)) {
        try {
          const files = [
            'test.txt',
            'renamed.txt',
            'newfile.txt',
            'newfile2.txt',
            'nonexistent.txt',
          ];
          for (const file of files) {
            const path = join(dir, file);
            if (existsSync(path)) {
              unlinkSync(path);
            }
          }
          rmdirSync(dir);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
    testDirs.length = 0;
  });

  test('rejects bad delete / rename combinations', async () => {
    const testDir = createTestDir();
    testDirs.push(testDir);
    mkdirSync(testDir, { recursive: true });
    const filePath = join(testDir, 'test.txt');
    await Bun.write(filePath, 'content');

    const result = await executeHashlineEditTool(
      { filePath, delete: true, rename: 'renamed.txt', edits: [] },
      createMockContext(testDir),
    );

    expect(result).toBe('Error: delete and rename cannot be used together');
  });

  test('rejects edits=[] in normal mode', async () => {
    const testDir = createTestDir();
    testDirs.push(testDir);
    mkdirSync(testDir, { recursive: true });
    const filePath = join(testDir, 'test.txt');
    await Bun.write(filePath, 'content');

    const result = await executeHashlineEditTool(
      { filePath, edits: [] },
      createMockContext(testDir),
    );

    expect(result).toBe('Error: edits parameter must be a non-empty array');
  });

  test('delete=true with edits=[] deletes the file and returns expected success string', async () => {
    const testDir = createTestDir();
    testDirs.push(testDir);
    mkdirSync(testDir, { recursive: true });
    const filePath = join(testDir, 'test.txt');
    await Bun.write(filePath, 'some content');

    const result = await executeHashlineEditTool(
      { filePath, delete: true, edits: [] },
      createMockContext(testDir),
    );

    expect(result).toBe(`Successfully deleted ${filePath}`);
    expect(await Bun.file(filePath).exists()).toBe(false);
  });

  test('missing file failure for anchored edits', async () => {
    const testDir = createTestDir();
    testDirs.push(testDir);
    mkdirSync(testDir, { recursive: true });
    const filePath = join(testDir, 'nonexistent.txt');
    const hash = computeHash(1, '');

    const result = await executeHashlineEditTool(
      {
        filePath,
        edits: [{ op: 'replace', pos: `1#${hash}`, lines: ['new content'] }],
      },
      createMockContext(testDir),
    );

    expect(result).toBe(`Error: File not found: ${filePath}`);
  });

  test('missing file creation for unanchored append', async () => {
    const testDir = createTestDir();
    testDirs.push(testDir);
    mkdirSync(testDir, { recursive: true });
    const filePath = join(testDir, 'newfile.txt');
    if (await Bun.file(filePath).exists()) unlinkSync(filePath);

    const result = await executeHashlineEditTool(
      {
        filePath,
        edits: [{ op: 'append', lines: ['new content'] }],
      },
      createMockContext(testDir),
    );

    expect(result).toBe(`Updated ${filePath}`);
    expect(await Bun.file(filePath).exists()).toBe(true);
    expect(await Bun.file(filePath).text()).toBe('new content');
  });

  test('missing file creation for unanchored prepend', async () => {
    const testDir = createTestDir();
    testDirs.push(testDir);
    mkdirSync(testDir, { recursive: true });
    const filePath = join(testDir, 'newfile2.txt');
    if (await Bun.file(filePath).exists()) unlinkSync(filePath);

    const result = await executeHashlineEditTool(
      {
        filePath,
        edits: [{ op: 'prepend', lines: ['first line'] }],
      },
      createMockContext(testDir),
    );

    expect(result).toBe(`Updated ${filePath}`);
    expect(await Bun.file(filePath).exists()).toBe(true);
    expect(await Bun.file(filePath).text()).toBe('first line');
  });

  test('successful update returns Updated <path>', async () => {
    const testDir = createTestDir();
    testDirs.push(testDir);
    mkdirSync(testDir, { recursive: true });
    const filePath = join(testDir, 'test.txt');
    const content = 'line1\nline2\nline3';
    await Bun.write(filePath, content);
    const hash = computeHash(2, 'line2');

    const result = await executeHashlineEditTool(
      {
        filePath,
        edits: [{ op: 'replace', pos: `2#${hash}`, lines: ['new line2'] }],
      },
      createMockContext(testDir),
    );

    expect(result).toBe(`Updated ${filePath}`);
  });

  test('successful rename returns Moved <old> to <new>', async () => {
    const testDir = createTestDir();
    testDirs.push(testDir);
    mkdirSync(testDir, { recursive: true });
    const filePath = join(testDir, 'test.txt');
    const newPath = join(testDir, 'renamed.txt');
    await Bun.write(filePath, 'content');
    const hash = computeHash(1, 'content');

    const result = await executeHashlineEditTool(
      {
        filePath,
        rename: newPath,
        edits: [{ op: 'replace', pos: `1#${hash}`, lines: ['updated'] }],
      },
      createMockContext(testDir),
    );

    expect(result).toBe(`Moved ${filePath} to ${newPath}`);
    expect(await Bun.file(newPath).exists()).toBe(true);
    expect(await Bun.file(filePath).exists()).toBe(false);
  });

  test('no-op edit returns an error string', async () => {
    const testDir = createTestDir();
    testDirs.push(testDir);
    mkdirSync(testDir, { recursive: true });
    const filePath = join(testDir, 'test.txt');
    const content = 'same content';
    await Bun.write(filePath, content);
    const hash = computeHash(1, content);

    const result = await executeHashlineEditTool(
      {
        filePath,
        edits: [{ op: 'replace', pos: `1#${hash}`, lines: ['same content'] }],
      },
      createMockContext(testDir),
    );

    expect(result).toContain('Error:');
    expect(result).toContain('No changes made');
  });

  test('successful edit emits metadata with required fields', async () => {
    const testDir = createTestDir();
    testDirs.push(testDir);
    mkdirSync(testDir, { recursive: true });
    const filePath = join(testDir, 'test.txt');
    const content = 'line1\nline2\nline3';
    await Bun.write(filePath, content);
    const hash = computeHash(2, 'line2');

    // Create context with metadata capture
    const metaValues: unknown[] = [];
    const contextWithMeta = {
      sessionID: 'test-session',
      workingDirectory: testDir,
      metadata: (value: unknown) => {
        metaValues.push(value);
      },
    } as ToolContext;

    const result = await executeHashlineEditTool(
      {
        filePath,
        edits: [{ op: 'replace', pos: `2#${hash}`, lines: ['new line2'] }],
      },
      contextWithMeta,
    );

    expect(result).toBe(`Updated ${filePath}`);
    expect(metaValues).toHaveLength(1);

    const meta = metaValues[0] as {
      title: string;
      metadata: {
        filePath: string;
        path: string;
        file: string;
        diff: string;
        noopEdits: number;
        deduplicatedEdits: number;
        firstChangedLine: number;
        filediff: {
          file: string;
          path: string;
          filePath: string;
          before: string;
          after: string;
          additions: number;
          deletions: number;
        };
      };
    };

    // Verify all required metadata fields are present
    expect(meta.metadata.filePath).toBe(filePath);
    expect(meta.metadata.path).toBe(filePath);
    expect(meta.metadata.file).toBe(filePath);
    expect(meta.metadata.diff).toBeDefined();
    expect(typeof meta.metadata.diff).toBe('string');
    expect(meta.metadata.filediff.before).toBe(content);
    expect(meta.metadata.filediff.after).toBeDefined();
    expect(typeof meta.metadata.filediff.after).toBe('string');
    expect(meta.metadata.filediff.additions).toBeDefined();
    expect(typeof meta.metadata.filediff.additions).toBe('number');
    expect(meta.metadata.filediff.deletions).toBeDefined();
    expect(typeof meta.metadata.filediff.deletions).toBe('number');
    expect(meta.metadata.firstChangedLine).toBe(2);
    expect(meta.metadata.noopEdits).toBe(0);
    expect(meta.metadata.deduplicatedEdits).toBe(0);
  });
});

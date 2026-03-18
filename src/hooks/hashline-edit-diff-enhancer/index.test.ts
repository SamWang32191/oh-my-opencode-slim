import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { createHashlineEditDiffEnhancerHook } from './index';

describe('hashline-edit-diff-enhancer', () => {
  const _baseInput = {
    tool: 'write',
    sessionID: 'test-session',
    callID: 'test-call',
  };

  const testFilePath = '/tmp/hashline-edit-test-file.txt';

  beforeEach(async () => {
    // Create a test file with initial content
    await Bun.write(testFilePath, 'line 1\nline 2\nline 3');
  });

  afterEach(async () => {
    // Cleanup test file
    await Bun.file(testFilePath)
      .delete()
      .catch(() => {});
    // Also clean up any other temp files from tests
    await Bun.file('/tmp/nonexistent-test-file.txt')
      .delete()
      .catch(() => {});
  });

  describe('captures old content in tool.execute.before', () => {
    it('captures old content when write tool is called', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-1',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'new line 1\nnew line 2' },
      };

      // Call before hook to capture content
      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      // Now write new content
      await Bun.write(testFilePath, 'new line 1\nnew line 2');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-1',
      };
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // Call after hook - should have access to captured content
      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Verify diff metadata is attached
      expect(afterOutput.metadata.diff).toBeDefined();
      expect(afterOutput.metadata.filediff).toBeDefined();
    });
  });

  describe('attaches metadata.diff and metadata.filediff in tool.execute.after', () => {
    it('attaches diff string to metadata.diff', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      // First call before hook to capture old content
      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-2',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'modified content' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      // Modify the file
      await Bun.write(testFilePath, 'modified content');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-2',
      };
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Verify metadata.diff is a string (unified diff format)
      expect(typeof afterOutput.metadata.diff).toBe('string');
      expect(afterOutput.metadata.diff).toContain('---');
      expect(afterOutput.metadata.diff).toContain('+++');
    });

    it('attaches filediff object to metadata.filediff', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      // First call before hook
      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-3',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'new content here' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      // Modify the file
      await Bun.write(testFilePath, 'new content here');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-3',
      };
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Verify metadata.filediff is an object with expected properties
      const filediff = afterOutput.metadata.filediff as Record<string, unknown>;
      expect(filediff).toBeDefined();
      expect(filediff.file).toBe(testFilePath);
      expect(filediff.path).toBe(testFilePath);
      expect(filediff.before).toBe('line 1\nline 2\nline 3');
      expect(filediff.after).toBe('new content here');
      expect(typeof filediff.additions).toBe('number');
      expect(typeof filediff.deletions).toBe('number');
    });
  });

  describe('sets output.title to the file path', () => {
    it('sets title to the file path after write', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      // First call before hook
      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-4',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'another update' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      // Modify the file
      await Bun.write(testFilePath, 'another update');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-4',
      };
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Verify title is set to file path
      expect(afterOutput.title).toBe(testFilePath);
    });
  });

  describe('skips processing when disabled', () => {
    it('does not capture content when hashline_edit is disabled', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: false },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-5',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'new content' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      // Modify the file
      await Bun.write(testFilePath, 'new content');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-5',
      };
      const afterOutput = {
        title: 'original-title',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Verify no metadata was added and title was not changed
      expect(afterOutput.metadata.diff).toBeUndefined();
      expect(afterOutput.metadata.filediff).toBeUndefined();
      expect(afterOutput.title).toBe('original-title');
    });

    it('does not process when hashline_edit config is undefined', async () => {
      const hook = createHashlineEditDiffEnhancerHook({});

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-6',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'new content' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      await Bun.write(testFilePath, 'new content');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-6',
      };
      const afterOutput = {
        title: 'original-title',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      expect(afterOutput.metadata.diff).toBeUndefined();
      expect(afterOutput.metadata.filediff).toBeUndefined();
      expect(afterOutput.title).toBe('original-title');
    });
  });

  describe('failed write outputs', () => {
    it('does not attach diff metadata for failed write output', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-failed-write',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'new line 1\nnew line 2' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-failed-write',
      };
      const afterOutput = {
        title: 'original-title',
        output: 'Error: write failed',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      expect(afterOutput.metadata.diff).toBeUndefined();
      expect(afterOutput.metadata.filediff).toBeUndefined();
      expect(afterOutput.filePath).toBeUndefined();
      expect(afterOutput.path).toBeUndefined();
      expect(afterOutput.file).toBeUndefined();
      expect(afterOutput.title).toBe('original-title');
    });
  });

  describe('skips non-write tools', () => {
    it('does not process read tool', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'read',
        sessionID: 'test-session',
        callID: 'test-call-7',
      };
      const beforeOutput = {
        args: { path: testFilePath },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      const afterInput = {
        tool: 'read',
        sessionID: 'test-session',
        callID: 'test-call-7',
      };
      const afterOutput = {
        title: 'original-title',
        output: 'file content',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Verify no changes were made
      expect(afterOutput.metadata.diff).toBeUndefined();
      expect(afterOutput.metadata.filediff).toBeUndefined();
      expect(afterOutput.title).toBe('original-title');
    });

    it('does not process edit tool', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'edit',
        sessionID: 'test-session',
        callID: 'test-call-8',
      };
      const beforeOutput = {
        args: { path: testFilePath },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      const afterInput = {
        tool: 'edit',
        sessionID: 'test-session',
        callID: 'test-call-8',
      };
      const afterOutput = {
        title: 'original-title',
        output: 'File edited successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      expect(afterOutput.metadata.diff).toBeUndefined();
      expect(afterOutput.metadata.filediff).toBeUndefined();
      expect(afterOutput.title).toBe('original-title');
    });
  });

  describe('handles file path extraction', () => {
    it('extracts path from args.path', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-9',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'test' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      await Bun.write(testFilePath, 'test');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-9',
      };
      const afterOutput = {
        title: '',
        output: '',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      expect(afterOutput.title).toBe(testFilePath);
    });

    it('extracts path from args.filePath', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-10',
      };
      const beforeOutput = {
        args: { filePath: testFilePath, content: 'test' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      await Bun.write(testFilePath, 'test');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-10',
      };
      const afterOutput = {
        title: '',
        output: '',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      expect(afterOutput.title).toBe(testFilePath);
    });

    it('extracts path from args.file_path', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-11',
      };
      const beforeOutput = {
        args: { file_path: testFilePath, content: 'test' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      await Bun.write(testFilePath, 'test');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-11',
      };
      const afterOutput = {
        title: '',
        output: '',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      expect(afterOutput.title).toBe(testFilePath);
    });

    it('handles missing file path gracefully', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-12',
      };
      const beforeOutput = {
        args: { content: 'test' }, // No path
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      // No file written since no path

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-12',
      };
      const afterOutput = {
        title: 'original-title',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Should not crash and should not modify output
      expect(afterOutput.title).toBe('original-title');
      expect(afterOutput.metadata.diff).toBeUndefined();
    });
  });

  describe('handles non-existent files', () => {
    it('handles writing to a new file', async () => {
      const newFilePath = '/tmp/new-test-file-12345.txt';

      // Ensure it doesn't exist
      await Bun.file(newFilePath)
        .delete()
        .catch(() => {});

      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-13',
      };
      const beforeOutput = {
        args: { path: newFilePath, content: 'brand new content' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      // Write new file
      await Bun.write(newFilePath, 'brand new content');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-13',
      };
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Should work with empty old content
      expect(afterOutput.title).toBe(newFilePath);
      expect(afterOutput.metadata.filediff).toBeDefined();
      const filediff = afterOutput.metadata.filediff as Record<string, unknown>;
      expect(filediff.before).toBe('');
      expect(filediff.after).toBe('brand new content');

      // Cleanup
      await Bun.file(newFilePath)
        .delete()
        .catch(() => {});
    });
  });

  // Issue 1: Metadata surface should match hashline-edit executor contract
  describe('metadata surface matches executor contract', () => {
    it('sets top-level filePath field', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-1',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'updated content' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      await Bun.write(testFilePath, 'updated content');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-1',
      };
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Should match executor contract: top-level filePath
      expect(afterOutput.filePath).toBe(testFilePath);
    });

    it('sets top-level path field', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-2',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'updated content' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      await Bun.write(testFilePath, 'updated content');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-2',
      };
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Should match executor contract: top-level path
      expect(afterOutput.path).toBe(testFilePath);
    });

    it('sets top-level file field', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-3',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'updated content' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      await Bun.write(testFilePath, 'updated content');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-3',
      };
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Should match executor contract: top-level file
      expect(afterOutput.file).toBe(testFilePath);
    });

    it('sets metadata.filediff.filePath field', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-4',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'updated content' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      await Bun.write(testFilePath, 'updated content');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-4',
      };
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
        metadata: {} as Record<string, unknown>,
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Should match executor contract: metadata.filediff.filePath
      const filediff = afterOutput.metadata.filediff as Record<string, unknown>;
      expect(filediff.filePath).toBe(testFilePath);
    });
  });

  // Issue 2: Handle missing output.metadata safely
  describe('handles missing output.metadata', () => {
    it('handles undefined metadata', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-undef',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'updated content' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      await Bun.write(testFilePath, 'updated content');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-undef',
      };
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
        metadata: undefined,
      } as unknown as AfterOutput;

      // Should not throw when metadata is undefined
      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Should have initialized metadata and added diff fields
      expect(afterOutput.metadata).toBeDefined();
      expect(afterOutput.metadata.diff).toBeDefined();
      expect(afterOutput.metadata.filediff).toBeDefined();
    });

    it('handles null metadata', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-null',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'updated content' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      await Bun.write(testFilePath, 'updated content');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-null',
      };
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
        metadata: null,
      } as unknown as AfterOutput;

      // Should not throw when metadata is null
      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Should have initialized metadata and added diff fields
      expect(afterOutput.metadata).toBeDefined();
      expect(afterOutput.metadata.diff).toBeDefined();
      expect(afterOutput.metadata.filediff).toBeDefined();
    });

    it('handles missing metadata property entirely', async () => {
      const hook = createHashlineEditDiffEnhancerHook({
        hashline_edit: { enabled: true },
      });

      const beforeInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-missing',
      };
      const beforeOutput = {
        args: { path: testFilePath, content: 'updated content' },
      };

      // @ts-expect-error - accessing the before hook
      await hook['tool.execute.before'](beforeInput, beforeOutput);

      await Bun.write(testFilePath, 'updated content');

      const afterInput = {
        tool: 'write',
        sessionID: 'test-session',
        callID: 'test-call-metadata-missing',
      };
      // Create output without metadata property at all
      const afterOutput = {
        title: '',
        output: 'File written successfully.',
      } as unknown as AfterOutput;

      // Should not throw when metadata is missing entirely
      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](afterInput, afterOutput);

      // Should have initialized metadata and added diff fields
      expect(afterOutput.metadata).toBeDefined();
      expect(afterOutput.metadata.diff).toBeDefined();
      expect(afterOutput.metadata.filediff).toBeDefined();
    });
  });
});

type AfterOutput = {
  title: string;
  output: string;
  metadata?: Record<string, unknown>;
};

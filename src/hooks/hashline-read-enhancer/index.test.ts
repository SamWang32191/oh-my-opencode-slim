import { describe, expect, it } from 'bun:test';
import { createHashlineReadEnhancerHook } from './index';

describe('hashline-read-enhancer', () => {
  const baseInput = {
    tool: 'read',
    sessionID: 'test-session',
    callID: 'test-call',
  };

  describe('transforms plain numbered output', () => {
    it('transforms colon-numbered output like "1: foo"', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const output = {
        title: 'test.txt',
        output: '1: const x = 1;',
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      // Should transform to LINE#HASH|content format
      expect(output.output).toMatch(/^1#[A-Z]{2}\|const x = 1;$/);
    });

    it('transforms pipe-numbered output like "1| foo"', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const output = {
        title: 'test.txt',
        output: '1| const y = 2;',
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      // Should transform to LINE#HASH|content format
      expect(output.output).toMatch(/^1#[A-Z]{2}\|const y = 2;$/);
    });

    it('transforms multiple lines', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const output = {
        title: 'test.txt',
        output: '1: line one\n2: line two\n3: line three',
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      const lines = output.output.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^1#[A-Z]{2}\|line one$/);
      expect(lines[1]).toMatch(/^2#[A-Z]{2}\|line two$/);
      expect(lines[2]).toMatch(/^3#[A-Z]{2}\|line three$/);
    });
  });

  describe('transforms wrapped output', () => {
    it('transforms <content> wrapped output', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const output = {
        title: 'test.txt',
        output: '<content>\n1: first line\n2: second line\n</content>',
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      expect(output.output).toContain('1#');
      expect(output.output).toContain('first line');
      expect(output.output).toContain('2#');
      expect(output.output).toContain('second line');
    });

    it('transforms <file> wrapped output', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const output = {
        title: 'test.txt',
        output: '<file>\n1: hello world\n2: goodbye world\n</file>',
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      expect(output.output).toContain('1#');
      expect(output.output).toContain('hello world');
      expect(output.output).toContain('2#');
      expect(output.output).toContain('goodbye world');
    });

    it('handles inline content in opening tag', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      // Source code requires closing tag on its own line for block detection
      // This format: <content> on one line, then content, then </content> on its own line
      const output = {
        title: 'test.txt',
        output: '<content>\n1: inline first line\n2: second\n</content>',
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      expect(output.output).toContain('1#');
      expect(output.output).toContain('2#');
    });

    it('handles true inline-tag path with content on same line as opening tag', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      // True inline: <content>first line</content> all on one line (or opening tag has inline content)
      // This tests the case where openLine.startsWith(openTag) && openLine !== openTag
      const output = {
        title: 'test.txt',
        output:
          '<content>1: inline content on same line\n2: second line\n</content>',
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      // Should transform both lines
      expect(output.output).toMatch(/1#.*inline content on same line/);
      expect(output.output).toMatch(/2#.*second line/);
    });
  });

  describe('skips non-text output', () => {
    it('skips binary-looking output', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const originalOutput = '\x00\x01\x02 binary data here';
      const output = {
        title: 'test.bin',
        output: originalOutput,
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      expect(output.output).toBe(originalOutput);
    });

    it('skips empty output', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const output = { title: 'test.txt', output: '', metadata: {} };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      expect(output.output).toBe('');
    });
  });

  describe('skips truncation markers', () => {
    it('skips lines ending with truncation marker', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const output = {
        title: 'test.txt',
        output:
          '1: some very long line content here... (line truncated to 2000 chars)',
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      // Should NOT transform - should remain unchanged
      expect(output.output).toBe(
        '1: some very long line content here... (line truncated to 2000 chars)',
      );
    });
  });

  describe('remains inert when disabled', () => {
    it('does not transform when hashline_edit is disabled', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: false },
      });
      const originalOutput = '1: const x = 1;';
      const output = {
        title: 'test.txt',
        output: originalOutput,
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      expect(output.output).toBe(originalOutput);
    });

    it('does not transform when hashline_edit config is undefined', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {});
      const originalOutput = '1: const x = 1;';
      const output = {
        title: 'test.txt',
        output: originalOutput,
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      expect(output.output).toBe(originalOutput);
    });
  });

  describe('ignores non-read tools', () => {
    it('does not transform write tool output', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const writeInput = { ...baseInput, tool: 'write' };
      const originalOutput = 'File written successfully. 10 lines written.';
      const output = {
        title: 'test.txt',
        output: originalOutput,
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](writeInput, output);

      expect(output.output).toBe(originalOutput);
    });

    it('append hashline info for write tool with valid metadata', async () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const writeInput = { ...baseInput, tool: 'write' };
      const output = {
        title: 'test.txt',
        output: 'Some content written',
        metadata: { filepath: '/tmp/test-write-output.txt' },
      };

      // Create a temp file for the test
      await Bun.write('/tmp/test-write-output.txt', 'line 1\nline 2\nline 3');

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](writeInput, output);

      // Should replace with hashline info with line count (matching source behavior)
      expect(output.output).toBe('File written successfully. 3 lines written.');

      // Cleanup
      await Bun.file('/tmp/test-write-output.txt').delete();
    });

    it('enhances standard write success output with line count', async () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const writeInput = { ...baseInput, tool: 'write' };
      const output = {
        title: 'test.txt',
        output: 'File written successfully.',
        metadata: { filepath: '/tmp/test-standard-write-success.txt' },
      };

      await Bun.write('/tmp/test-standard-write-success.txt', 'line 1\nline 2');

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](writeInput, output);

      expect(output.output).toBe('File written successfully. 2 lines written.');

      await Bun.file('/tmp/test-standard-write-success.txt').delete();
    });

    it('does not modify write output if file does not exist', async () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const writeInput = { ...baseInput, tool: 'write' };
      const originalOutput = 'Some content written';
      const output = {
        title: 'test.txt',
        output: originalOutput,
        metadata: { filepath: '/tmp/nonexistent-file-12345.txt' },
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](writeInput, output);

      expect(output.output).toBe(originalOutput);
    });

    it('does not modify write output if metadata has no filepath', async () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const writeInput = { ...baseInput, tool: 'write' };
      const originalOutput = 'Some content written';
      const output = {
        title: 'test.txt',
        output: originalOutput,
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](writeInput, output);

      expect(output.output).toBe(originalOutput);
    });

    it('extracts filepath from various metadata keys', async () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });

      for (const key of ['filepath', 'filePath', 'path', 'file']) {
        await Bun.write('/tmp/test-metadata-key.txt', 'a\nb\nc\nd\n');

        const writeInput = { ...baseInput, tool: 'write' };
        const output = {
          title: 'test.txt',
          output: 'Written',
          metadata: { [key]: '/tmp/test-metadata-key.txt' },
        };

        // @ts-expect-error - accessing the after hook
        await hook['tool.execute.after'](writeInput, output);

        expect(output.output).toMatch(/5 lines written/);

        await Bun.file('/tmp/test-metadata-key.txt').delete();
      }
    });

    it('does not modify write output starting with error', async () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const writeInput = { ...baseInput, tool: 'write' };
      const errorOutput = 'Error: failed to write file';
      const output = {
        title: 'test.txt',
        output: errorOutput,
        metadata: { filepath: '/tmp/somefile.txt' },
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](writeInput, output);

      expect(output.output).toBe(errorOutput);
    });

    it('does not modify write output containing failed', async () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const writeInput = { ...baseInput, tool: 'write' };
      const errorOutput = 'Write operation failed: permission denied';
      const output = {
        title: 'test.txt',
        output: errorOutput,
        metadata: { filepath: '/tmp/somefile.txt' },
      };

      // @ts-expect-error - accessing the after hook
      await hook['tool.execute.after'](writeInput, output);

      expect(output.output).toBe(errorOutput);
    });
  });

  describe('handles non-string output', () => {
    it('does not crash on non-string output', () => {
      const hook = createHashlineReadEnhancerHook({} as never, {
        hashline_edit: { enabled: true },
      });
      const output = {
        title: 'test.txt',
        output: { data: 'object' },
        metadata: {},
      };

      // @ts-expect-error - accessing the after hook
      hook['tool.execute.after'](baseInput, output);

      // Should not crash and output should remain unchanged
      expect(output.output).toEqual({ data: 'object' });
    });
  });
});

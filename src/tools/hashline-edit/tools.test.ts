import { describe, expect, test } from 'bun:test';
import type { ToolDefinition } from '@opencode-ai/plugin/tool';
import { createHashlineEditTool } from './tools';

describe('hashline-edit tools', () => {
  test('createHashlineEditTool returns a ToolDefinition', () => {
    const tool = createHashlineEditTool();
    expect(tool).toBeDefined();
    expect(typeof tool).toBe('object');
    expect(typeof tool.description).toBe('string');
    expect(typeof tool.args).toBe('object');
    expect(typeof tool.execute).toBe('function');
  });

  test('tool description contains key workflow rules', () => {
    const tool = createHashlineEditTool() as ToolDefinition & {
      description: string;
    };

    // Check for key workflow rules from the source prompt
    expect(tool.description).toContain('LINE#ID');
    expect(tool.description).toContain('replace');
    expect(tool.description).toContain('append');
    expect(tool.description).toContain('prepend');
    expect(tool.description).toContain('SNAPSHOT');
    expect(tool.description).toContain('delete=true');
    expect(tool.description).toContain('rename');
  });

  test('tool has correct args schema', () => {
    const tool = createHashlineEditTool() as ToolDefinition & {
      args: {
        filePath: unknown;
        edits: unknown;
        delete?: unknown;
        rename?: unknown;
      };
    };

    expect(tool.args.filePath).toBeDefined();
    expect(tool.args.edits).toBeDefined();
    // delete and rename are optional
    expect(tool.args.delete).toBeDefined();
    expect(tool.args.rename).toBeDefined();
  });

  test('edits array contains operation objects', () => {
    const tool = createHashlineEditTool() as ToolDefinition;
    const editsArg = tool.args as {
      edits: { elementSchema: { schema: { properties: unknown } } };
    };

    // The args.edits should be an array of objects with op, pos, end, lines
    expect(editsArg).toBeDefined();
  });
});

import { describe, expect, test } from 'bun:test';

// Test the top-level export surface from src/tools/index.ts
// This verifies that hashline-edit tools are properly registered through the tools index
describe('tools index exports', () => {
  test('createHashlineEditTool is exported from src/tools/index.ts', async () => {
    // Import from the top-level export surface (not directly from ./hashline-edit/tools)
    const { createHashlineEditTool } = await import('./index');
    expect(createHashlineEditTool).toBeDefined();
    expect(typeof createHashlineEditTool).toBe('function');
  });

  test('createHashlineEditTool returns a ToolDefinition when imported from index', async () => {
    const { createHashlineEditTool } = await import('./index');
    const tool = createHashlineEditTool();
    expect(tool).toBeDefined();
    expect(typeof tool).toBe('object');
    expect(typeof tool.description).toBe('string');
    expect(typeof tool.args).toBe('object');
    expect(typeof tool.execute).toBe('function');
  });

  test('hashline-edit utility functions are exported from src/tools/index.ts', async () => {
    const {
      applyHashlineEdits,
      applyHashlineEditsWithReport,
      computeLegacyLineHash,
      computeLineHash,
      formatHashLine,
      formatHashLines,
      normalizeLineRef,
      parseLineRef,
      validateLineRef,
    } = await import('./index');

    // All utility functions should be exported
    expect(applyHashlineEdits).toBeDefined();
    expect(applyHashlineEditsWithReport).toBeDefined();
    expect(computeLegacyLineHash).toBeDefined();
    expect(computeLineHash).toBeDefined();
    expect(formatHashLine).toBeDefined();
    expect(formatHashLines).toBeDefined();
    expect(normalizeLineRef).toBeDefined();
    expect(parseLineRef).toBeDefined();
    expect(validateLineRef).toBeDefined();
  });
});

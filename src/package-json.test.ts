import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

describe('package.json metadata', () => {
  test('documents the published schema URL consistently', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      files?: string[];
      name: string;
    };
    const schemaFile = packageJson.files?.find((file) =>
      file.endsWith('.schema.json'),
    );

    expect(schemaFile).toBe('oh-my-opencode-medium.schema.json');

    const documentedSchemaUrl = `https://unpkg.com/${packageJson.name}@latest/${schemaFile}`;
    const readme = readFileSync('README.md', 'utf8');
    const installationDoc = readFileSync('docs/installation.md', 'utf8');

    expect(readme).toContain(documentedSchemaUrl);
    expect(installationDoc).toContain(documentedSchemaUrl);
  });

  test('documents install commands with the latest dist-tag', () => {
    const readme = readFileSync('README.md', 'utf8');
    const installationDoc = readFileSync('docs/installation.md', 'utf8');

    expect(readme).toContain('oh-my-opencode-medium@latest install');
    expect(installationDoc).toContain('oh-my-opencode-medium@latest install');
    expect(readme).not.toContain('oh-my-opencode-medium@medium');
    expect(installationDoc).not.toContain('oh-my-opencode-medium@medium');
  });

  test('exports CLI bin with npm-safe relative path', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      bin?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(packageJson.bin).toEqual({
      'oh-my-opencode-medium': 'dist/cli/index.js',
    });

    expect(packageJson.scripts?.release).toBe('bun run scripts/release.ts');
    expect(packageJson.scripts?.['release:dry']).toBeUndefined();
    expect(packageJson.scripts?.['release:medium']).toBeUndefined();
    expect(packageJson.scripts?.['release:medium:dry']).toBeUndefined();
  });

  test('publishes the documented medium schema with hashline_edit', () => {
    expect(existsSync('oh-my-opencode-medium.schema.json')).toBe(true);

    const schema = JSON.parse(
      readFileSync('oh-my-opencode-medium.schema.json', 'utf8'),
    ) as {
      properties?: Record<string, unknown>;
    };

    expect(schema.properties?.hashline_edit).toEqual({
      type: 'boolean',
      default: true,
      description:
        'Enable hash-anchored read/edit workflow. Enabled by default; set to false to disable.',
    });
  });
});

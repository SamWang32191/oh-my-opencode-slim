#!/usr/bin/env bun

/**
 * Generates a JSON Schema from the Zod PluginConfigSchema.
 * Run as part of the build step so the schema stays in sync with the source.
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { PluginConfigSchema } from '../src/config/schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const schema = z.toJSONSchema(PluginConfigSchema, {
  // Use 'input' so defaulted fields are optional in the schema,
  // matching how users actually write their config files
  io: 'input',
});

function writeSchemaArtifact(
  fileName: string,
  title: string,
  description: string,
) {
  const outputPath = join(rootDir, fileName);
  const jsonSchema = {
    ...schema,
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title,
    description,
  };

  const json = JSON.stringify(jsonSchema, null, 2);
  writeFileSync(outputPath, `${json}\n`);
  return outputPath;
}

function formatSchemaArtifacts(paths: string[]) {
  const biomeBinary = join(
    rootDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'biome.cmd' : 'biome',
  );
  const result = spawnSync(biomeBinary, ['format', '--write', ...paths], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stderr = result.stderr ?? '';
  const stdout = result.stdout ?? '';

  if (result.status !== 0) {
    const details = stderr.trim() || stdout.trim();
    throw new Error(
      details === ''
        ? 'Failed to format generated schema artifacts.'
        : `Failed to format generated schema artifacts.\n${details}`,
    );
  }
}

const generatedPaths = [
  writeSchemaArtifact(
    'oh-my-opencode-medium.schema.json',
    'oh-my-opencode-medium',
    'Configuration schema for oh-my-opencode-medium plugin for OpenCode',
  ),
];

formatSchemaArtifacts(generatedPaths);

for (const outputPath of generatedPaths) {
  console.log(`✅ Schema written to ${outputPath}`);
}

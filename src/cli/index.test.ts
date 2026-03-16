/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';

describe('cli index', () => {
  test('help text reflects OpenAI-only installer flow', () => {
    const result = Bun.spawnSync({
      cmd: ['bun', 'src/cli/index.ts', '--help'],
      cwd: process.cwd(),
      stderr: 'pipe',
      stdout: 'pipe',
      env: process.env,
    });

    const stdout = new TextDecoder().decode(result.stdout);
    const stderr = new TextDecoder().decode(result.stderr);

    expect(result.exitCode).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain(
      'Usage: bunx oh-my-opencode-medium install [OPTIONS]',
    );
    expect(stdout).not.toContain('bunx oh-my-opencode-medium models');
    expect(stdout).not.toContain('--kimi=yes|no');
    expect(stdout).not.toContain('--openai=yes|no');
    expect(stdout).toContain(
      'The installer generates an OpenAI configuration by default.',
    );
  });
});

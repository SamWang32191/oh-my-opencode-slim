/// <reference types="bun-types" />

import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ensureConfigDir,
  getConfigDir,
  getConfigJson,
  getConfigJsonc,
  getExistingConfigPath,
  getExistingLiteConfigPath,
  getLiteConfig,
  getLiteConfigJsonc,
  getOpenCodeConfigPaths,
} from './paths';

describe('paths', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('getConfigDir() uses XDG_CONFIG_HOME when set', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(getConfigDir()).toBe('/tmp/xdg-config/opencode');
  });

  test('getConfigDir() falls back to ~/.config when XDG_CONFIG_HOME is unset', () => {
    delete process.env.XDG_CONFIG_HOME;
    const expected = join(homedir(), '.config', 'opencode');
    expect(getConfigDir()).toBe(expected);
  });

  test('getOpenCodeConfigPaths() returns both json and jsonc paths', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(getOpenCodeConfigPaths()).toEqual([
      '/tmp/xdg-config/opencode/opencode.json',
      '/tmp/xdg-config/opencode/opencode.jsonc',
    ]);
  });

  test('getConfigJson() returns correct path', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(getConfigJson()).toBe('/tmp/xdg-config/opencode/opencode.json');
  });

  test('getConfigJsonc() returns correct path', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(getConfigJsonc()).toBe('/tmp/xdg-config/opencode/opencode.jsonc');
  });

  test('getLiteConfig() returns medium config path', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(getLiteConfig()).toBe(
      '/tmp/xdg-config/opencode/oh-my-opencode-medium.json',
    );
  });

  test('getLiteConfigJsonc() returns medium config jsonc path', () => {
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    expect(getLiteConfigJsonc()).toBe(
      '/tmp/xdg-config/opencode/oh-my-opencode-medium.jsonc',
    );
  });

  test("getExistingLiteConfigPath() returns medium config path and doesn't check slim", () => {
    // This test verifies medium-only behavior - slim files are ignored
    process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
    // Note: We don't create any config files, so it returns the default medium json path
    expect(getExistingLiteConfigPath()).toBe(
      '/tmp/xdg-config/opencode/oh-my-opencode-medium.json',
    );
  });

  test('getExistingLiteConfigPath() returns existing medium .jsonc when present', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'opencode-test-'));
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'opencode');
    ensureConfigDir();
    const jsoncPath = join(configDir, 'oh-my-opencode-medium.jsonc');
    writeFileSync(jsoncPath, '{}');

    expect(getExistingLiteConfigPath()).toBe(jsoncPath);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('getExistingLiteConfigPath() returns existing medium .json when present', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'opencode-test-'));
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'opencode');
    ensureConfigDir();
    const jsonPath = join(configDir, 'oh-my-opencode-medium.json');
    writeFileSync(jsonPath, '{}');

    expect(getExistingLiteConfigPath()).toBe(jsonPath);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('getExistingLiteConfigPath() ignores slim config files', () => {
    // This test verifies that slim config files are NOT loaded
    const tmpDir = mkdtempSync(join(tmpdir(), 'opencode-test-'));
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'opencode');
    ensureConfigDir();

    // Create a slim config file - it should be ignored
    const slimPath = join(configDir, 'oh-my-opencode-slim.json');
    writeFileSync(slimPath, '{"slim": true}');

    // Should still return medium path, not the slim path
    expect(getExistingLiteConfigPath()).toBe(
      join(configDir, 'oh-my-opencode-medium.json'),
    );

    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getExistingConfigPath()', () => {
    let tmpDir: string;

    afterEach(() => {
      if (tmpDir && existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('returns .json if it exists', () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'opencode-test-'));
      process.env.XDG_CONFIG_HOME = tmpDir;

      const configDir = join(tmpDir, 'opencode');
      ensureConfigDir();

      const jsonPath = join(configDir, 'opencode.json');
      writeFileSync(jsonPath, '{}');

      expect(getExistingConfigPath()).toBe(jsonPath);
    });

    test("returns .jsonc if .json doesn't exist but .jsonc does", () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'opencode-test-'));
      process.env.XDG_CONFIG_HOME = tmpDir;

      const configDir = join(tmpDir, 'opencode');
      ensureConfigDir();

      const jsoncPath = join(configDir, 'opencode.jsonc');
      writeFileSync(jsoncPath, '{}');

      expect(getExistingConfigPath()).toBe(jsoncPath);
    });

    test('returns default .json if neither exists', () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'opencode-test-'));
      process.env.XDG_CONFIG_HOME = tmpDir;

      const jsonPath = join(tmpDir, 'opencode', 'opencode.json');
      expect(getExistingConfigPath()).toBe(jsonPath);
    });
  });

  test("ensureConfigDir() creates directory if it doesn't exist", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'opencode-test-'));
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'opencode');

    expect(existsSync(configDir)).toBe(false);
    ensureConfigDir();
    expect(existsSync(configDir)).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

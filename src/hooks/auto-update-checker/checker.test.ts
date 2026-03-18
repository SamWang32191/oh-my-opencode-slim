import { describe, expect, mock, test } from 'bun:test';
import * as fs from 'node:fs';
import { extractChannel, findPluginEntry, getLocalDevVersion } from './checker';

// Mock the constants with new package name for functional tests
mock.module('./constants', () => ({
  PACKAGE_NAME: 'oh-my-opencode-medium',
  USER_OPENCODE_CONFIG: '/mock/config/opencode.json',
  USER_OPENCODE_CONFIG_JSONC: '/mock/config/opencode.jsonc',
  INSTALLED_PACKAGE_JSON:
    '/mock/cache/node_modules/oh-my-opencode-medium/package.json',
}));

// Mock fs for tests that need it
mock.module('node:fs', () => ({
  existsSync: mock((_p: string) => false),
  readFileSync: mock(() => ''),
  statSync: mock((_p: string) => ({ isDirectory: () => true })),
  writeFileSync: mock(() => {}),
}));

mock.module('../../cli/config-manager', () => ({
  getOpenCodeConfigPaths: () => [
    '/mock/config/opencode.json',
    '/mock/config/opencode.jsonc',
  ],
  stripJsonComments: (s: string) => s,
}));

describe('auto-update-checker/checker', () => {
  describe('extractChannel', () => {
    test('returns latest for null or empty', () => {
      expect(extractChannel(null)).toBe('latest');
      expect(extractChannel('')).toBe('latest');
    });

    test('returns tag if version starts with non-digit', () => {
      expect(extractChannel('beta')).toBe('beta');
      expect(extractChannel('next')).toBe('next');
    });

    test('extracts channel from prerelease version', () => {
      expect(extractChannel('1.0.0-alpha.1')).toBe('alpha');
      expect(extractChannel('2.3.4-beta.5')).toBe('beta');
      expect(extractChannel('0.1.0-rc.1')).toBe('rc');
      expect(extractChannel('1.0.0-canary.0')).toBe('canary');
    });

    test('returns latest for standard versions', () => {
      expect(extractChannel('1.0.0')).toBe('latest');
    });
  });

  describe('getLocalDevVersion', () => {
    test('returns null if no local dev path in config', () => {
      // existsSync returns false by default from mock
      expect(getLocalDevVersion('/test')).toBeNull();
    });

    test('returns version from local package.json if path exists', () => {
      const existsMock = fs.existsSync as any;
      const readMock = fs.readFileSync as any;

      existsMock.mockImplementation((p: string) => {
        if (p.includes('opencode.json')) return true;
        if (p.includes('package.json')) return true;
        return false;
      });

      readMock.mockImplementation((p: string) => {
        if (p.includes('opencode.json')) {
          return JSON.stringify({
            plugin: ['file:///dev/oh-my-opencode-medium'],
          });
        }
        if (p.includes('package.json')) {
          return JSON.stringify({
            name: 'oh-my-opencode-medium',
            version: '1.2.3-dev',
          });
        }
        return '';
      });

      expect(getLocalDevVersion('/test')).toBe('1.2.3-dev');
    });

    test('returns version from local package.json for arbitrary file path entries', () => {
      const existsMock = fs.existsSync as any;
      const readMock = fs.readFileSync as any;

      existsMock.mockImplementation((p: string) => {
        if (p.includes('opencode.json')) return true;
        if (p === '/dev/plugins/medium-local/package.json') return true;
        return false;
      });

      readMock.mockImplementation((p: string) => {
        if (p.includes('opencode.json')) {
          return JSON.stringify({
            plugin: ['file:///dev/plugins/medium-local'],
          });
        }
        if (p === '/dev/plugins/medium-local/package.json') {
          return JSON.stringify({
            name: 'oh-my-opencode-medium',
            version: '0.8.3-medium.6',
          });
        }
        return '';
      });

      expect(getLocalDevVersion('/test')).toBe('0.8.3-medium.6');
    });

    test('ignores unrelated local plugins nested inside this repository', () => {
      const existsMock = fs.existsSync as any;
      const readMock = fs.readFileSync as any;

      existsMock.mockImplementation((p: string) => {
        if (p.includes('opencode.json')) return true;
        if (p === '/repo/tools/other-plugin/package.json') return true;
        if (p === '/repo/package.json') return true;
        return false;
      });

      readMock.mockImplementation((p: string) => {
        if (p.includes('opencode.json')) {
          return JSON.stringify({
            plugin: ['file:///repo/tools/other-plugin/dist'],
          });
        }
        if (p === '/repo/tools/other-plugin/package.json') {
          return JSON.stringify({
            name: 'other-plugin',
            version: '1.0.0',
          });
        }
        if (p === '/repo/package.json') {
          return JSON.stringify({
            name: 'oh-my-opencode-medium',
            version: '0.8.3-medium.6',
          });
        }
        return '';
      });

      expect(getLocalDevVersion('/test')).toBeNull();
    });
  });

  describe('findPluginEntry', () => {
    test('detects latest version entry', () => {
      const existsMock = fs.existsSync as any;
      const readMock = fs.readFileSync as any;

      existsMock.mockImplementation((p: string) => p.includes('opencode.json'));
      readMock.mockImplementation(() =>
        JSON.stringify({
          plugin: ['oh-my-opencode-medium'],
        }),
      );

      const entry = findPluginEntry('/test');
      expect(entry).not.toBeNull();
      expect(entry?.entry).toBe('oh-my-opencode-medium');
      expect(entry?.isPinned).toBe(false);
      expect(entry?.pinnedVersion).toBeNull();
    });

    test('detects pinned version entry', () => {
      const existsMock = fs.existsSync as any;
      const readMock = fs.readFileSync as any;

      existsMock.mockImplementation((p: string) => p.includes('opencode.json'));
      readMock.mockImplementation(() =>
        JSON.stringify({
          plugin: ['oh-my-opencode-medium@1.0.0'],
        }),
      );

      const entry = findPluginEntry('/test');
      expect(entry).not.toBeNull();
      expect(entry?.isPinned).toBe(true);
      expect(entry?.pinnedVersion).toBe('1.0.0');
    });
  });
});

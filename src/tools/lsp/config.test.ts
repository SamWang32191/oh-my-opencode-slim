import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { join, win32 } from 'node:path';

const existsSyncMock = mock(() => false);
const homedirMock = mock(() => '/home/user');
const whichSyncMock = mock(() => null);

// Mock fs and os BEFORE importing the modules that use them
mock.module('node:fs', () => ({
  existsSync: existsSyncMock,
}));

mock.module('node:os', () => ({
  homedir: homedirMock,
}));

// Create a mock for which.sync
mock.module('which', () => ({
  sync: whichSyncMock,
  default: { sync: whichSyncMock },
}));

// Now import the code to test
import { findServerForExtension, isServerInstalled } from './config';

function withPlatform<T>(platform: NodeJS.Platform, fn: () => T): T {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');

  Object.defineProperty(process, 'platform', {
    value: platform,
  });

  try {
    return fn();
  } finally {
    if (original) {
      Object.defineProperty(process, 'platform', original);
    }
  }
}

function normalizeWindowsPath(value: string): string {
  return value.replace(/[\\/]+/g, '\\');
}

const ENV_KEYS = [
  'PATH',
  'XDG_CACHE_HOME',
  'LOCALAPPDATA',
  'PATHEXT',
  'OPENCODE_CONFIG_DIR',
] as const;

let envSnapshot: Record<string, string | undefined> = {};

describe('config', () => {
  beforeEach(() => {
    envSnapshot = Object.fromEntries(
      ENV_KEYS.map((key) => [key, process.env[key]]),
    );
    existsSyncMock.mockClear();
    existsSyncMock.mockImplementation(() => false);
    homedirMock.mockClear();
    homedirMock.mockReturnValue('/home/user');
    whichSyncMock.mockClear();
    whichSyncMock.mockReturnValue(null);
    delete process.env.XDG_CACHE_HOME;
    delete process.env.LOCALAPPDATA;
    delete process.env.PATHEXT;
    delete process.env.OPENCODE_CONFIG_DIR;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = envSnapshot[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  describe('isServerInstalled', () => {
    test('should return false if command is empty', () => {
      expect(isServerInstalled([])).toBe(false);
    });

    test('should detect absolute paths', () => {
      existsSyncMock.mockImplementation(
        (path: string) => path === '/usr/bin/lsp-server',
      );
      expect(isServerInstalled(['/usr/bin/lsp-server'])).toBe(true);
      expect(isServerInstalled(['/usr/bin/missing'])).toBe(false);
    });

    test('should detect server in PATH', () => {
      const originalPath = process.env.PATH;
      try {
        process.env.PATH = '/usr/local/bin:/usr/bin';

        // Mock whichSync to return a path (simulating the command is found)
        whichSyncMock.mockReturnValue(
          join('/usr/bin', 'typescript-language-server'),
        );

        expect(isServerInstalled(['typescript-language-server'])).toBe(true);
      } finally {
        if (originalPath === undefined) {
          delete process.env.PATH;
        } else {
          process.env.PATH = originalPath;
        }
      }
    });

    test('should detect server in local node_modules', () => {
      const cwd = process.cwd();
      const localBin = join(
        cwd,
        'node_modules',
        '.bin',
        'typescript-language-server',
      );

      existsSyncMock.mockImplementation((path: string) => path === localBin);

      expect(isServerInstalled(['typescript-language-server'])).toBe(true);
    });

    test('should detect server in default cache bin', () => {
      const cacheBin = join(
        '/home/user',
        '.cache',
        'opencode',
        'bin',
        'typescript-language-server',
      );

      whichSyncMock.mockImplementation((_cmd, options) => {
        expect(options?.path).toContain('/home/user/.cache/opencode/bin');
        return cacheBin;
      });

      expect(isServerInstalled(['typescript-language-server'])).toBe(true);
    });

    test('should detect server in XDG cache bin', () => {
      process.env.XDG_CACHE_HOME = '/custom/cache';

      const cacheBin = join(
        '/custom/cache',
        'opencode',
        'bin',
        'typescript-language-server',
      );

      whichSyncMock.mockImplementation((_cmd, options) => {
        expect(options?.path).toContain('/custom/cache/opencode/bin');
        expect(options?.path).not.toContain('/home/user/.cache/opencode/bin');
        return cacheBin;
      });

      expect(isServerInstalled(['typescript-language-server'])).toBe(true);
    });

    test('should use LOCALAPPDATA on Windows', () => {
      process.env.XDG_CACHE_HOME = '/custom/xdg-cache';
      process.env.LOCALAPPDATA = '/custom/localappdata';
      process.env.PATHEXT = '.COM;.EXE;.BAT;.CMD';

      const expectedBinDir = win32.join(
        '/custom/localappdata',
        'opencode',
        'bin',
      );
      const cacheBin = win32.join(expectedBinDir, 'typescript-language-server');

      withPlatform('win32', () => {
        whichSyncMock.mockImplementation((_cmd, options) => {
          const segments = options?.path?.split(';') ?? [];
          expect(segments.map(normalizeWindowsPath)).toContain(
            normalizeWindowsPath(expectedBinDir),
          );
          expect(segments.map(normalizeWindowsPath)).not.toContain(
            normalizeWindowsPath('/home/user/.cache/opencode/bin'),
          );
          expect(options?.pathExt).toBe('.COM;.EXE;.BAT;.CMD');
          return cacheBin;
        });

        expect(isServerInstalled(['typescript-language-server'])).toBe(true);
      });
    });

    test('should fallback to homedir on Windows when LOCALAPPDATA is missing', () => {
      homedirMock.mockReturnValue('/home/windows-user');
      process.env.PATHEXT = '.EXE;.CMD';

      const expectedBinDir = win32.join(
        '/home/windows-user',
        'opencode',
        'bin',
      );
      const cacheBin = win32.join(expectedBinDir, 'typescript-language-server');

      withPlatform('win32', () => {
        whichSyncMock.mockImplementation((_cmd, options) => {
          const segments = options?.path?.split(';') ?? [];
          expect(segments.map(normalizeWindowsPath)).toContain(
            normalizeWindowsPath(expectedBinDir),
          );
          expect(options?.pathExt).toBe('.EXE;.CMD');
          return cacheBin;
        });

        expect(isServerInstalled(['typescript-language-server'])).toBe(true);
      });
    });

    test('should ignore legacy config bin path', () => {
      process.env.OPENCODE_CONFIG_DIR = '/custom/opencode-config';

      const legacyConfigBin = join(
        '/custom/opencode-config',
        'bin',
        'typescript-language-server',
      );

      whichSyncMock.mockImplementation((_cmd, options) => {
        expect(options?.path).not.toContain('/custom/opencode-config/bin');
        if (options?.path?.includes('/custom/opencode-config/bin')) {
          return legacyConfigBin;
        }

        return null;
      });

      expect(isServerInstalled(['typescript-language-server'])).toBe(false);
    });

    test('should still use existsSync for path-like commands', () => {
      existsSyncMock.mockImplementation((path: string) => {
        return path === './bin/custom-lsp';
      });

      whichSyncMock.mockImplementation(() => {
        throw new Error(
          'whichSync should not be called for path-like commands',
        );
      });

      expect(isServerInstalled(['./bin/custom-lsp'])).toBe(true);
    });
  });

  describe('findServerForExtension', () => {
    test('should return found for .ts extension if installed', () => {
      existsSyncMock.mockReturnValue(true);
      const result = findServerForExtension('.ts');
      expect(result.status).toBe('found');
      if (result.status === 'found') {
        expect(result.server.id).toBe('deno');
      }
    });

    test('should return found for .py extension if installed (prefers ty)', () => {
      existsSyncMock.mockReturnValue(true);
      const result = findServerForExtension('.py');
      expect(result.status).toBe('found');
      if (result.status === 'found') {
        expect(result.server.id).toBe('ty');
      }
    });

    test('should return not_configured for unknown extension', () => {
      const result = findServerForExtension('.unknown');
      expect(result.status).toBe('not_configured');
    });

    test('should return not_installed if server not in PATH', () => {
      existsSyncMock.mockReturnValue(false);
      const result = findServerForExtension('.ts');
      expect(result.status).toBe('not_installed');
      if (result.status === 'not_installed') {
        expect(result.server.id).toBe('deno');
        expect(result.installHint).toContain('Install Deno');
      }
    });
  });
});

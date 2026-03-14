/// <reference types="bun-types" />

import { describe, expect, mock, test } from 'bun:test';

// Mock config-manager before importing constants
mock.module('../../cli/config-manager', () => ({
  getOpenCodeConfigPaths: () => [
    '/mock/config/opencode.json',
    '/mock/config/opencode.jsonc',
  ],
  stripJsonComments: (s: string) => s,
}));

describe('auto-update-checker/constants', () => {
  describe('PACKAGE_NAME', () => {
    test('exports correct package name', () => {
      const { PACKAGE_NAME } = require('./constants');
      expect(PACKAGE_NAME).toBe('oh-my-opencode-medium');
    });
  });

  describe('NPM_REGISTRY_URL', () => {
    test('exports correct registry URL with encoded package name', () => {
      const { NPM_REGISTRY_URL } = require('./constants');
      expect(NPM_REGISTRY_URL).toBe(
        'https://registry.npmjs.org/-/package/oh-my-opencode-medium/dist-tags',
      );
    });
  });

  describe('INSTALLED_PACKAGE_JSON', () => {
    test('uses correct package name in path', () => {
      const { INSTALLED_PACKAGE_JSON } = require('./constants');
      expect(INSTALLED_PACKAGE_JSON).toContain('oh-my-opencode-medium');
      expect(INSTALLED_PACKAGE_JSON).toContain('package.json');
    });
  });

  describe('CACHE_DIR', () => {
    test('exports a valid directory path', () => {
      const { CACHE_DIR } = require('./constants');
      expect(CACHE_DIR).toBeDefined();
      expect(typeof CACHE_DIR).toBe('string');
      expect(CACHE_DIR.length).toBeGreaterThan(0);
    });
  });

  describe('USER_OPENCODE_CONFIG', () => {
    test('exports configuration path', () => {
      const { USER_OPENCODE_CONFIG } = require('./constants');
      expect(USER_OPENCODE_CONFIG).toBeDefined();
      expect(typeof USER_OPENCODE_CONFIG).toBe('string');
    });
  });

  describe('USER_OPENCODE_CONFIG_JSONC', () => {
    test('exports JSONC configuration path', () => {
      const { USER_OPENCODE_CONFIG_JSONC } = require('./constants');
      expect(USER_OPENCODE_CONFIG_JSONC).toBeDefined();
      expect(typeof USER_OPENCODE_CONFIG_JSONC).toBe('string');
    });
  });

  describe('NPM_FETCH_TIMEOUT', () => {
    test('exports timeout value', () => {
      const { NPM_FETCH_TIMEOUT } = require('./constants');
      expect(NPM_FETCH_TIMEOUT).toBe(5000);
    });
  });
});

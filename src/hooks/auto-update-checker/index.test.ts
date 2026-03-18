/// <reference types="bun-types" />

import { describe, expect, test } from 'bun:test';
import { CACHE_DIR, PACKAGE_NAME } from './constants';
import { createAutoUpdateInstallSpec } from './index';

describe('auto-update-checker/index', () => {
  test('builds a cache-local bun add command for the target version', () => {
    expect(createAutoUpdateInstallSpec('0.8.3-medium.6')).toEqual({
      cmd: ['bun', 'add', `${PACKAGE_NAME}@0.8.3-medium.6`],
      cwd: CACHE_DIR,
      stdout: 'ignore',
      stderr: 'ignore',
    });
  });
});

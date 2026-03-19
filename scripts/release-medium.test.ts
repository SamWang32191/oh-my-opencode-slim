import { describe, expect, test } from 'bun:test';
import {
  deriveReachableUpstreamTags,
  normalizeRemoteTagRefs,
  parseReleaseArgs,
  shouldFetchUpstreamTags,
} from './release-medium';

describe('parseReleaseArgs', () => {
  test('requires an explicit stable version and accepts dry-run with notes', () => {
    expect(
      parseReleaseArgs([
        '--version',
        '1.2.3',
        '--dry-run',
        '--notes',
        'Ship it',
      ]),
    ).toEqual({
      requestedVersion: '1.2.3',
      dryRun: true,
      notes: 'Ship it',
    });
  });

  test('throws when version is missing', () => {
    expect(() => parseReleaseArgs(['--dry-run'])).toThrow(
      'Missing required --version X.Y.Z argument.',
    );
  });
});

describe('normalizeRemoteTagRefs', () => {
  test('converts ls-remote tag refs into bare tag names', () => {
    expect(
      normalizeRemoteTagRefs(
        'abc123\trefs/tags/v1.2.3\n' + 'def456\trefs/tags/v1.2.4\n',
      ),
    ).toEqual(['v1.2.3', 'v1.2.4']);
  });

  test('strips CRLF line endings from ls-remote output', () => {
    expect(
      normalizeRemoteTagRefs(
        'abc123\trefs/tags/v1.2.3\r\n' + 'def456\trefs/tags/v1.2.4\r\n',
      ),
    ).toEqual(['v1.2.3', 'v1.2.4']);
  });
});

describe('deriveReachableUpstreamTags', () => {
  test('keeps only upstream tags that are reachable from HEAD', () => {
    expect(
      deriveReachableUpstreamTags(
        ['v1.2.4', 'v1.2.3', 'v9.9.9'],
        ['v1.2.3', 'v2.0.0', 'v1.2.4'],
      ),
    ).toEqual(['v1.2.4', 'v1.2.3']);
  });
});

describe('shouldFetchUpstreamTags', () => {
  test('skips fetch in dry-run mode', () => {
    expect(shouldFetchUpstreamTags(true)).toBe(false);
  });

  test('fetches before a real release', () => {
    expect(shouldFetchUpstreamTags(false)).toBe(true);
  });
});

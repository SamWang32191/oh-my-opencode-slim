import { describe, expect, test } from 'bun:test';
import {
  buildMediumReleasePlan,
  getLatestReachableStableUpstreamVersion,
  parseStableReleaseTag,
  validateRequestedReleaseVersion,
} from './medium-version';

describe('validateRequestedReleaseVersion', () => {
  test('returns a stable semver version unchanged', () => {
    expect(validateRequestedReleaseVersion('1.0.0')).toBe('1.0.0');
  });

  test('rejects prerelease versions', () => {
    expect(() => validateRequestedReleaseVersion('1.0.0-rc.1')).toThrow(
      'Release version must be stable semver in X.Y.Z form.',
    );
  });
});

describe('parseStableReleaseTag', () => {
  test('parses an exact stable release tag', () => {
    expect(parseStableReleaseTag('v1.2.3')).toEqual({
      version: '1.2.3',
    });
  });
});

test('selects the latest reachable stable upstream version by semver', () => {
  expect(
    getLatestReachableStableUpstreamVersion([
      'v0.8.9',
      'v0.10.0',
      'v0.10.0-rc.1',
      'v1.0',
    ]),
  ).toBe('0.10.0');
});

test('builds the stable release plan from requested and reachable tags', () => {
  expect(
    buildMediumReleasePlan({
      requestedVersion: '1.0.0',
      reachableUpstreamTags: ['v0.8.2', 'v0.8.3'],
    }),
  ).toEqual({
    packageVersion: '1.0.0',
    gitTag: 'v1.0.0',
    upstreamTag: 'v0.8.3',
    releaseCommitMessage: 'chore: release 1.0.0',
  });
});

test('throws when no reachable stable upstream tags exist', () => {
  expect(() =>
    buildMediumReleasePlan({
      requestedVersion: '1.0.0',
      reachableUpstreamTags: ['v0.8.3-rc.1', 'not-a-tag'],
    }),
  ).toThrow('No stable upstream tag reachable from HEAD.');
});

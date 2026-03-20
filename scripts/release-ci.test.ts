import { describe, expect, test } from 'bun:test';
import {
  assertCompareResponseComplete,
  buildCompareEndpoint,
  buildUpstreamRemoteRestoreArgs,
  determineCompareBaseAndHead,
  parseReleaseCiArgs,
  resolveGithubReleaseRepo,
  shouldWriteReleaseBodyFile,
} from './release-ci';

describe('parseReleaseCiArgs', () => {
  test('parses required args without optional notes', () => {
    expect(
      parseReleaseCiArgs([
        '--version',
        '1.2.3',
        '--body-file',
        '/tmp/release-body.md',
      ]),
    ).toEqual({
      requestedVersion: '1.2.3',
      bodyFile: '/tmp/release-body.md',
      notes: undefined,
    });
  });

  test('parses required args and optional notes', () => {
    expect(
      parseReleaseCiArgs([
        '--version',
        '1.2.3',
        '--body-file',
        '/tmp/release-body.md',
        '--notes',
        'Patch release',
      ]),
    ).toEqual({
      requestedVersion: '1.2.3',
      bodyFile: '/tmp/release-body.md',
      notes: 'Patch release',
    });
  });

  test('fails when --version is missing', () => {
    expect(() =>
      parseReleaseCiArgs(['--body-file', '/tmp/release-body.md']),
    ).toThrow('Missing required --version X.Y.Z argument.');
  });

  test('fails when --body-file is missing', () => {
    expect(() => parseReleaseCiArgs(['--version', '1.2.3'])).toThrow(
      'Missing required --body-file <path> argument.',
    );
  });

  test('fails when --notes is multiline', () => {
    expect(() =>
      parseReleaseCiArgs([
        '--version',
        '1.2.3',
        '--body-file',
        '/tmp/release-body.md',
        '--notes',
        'line 1\nline 2',
      ]),
    ).toThrow('Release notes must be a single line.');
  });
});

describe('buildCompareEndpoint', () => {
  test('builds compare endpoint with explicit head ref', () => {
    expect(
      buildCompareEndpoint({
        base: '115bbac7e3cc76ec4cb20b51fe4c38bf3065b3a8',
        head: '3f8d17f5c6f6d0ba3df56fd6b37cfac61de8d89d',
        githubRepository: 'SamWang32191/oh-my-opencode-medium',
      }),
    ).toBe(
      'repos/SamWang32191/oh-my-opencode-medium/compare/' +
        '115bbac7e3cc76ec4cb20b51fe4c38bf3065b3a8...' +
        '3f8d17f5c6f6d0ba3df56fd6b37cfac61de8d89d',
    );
  });
});

describe('resolveGithubReleaseRepo', () => {
  test('falls back to default repo when env is missing', () => {
    expect(resolveGithubReleaseRepo({})).toBe(
      'SamWang32191/oh-my-opencode-medium',
    );
  });

  test('uses GITHUB_REPOSITORY when provided', () => {
    expect(
      resolveGithubReleaseRepo({
        GITHUB_REPOSITORY: 'owner/custom-repo',
      }),
    ).toBe('owner/custom-repo');
  });
});

describe('determineCompareBaseAndHead', () => {
  test('uses previous fork release tag as compare base', () => {
    expect(
      determineCompareBaseAndHead({
        previousReleaseTag: 'v1.0.2',
        currentHeadCommit: '3333333333333333333333333333333333333333',
      }),
    ).toEqual({
      base: 'v1.0.2',
      head: '3333333333333333333333333333333333333333',
    });
  });

  test('falls back to current head when no previous fork release exists', () => {
    expect(
      determineCompareBaseAndHead({
        previousReleaseTag: null,
        currentHeadCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).toEqual({
      base: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      head: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
  });
});

describe('shouldWriteReleaseBodyFile', () => {
  test('returns true for concrete file paths', () => {
    expect(shouldWriteReleaseBodyFile('/tmp/release-body.md')).toBe(true);
  });

  test('returns false for stdout sentinel', () => {
    expect(shouldWriteReleaseBodyFile('-')).toBe(false);
  });
});

describe('buildUpstreamRemoteRestoreArgs', () => {
  test('restores previous upstream URL when it existed before CI', () => {
    expect(
      buildUpstreamRemoteRestoreArgs('git@github.com:owner/repo.git'),
    ).toEqual([
      'remote',
      'set-url',
      'upstream',
      'git@github.com:owner/repo.git',
    ]);
  });

  test('removes upstream remote when it did not exist before CI', () => {
    expect(buildUpstreamRemoteRestoreArgs(null)).toEqual([
      'remote',
      'remove',
      'upstream',
    ]);
  });
});

describe('assertCompareResponseComplete', () => {
  test('throws when compare response indicates truncation', () => {
    expect(() =>
      assertCompareResponseComplete({
        totalCommits: 300,
        loadedCommitCount: 250,
      }),
    ).toThrow('GitHub compare API response is truncated');
  });

  test('passes when loaded commits are complete', () => {
    expect(() =>
      assertCompareResponseComplete({
        totalCommits: 10,
        loadedCommitCount: 10,
      }),
    ).not.toThrow();
  });
});

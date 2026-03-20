import { describe, expect, test } from 'bun:test';
import {
  buildChangelogMarkdown,
  classifyChangelogSection,
  type ReleaseChangelogCommit,
  type ReleaseChangelogPullRequest,
} from './changelog';

describe('classifyChangelogSection', () => {
  test('uses label mapping before title prefix for pull requests', () => {
    const pullRequest: ReleaseChangelogPullRequest = {
      number: 123,
      title: 'fix: correct edge case',
      labels: ['feature'],
    };

    expect(classifyChangelogSection(pullRequest)).toBe('Features');
  });

  test('falls back to title prefix when pull request labels do not match', () => {
    const pullRequest: ReleaseChangelogPullRequest = {
      number: 124,
      title: 'docs: add release notes',
      labels: [],
    };

    expect(classifyChangelogSection(pullRequest)).toBe('Docs');
  });

  test('classifies unmatched direct commits as Other', () => {
    const commit: ReleaseChangelogCommit = {
      sha: 'abc123456789',
      subject: 'update dependency tree',
    };

    expect(classifyChangelogSection(commit)).toBe('Other');
  });

  test('classifies unknown pull requests as Other', () => {
    const pullRequest: ReleaseChangelogPullRequest = {
      number: 125,
      title: 'adjust internals',
      labels: ['enhancement'],
    };

    expect(classifyChangelogSection(pullRequest)).toBe('Other');
  });

  test('uses explicit label priority instead of label array order', () => {
    const pullRequest: ReleaseChangelogPullRequest = {
      number: 126,
      title: 'fix: tighten parser',
      labels: ['fix', 'feature'],
    };

    expect(classifyChangelogSection(pullRequest)).toBe('Features');
  });

  test('supports breaking-change prefixes with and without scope', () => {
    const pullRequest: ReleaseChangelogPullRequest = {
      number: 127,
      title: 'feat(scope)!: change public contract',
      labels: [],
    };
    const commit: ReleaseChangelogCommit = {
      sha: '1234567890abcdef',
      subject: 'feat!: remove deprecated flag',
    };

    expect(classifyChangelogSection(pullRequest)).toBe('Features');
    expect(classifyChangelogSection(commit)).toBe('Features');
  });
});

describe('buildChangelogMarkdown', () => {
  test('renders sections in deterministic order', () => {
    const markdown = buildChangelogMarkdown({
      pullRequests: [
        {
          number: 2,
          title: 'fix: handle null values',
          labels: [],
        },
        {
          number: 1,
          title: 'add API endpoint',
          labels: ['feat'],
        },
        {
          number: 3,
          title: 'chore: update lockfile',
          labels: [],
        },
      ],
      directCommits: [
        {
          sha: 'abcdef123456',
          subject: 'docs: refresh README',
        },
        {
          sha: 'beefcafe1234',
          subject: 'refactor: split changelog logic',
        },
        {
          sha: '1234567890ab',
          subject: 'internal sync point',
        },
      ],
    });

    expect(markdown).toBe(
      '## Features\n\n' +
        '- add API endpoint (#1)\n\n' +
        '## Fixes\n\n' +
        '- fix: handle null values (#2)\n\n' +
        '## Docs\n\n' +
        '- docs: refresh README (abcdef1)\n\n' +
        '## Refactors\n\n' +
        '- refactor: split changelog logic (beefcaf)\n\n' +
        '## Chores\n\n' +
        '- chore: update lockfile (#3)\n\n' +
        '## Other\n\n' +
        '- internal sync point (1234567)',
    );
  });

  test('returns the placeholder when there are no items', () => {
    expect(
      buildChangelogMarkdown({
        pullRequests: [],
        directCommits: [],
      }),
    ).toBe('No categorized pull requests found.');
  });

  test('preserves item input order within each rendered section', () => {
    const markdown = buildChangelogMarkdown({
      pullRequests: [
        {
          number: 11,
          title: 'fix: first pull request fix',
          labels: [],
        },
        {
          number: 12,
          title: 'fix: second pull request fix',
          labels: [],
        },
      ],
      directCommits: [
        {
          sha: 'aaaaaaa1111111',
          subject: 'fix: first direct commit fix',
        },
        {
          sha: 'bbbbbbb2222222',
          subject: 'fix: second direct commit fix',
        },
      ],
    });

    expect(markdown).toBe(
      '## Fixes\n\n' +
        '- fix: first pull request fix (#11)\n' +
        '- fix: second pull request fix (#12)\n' +
        '- fix: first direct commit fix (aaaaaaa)\n' +
        '- fix: second direct commit fix (bbbbbbb)',
    );
  });
});

import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_RELEASE_NOTES,
  RELEASE_MAPPING_HEADER,
  formatGithubReleaseBody,
  upsertReleaseMapping,
} from './release-mapping';

const CURRENT_CONTENT =
  '# Release Mapping\n\n' +
  '> Maps medium releases to upstream tags and commits.\n\n' +
  '## 1.0.0\n\n' +
  '- Date: 2026-03-19\n' +
  '- Upstream Tag: v0.8.3\n' +
  '- Upstream Commit: abc1234\n' +
  '- Notes:\n' +
  '  - Initial stable release\n';

const CURRENT_CONTENT_WITHOUT_FINAL_NEWLINE =
  '# Release Mapping\n\n' +
  '> Maps medium releases to upstream tags and commits.\n\n' +
  '## 1.0.0\n\n' +
  '- Date: 2026-03-19\n' +
  '- Upstream Tag: v0.8.3\n' +
  '- Upstream Commit: abc1234\n' +
  '- Notes:\n' +
  '  - Initial stable release';

const CURRENT_CONTENT_WITH_EXTRA_FINAL_BLANK_LINE =
  '# Release Mapping\n\n' +
  '> Maps medium releases to upstream tags and commits.\n\n' +
  '## 1.0.0\n\n' +
  '- Date: 2026-03-19\n' +
  '- Upstream Tag: v0.8.3\n' +
  '- Upstream Commit: abc1234\n' +
  '- Notes:\n' +
  '  - Initial stable release\n\n';

describe('RELEASE_MAPPING_HEADER', () => {
  test('matches the canonical release mapping header', () => {
    expect(RELEASE_MAPPING_HEADER).toBe(
      '# Release Mapping\n\n' +
        '> Maps medium releases to upstream tags and commits.\n',
    );
  });
});

describe('upsertReleaseMapping', () => {
  test('inserts the newest version section first', () => {
    const result = upsertReleaseMapping(CURRENT_CONTENT, {
      mediumVersion: '1.0.1',
      releaseDate: '2026-03-20',
      upstreamTag: 'v0.8.4',
      upstreamCommit: 'def5678',
      notes: 'Hotfix release',
    });

    expect(result.indexOf('## 1.0.1')).toBeLessThan(result.indexOf('## 1.0.0'));
  });

  test('throws on duplicate medium versions', () => {
    expect(() =>
      upsertReleaseMapping(CURRENT_CONTENT, {
        mediumVersion: '1.0.0',
        releaseDate: '2026-03-19',
        upstreamTag: 'v0.8.3',
        upstreamCommit: 'abc1234',
      }),
    ).toThrow('Release mapping already contains version 1.0.0.');
  });

  test('throws on malformed mapping content', () => {
    expect(() =>
      upsertReleaseMapping('not a valid mapping file', {
        mediumVersion: '1.0.1',
        releaseDate: '2026-03-20',
        upstreamTag: 'v0.8.4',
        upstreamCommit: 'def5678',
      }),
    ).toThrow('Release mapping file is malformed.');
  });

  test('throws when the final section lacks a trailing newline', () => {
    expect(() =>
      upsertReleaseMapping(CURRENT_CONTENT_WITHOUT_FINAL_NEWLINE, {
        mediumVersion: '1.0.1',
        releaseDate: '2026-03-20',
        upstreamTag: 'v0.8.4',
        upstreamCommit: 'def5678',
      }),
    ).toThrow('Release mapping file is malformed.');
  });

  test('throws when the final section has an extra blank line', () => {
    expect(() =>
      upsertReleaseMapping(CURRENT_CONTENT_WITH_EXTRA_FINAL_BLANK_LINE, {
        mediumVersion: '1.0.1',
        releaseDate: '2026-03-20',
        upstreamTag: 'v0.8.4',
        upstreamCommit: 'def5678',
      }),
    ).toThrow('Release mapping file is malformed.');
  });
});

describe('formatGithubReleaseBody', () => {
  test('renders the upstream reference and medium-specific changes section', () => {
    expect(
      formatGithubReleaseBody({
        mediumVersion: '1.0.0',
        upstreamTag: 'v0.8.3',
        upstreamCommit: 'abc1234',
        notes: 'Initial stable release',
      }),
    ).toBe(
      '## 1.0.0\n\n' +
        'Based on upstream v0.8.3 (abc1234)\n\n' +
        '### Medium-specific changes\n' +
        '- Initial stable release',
    );
  });

  test('uses the default notes when notes are omitted', () => {
    expect(
      formatGithubReleaseBody({
        mediumVersion: '1.0.0',
        upstreamTag: 'v0.8.3',
        upstreamCommit: 'abc1234',
      }),
    ).toBe(
      '## 1.0.0\n\n' +
        'Based on upstream v0.8.3 (abc1234)\n\n' +
        '### Medium-specific changes\n' +
        `- ${DEFAULT_RELEASE_NOTES}`,
    );
  });
});

import { describe, expect, test } from 'bun:test';
import {
  type CommitPullRequest,
  type CompareCommit,
  collectReleaseItems,
} from './github-release-data';

describe('collectReleaseItems', () => {
  test('dedupes pull requests by number across multiple commits', () => {
    const compareCommits: CompareCommit[] = [
      {
        sha: 'a1',
        commit: {
          message: 'feat: add endpoint',
        },
      },
      {
        sha: 'b2',
        commit: {
          message: 'feat: follow-up',
        },
      },
    ];
    const pullRequestsByCommit: Record<string, CommitPullRequest[]> = {
      a1: [
        {
          number: 101,
          title: 'feat: add endpoint',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-20T10:00:00Z',
        },
      ],
      b2: [
        {
          number: 101,
          title: 'feat: add endpoint',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-20T10:00:00Z',
        },
      ],
    };

    const result = collectReleaseItems(compareCommits, pullRequestsByCommit);

    expect(result.pullRequests).toEqual([
      {
        number: 101,
        title: 'feat: add endpoint',
        labels: ['feat'],
      },
    ]);
    expect(result.directCommits).toEqual([]);
  });

  test('converts commits without any pull request association into direct commits', () => {
    const compareCommits: CompareCommit[] = [
      {
        sha: 'c3',
        commit: {
          message: 'chore: bump deps',
        },
      },
    ];

    const result = collectReleaseItems(compareCommits, {});

    expect(result.pullRequests).toEqual([]);
    expect(result.directCommits).toEqual([
      {
        sha: 'c3',
        subject: 'chore: bump deps',
      },
    ]);
  });

  test('treats unmerged pull requests as invalid and falls back to direct commit', () => {
    const compareCommits: CompareCommit[] = [
      {
        sha: 'd4',
        commit: {
          message: 'fix: address crash',
        },
      },
    ];
    const pullRequestsByCommit: Record<string, CommitPullRequest[]> = {
      d4: [
        {
          number: 202,
          title: 'fix: address crash',
          labels: [{ name: 'fix' }],
          merged_at: null,
        },
      ],
    };

    const result = collectReleaseItems(compareCommits, pullRequestsByCommit);

    expect(result.pullRequests).toEqual([]);
    expect(result.directCommits).toEqual([
      {
        sha: 'd4',
        subject: 'fix: address crash',
      },
    ]);
  });

  test('uses only the first line of commit message as direct commit subject', () => {
    const compareCommits: CompareCommit[] = [
      {
        sha: 'e5',
        commit: {
          message: 'docs: update README\n\nExtended details',
        },
      },
    ];

    const result = collectReleaseItems(compareCommits, {});

    expect(result.directCommits).toEqual([
      {
        sha: 'e5',
        subject: 'docs: update README',
      },
    ]);
  });

  test('keeps pull request and direct commit ordering aligned to compare commit order', () => {
    const compareCommits: CompareCommit[] = [
      {
        sha: 'f6',
        commit: {
          message: 'feat: first pr commit',
        },
      },
      {
        sha: 'g7',
        commit: {
          message: 'fix: second pr commit',
        },
      },
      {
        sha: 'h8',
        commit: {
          message: 'chore: direct fallback',
        },
      },
      {
        sha: 'i9',
        commit: {
          message: 'feat: duplicate pr commit',
        },
      },
    ];
    const pullRequestsByCommit: Record<string, CommitPullRequest[]> = {
      f6: [
        {
          number: 300,
          title: 'feat: first pr',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-20T10:00:00Z',
        },
      ],
      g7: [
        {
          number: 299,
          title: 'fix: second pr',
          labels: [{ name: 'fix' }],
          merged_at: '2026-03-21T10:00:00Z',
        },
      ],
      i9: [
        {
          number: 300,
          title: 'feat: first pr',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-20T10:00:00Z',
        },
      ],
    };

    const result = collectReleaseItems(compareCommits, pullRequestsByCommit);

    expect(
      result.pullRequests.map((pullRequest) => pullRequest.number),
    ).toEqual([300, 299]);
    expect(result.directCommits.map((commit) => commit.sha)).toEqual(['h8']);
  });

  test('normalizes pull request labels by keeping only defined names', () => {
    const compareCommits: CompareCommit[] = [
      {
        sha: 'j10',
        commit: {
          message: 'feat: label cleanup',
        },
      },
    ];
    const pullRequestsByCommit: Record<string, CommitPullRequest[]> = {
      j10: [
        {
          number: 500,
          title: 'feat: label cleanup',
          labels: [{ name: 'feat' }, {}, { name: 'release' }],
          merged_at: '2026-03-22T10:00:00Z',
        },
      ],
    };

    const result = collectReleaseItems(compareCommits, pullRequestsByCommit);

    expect(result.pullRequests).toEqual([
      {
        number: 500,
        title: 'feat: label cleanup',
        labels: ['feat', 'release'],
      },
    ]);
  });

  test('selects only one deterministic merged pull request per commit', () => {
    const compareCommits: CompareCommit[] = [
      {
        sha: 'k11',
        commit: {
          message: 'feat: multi-pr commit',
        },
      },
    ];
    const pullRequestsByCommit: Record<string, CommitPullRequest[]> = {
      k11: [
        {
          number: 10,
          title: 'feat: old merge',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-20T10:00:00Z',
        },
        {
          number: 11,
          title: 'feat: newer merge lower number',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-21T10:00:00Z',
        },
        {
          number: 12,
          title: 'feat: newer merge higher number',
          labels: [{ name: 'feature' }],
          merged_at: '2026-03-21T10:00:00Z',
        },
      ],
    };

    const result = collectReleaseItems(compareCommits, pullRequestsByCommit);

    expect(result.pullRequests).toEqual([
      {
        number: 12,
        title: 'feat: newer merge higher number',
        labels: ['feature'],
      },
    ]);
    expect(result.directCommits).toEqual([]);
  });

  test('selected pull request still follows global dedupe and commit order', () => {
    const compareCommits: CompareCommit[] = [
      {
        sha: 'l12',
        commit: {
          message: 'feat: first commit',
        },
      },
      {
        sha: 'm13',
        commit: {
          message: 'feat: duplicate selected pr',
        },
      },
      {
        sha: 'n14',
        commit: {
          message: 'feat: later unique selected pr',
        },
      },
    ];
    const pullRequestsByCommit: Record<string, CommitPullRequest[]> = {
      l12: [
        {
          number: 10,
          title: 'feat: primary first commit',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-21T10:00:00Z',
        },
        {
          number: 9,
          title: 'feat: secondary first commit',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-20T10:00:00Z',
        },
      ],
      m13: [
        {
          number: 10,
          title: 'feat: duplicate selected pr',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-22T10:00:00Z',
        },
        {
          number: 8,
          title: 'feat: non-selected fallback candidate',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-10T10:00:00Z',
        },
      ],
      n14: [
        {
          number: 8,
          title: 'feat: later unique selected pr',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-23T10:00:00Z',
        },
        {
          number: 7,
          title: 'feat: secondary later commit',
          labels: [{ name: 'feat' }],
          merged_at: '2026-03-01T10:00:00Z',
        },
      ],
    };

    const result = collectReleaseItems(compareCommits, pullRequestsByCommit);

    expect(
      result.pullRequests.map((pullRequest) => pullRequest.number),
    ).toEqual([10, 8]);
    expect(result.directCommits).toEqual([]);
  });
});

import type {
  ReleaseChangelogCommit,
  ReleaseChangelogPullRequest,
} from './changelog';

export type CompareCommit = {
  sha: string;
  commit: {
    message: string;
  };
};

export type CommitPullRequest = {
  number: number;
  title: string;
  labels: Array<{ name?: string }>;
  merged_at: string | null;
};

type NormalizedMergedPullRequest = {
  number: number;
  title: string;
  labels: string[];
  mergedAt: string;
};

function getDirectCommitSubject(message: string) {
  return message.split(/\r?\n/)[0] ?? '';
}

function normalizeLabels(labels: Array<{ name?: string }>) {
  return labels.flatMap((label) =>
    typeof label.name === 'string' ? [label.name] : [],
  );
}

function normalizeMergedPullRequests(
  pullRequests: CommitPullRequest[],
): NormalizedMergedPullRequest[] {
  return pullRequests.flatMap((pullRequest) => {
    if (pullRequest.merged_at === null) {
      return [];
    }

    return [
      {
        number: pullRequest.number,
        title: pullRequest.title,
        labels: normalizeLabels(pullRequest.labels),
        mergedAt: pullRequest.merged_at,
      },
    ];
  });
}

function comparePreferredPullRequests(
  left: NormalizedMergedPullRequest,
  right: NormalizedMergedPullRequest,
) {
  const mergedAtComparison = right.mergedAt.localeCompare(left.mergedAt);

  if (mergedAtComparison !== 0) {
    return mergedAtComparison;
  }

  return right.number - left.number;
}

function selectPreferredMergedPullRequest(
  pullRequests: NormalizedMergedPullRequest[],
) {
  if (pullRequests.length === 0) {
    return null;
  }

  return pullRequests.slice().sort(comparePreferredPullRequests)[0];
}

function toReleasePullRequest(
  pullRequest: NormalizedMergedPullRequest,
): ReleaseChangelogPullRequest {
  return {
    number: pullRequest.number,
    title: pullRequest.title,
    labels: pullRequest.labels,
  };
}

function toReleaseCommit(compareCommit: CompareCommit): ReleaseChangelogCommit {
  return {
    sha: compareCommit.sha,
    subject: getDirectCommitSubject(compareCommit.commit.message),
  };
}

export function collectReleaseItems(
  compareCommits: CompareCommit[],
  pullRequestsByCommit: Record<string, CommitPullRequest[] | undefined>,
): {
  pullRequests: ReleaseChangelogPullRequest[];
  directCommits: ReleaseChangelogCommit[];
} {
  const pullRequests: ReleaseChangelogPullRequest[] = [];
  const directCommits: ReleaseChangelogCommit[] = [];
  const seenPullRequestNumbers = new Set<number>();

  for (const compareCommit of compareCommits) {
    const normalizedMergedPullRequests = normalizeMergedPullRequests(
      pullRequestsByCommit[compareCommit.sha] ?? [],
    );
    const preferredPullRequest = selectPreferredMergedPullRequest(
      normalizedMergedPullRequests,
    );

    if (!preferredPullRequest) {
      directCommits.push(toReleaseCommit(compareCommit));
      continue;
    }

    if (seenPullRequestNumbers.has(preferredPullRequest.number)) {
      continue;
    }

    seenPullRequestNumbers.add(preferredPullRequest.number);
    pullRequests.push(toReleasePullRequest(preferredPullRequest));
  }

  return {
    pullRequests,
    directCommits,
  };
}

export type ReleaseChangelogPullRequest = {
  number: number;
  title: string;
  labels: string[];
};

export type ReleaseChangelogCommit = {
  sha: string;
  subject: string;
};

type ChangelogSection =
  | 'Features'
  | 'Fixes'
  | 'Docs'
  | 'Refactors'
  | 'Chores'
  | 'Other';

const SECTION_ORDER: ChangelogSection[] = [
  'Features',
  'Fixes',
  'Docs',
  'Refactors',
  'Chores',
  'Other',
];

const LABEL_TO_SECTION: Record<string, ChangelogSection> = {
  feat: 'Features',
  feature: 'Features',
  fix: 'Fixes',
  bug: 'Fixes',
  docs: 'Docs',
  refactor: 'Refactors',
  chore: 'Chores',
  build: 'Chores',
  ci: 'Chores',
};

const PREFIX_TO_SECTION: Record<string, ChangelogSection> = {
  feat: 'Features',
  fix: 'Fixes',
  docs: 'Docs',
  refactor: 'Refactors',
  chore: 'Chores',
  build: 'Chores',
  ci: 'Chores',
};

const CONVENTIONAL_PREFIX_PATTERN = /^([a-z]+)(\([^)]+\))?(!)?:/;

const LABEL_PRIORITY_ORDER: ChangelogSection[] = SECTION_ORDER.filter(
  (section) => section !== 'Other',
);

function classifyByPrefix(text: string): ChangelogSection | null {
  const match = CONVENTIONAL_PREFIX_PATTERN.exec(text.trim().toLowerCase());

  if (!match) {
    return null;
  }

  return PREFIX_TO_SECTION[match[1]] ?? null;
}

function classifyByLabels(labels: string[]): ChangelogSection | null {
  const matchedSections = new Set<ChangelogSection>();

  for (const rawLabel of labels) {
    const label = rawLabel.trim().toLowerCase();
    const section = LABEL_TO_SECTION[label];

    if (section) {
      matchedSections.add(section);
    }
  }

  for (const section of LABEL_PRIORITY_ORDER) {
    if (matchedSections.has(section)) {
      return section;
    }
  }

  return null;
}

function isPullRequest(
  item: ReleaseChangelogPullRequest | ReleaseChangelogCommit,
): item is ReleaseChangelogPullRequest {
  return 'number' in item;
}

export function classifyChangelogSection(
  item: ReleaseChangelogPullRequest | ReleaseChangelogCommit,
): ChangelogSection {
  if (isPullRequest(item)) {
    return (
      classifyByLabels(item.labels) ?? classifyByPrefix(item.title) ?? 'Other'
    );
  }

  return classifyByPrefix(item.subject) ?? 'Other';
}

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

export function buildChangelogMarkdown({
  pullRequests,
  directCommits,
}: {
  pullRequests: ReleaseChangelogPullRequest[];
  directCommits: ReleaseChangelogCommit[];
}) {
  if (pullRequests.length === 0 && directCommits.length === 0) {
    return 'No categorized pull requests found.';
  }

  const sections: Record<ChangelogSection, string[]> = {
    Features: [],
    Fixes: [],
    Docs: [],
    Refactors: [],
    Chores: [],
    Other: [],
  };

  for (const pullRequest of pullRequests) {
    const section = classifyChangelogSection(pullRequest);
    sections[section].push(`- ${pullRequest.title} (#${pullRequest.number})`);
  }

  for (const directCommit of directCommits) {
    const section = classifyChangelogSection(directCommit);
    sections[section].push(
      `- ${directCommit.subject} (${shortSha(directCommit.sha)})`,
    );
  }

  return SECTION_ORDER.filter((section) => sections[section].length > 0)
    .map((section) => `## ${section}\n\n${sections[section].join('\n')}`)
    .join('\n\n');
}

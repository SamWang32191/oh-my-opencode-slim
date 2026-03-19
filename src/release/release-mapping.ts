type ReleaseMappingSection = {
  mediumVersion: string;
  releaseDate: string;
  upstreamTag: string;
  upstreamCommit: string;
  notes: string;
};

export type ReleaseMappingEntry = {
  mediumVersion: string;
  releaseDate: string;
  upstreamTag: string;
  upstreamCommit: string;
  notes?: string;
};

export const DEFAULT_RELEASE_NOTES = 'No medium-specific changes documented.';

export const RELEASE_MAPPING_HEADER =
  '# Release Mapping\n\n> Maps medium releases to upstream tags and commits.\n';

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const RELEASE_SECTION_PATTERN =
  /^## ([^\n]+)\n\n- Date: (\d{4}-\d{2}-\d{2})\n- Upstream Tag: ([^\n]+)\n- Upstream Commit: ([^\n]+)\n- Notes:\n  - ([^\n]+)\n?$/;

function compareSemverVersions(a: string, b: string) {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    if (aParts[index] !== bParts[index]) {
      return aParts[index] - bParts[index];
    }
  }

  return 0;
}

function isSemver(version: string) {
  return SEMVER_PATTERN.test(version);
}

function parseReleaseMappingContent(currentContent: string) {
  if (!currentContent.startsWith(RELEASE_MAPPING_HEADER)) {
    throw new Error('Release mapping file is malformed.');
  }

  if (!currentContent.endsWith('\n')) {
    throw new Error('Release mapping file is malformed.');
  }

  if (currentContent.endsWith('\n\n')) {
    throw new Error('Release mapping file is malformed.');
  }

  const remainder = currentContent.slice(RELEASE_MAPPING_HEADER.length);

  if (remainder === '') {
    return [];
  }

  if (!remainder.startsWith('\n')) {
    throw new Error('Release mapping file is malformed.');
  }

  const lines = remainder.slice(1).split('\n');

  if (lines.length === 1 && lines[0] === '') {
    return [];
  }

  const parsedSections: ReleaseMappingSection[] = [];
  const seenVersions = new Set<string>();
  let index = 0;

  while (index < lines.length) {
    if (lines[index] === '') {
      if (index === lines.length - 1) {
        break;
      }

      throw new Error('Release mapping file is malformed.');
    }

    if (index + 6 >= lines.length) {
      throw new Error('Release mapping file is malformed.');
    }

    const section = [
      lines[index],
      lines[index + 1],
      lines[index + 2],
      lines[index + 3],
      lines[index + 4],
      lines[index + 5],
      lines[index + 6],
    ].join('\n');
    const match = RELEASE_SECTION_PATTERN.exec(section);

    if (!match || !isSemver(match[1])) {
      throw new Error('Release mapping file is malformed.');
    }

    if (seenVersions.has(match[1])) {
      throw new Error('Release mapping file is malformed.');
    }

    seenVersions.add(match[1]);
    parsedSections.push({
      mediumVersion: match[1],
      releaseDate: match[2],
      upstreamTag: match[3],
      upstreamCommit: match[4],
      notes: match[5],
    });

    index += 7;

    if (index < lines.length) {
      if (lines[index] !== '') {
        throw new Error('Release mapping file is malformed.');
      }

      index += 1;
    }
  }

  return parsedSections;
}

function formatReleaseMappingSection(entry: ReleaseMappingSection) {
  return [
    `## ${entry.mediumVersion}`,
    '',
    `- Date: ${entry.releaseDate}`,
    `- Upstream Tag: ${entry.upstreamTag}`,
    `- Upstream Commit: ${entry.upstreamCommit}`,
    '- Notes:',
    `  - ${entry.notes}`,
  ].join('\n');
}

export function upsertReleaseMapping(
  currentContent: string,
  entry: ReleaseMappingEntry,
) {
  const existingEntries = parseReleaseMappingContent(currentContent);

  if (
    existingEntries.some(
      (section) => section.mediumVersion === entry.mediumVersion,
    )
  ) {
    throw new Error(
      `Release mapping already contains version ${entry.mediumVersion}.`,
    );
  }

  const notes = entry.notes ?? DEFAULT_RELEASE_NOTES;
  const nextEntries = [
    ...existingEntries,
    {
      mediumVersion: entry.mediumVersion,
      releaseDate: entry.releaseDate,
      upstreamTag: entry.upstreamTag,
      upstreamCommit: entry.upstreamCommit,
      notes,
    },
  ].sort((left, right) =>
    compareSemverVersions(right.mediumVersion, left.mediumVersion),
  );

  return (
    `${RELEASE_MAPPING_HEADER}\n` +
    nextEntries.map(formatReleaseMappingSection).join('\n\n') +
    '\n'
  );
}

export function formatGithubReleaseBody({
  mediumVersion,
  upstreamTag,
  upstreamCommit,
  notes,
}: Pick<
  ReleaseMappingEntry,
  'mediumVersion' | 'upstreamTag' | 'upstreamCommit' | 'notes'
>) {
  const releaseNotes = notes ?? DEFAULT_RELEASE_NOTES;

  return [
    `## ${mediumVersion}`,
    '',
    `Based on upstream ${upstreamTag} (${upstreamCommit})`,
    '',
    '### Medium-specific changes',
    `- ${releaseNotes}`,
  ].join('\n');
}

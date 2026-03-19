const STABLE_RELEASE_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;
const STABLE_RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function validateRequestedReleaseVersion(version: string) {
  if (!STABLE_RELEASE_VERSION_PATTERN.test(version)) {
    throw new Error(
      'Release version must be stable semver in X.Y.Z form.',
    );
  }

  return version;
}

export function parseStableReleaseTag(tag: string) {
  const match = STABLE_RELEASE_TAG_PATTERN.exec(tag);

  if (!match) {
    return null;
  }

  return {
    version: match[1],
  };
}

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

export function getLatestReachableStableUpstreamVersion(tags: string[]) {
  const versions = tags
    .map(parseStableReleaseTag)
    .filter((tag): tag is { version: string } => tag !== null)
    .map((tag) => tag.version)
    .sort(compareSemverVersions);

  return versions.at(-1) ?? null;
}

export function buildMediumReleasePlan({
  requestedVersion,
  reachableUpstreamTags,
}: {
  requestedVersion: string;
  reachableUpstreamTags: string[];
}) {
  const packageVersion = validateRequestedReleaseVersion(requestedVersion);
  const upstreamVersion = getLatestReachableStableUpstreamVersion(
    reachableUpstreamTags,
  );

  if (!upstreamVersion) {
    throw new Error('No stable upstream tag reachable from HEAD.');
  }

  return {
    packageVersion,
    gitTag: `v${packageVersion}`,
    upstreamTag: `v${upstreamVersion}`,
    releaseCommitMessage: `chore: release ${packageVersion}`,
  };
}

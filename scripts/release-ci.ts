#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildChangelogMarkdown } from '../src/release/changelog';
import {
  type CommitPullRequest,
  type CompareCommit,
  collectReleaseItems,
} from '../src/release/github-release-data';
import {
  buildMediumReleasePlan,
  validateRequestedReleaseVersion,
} from '../src/release/medium-version';
import {
  assertSingleLineReleaseNotes,
  DEFAULT_RELEASE_NOTES,
  formatGithubReleaseBody,
  getHighestMappedReleaseVersion,
  RELEASE_MAPPING_HEADER,
  upsertReleaseMapping,
} from '../src/release/release-mapping';
import { deriveReachableUpstreamTags, normalizeRemoteTagRefs } from './release';

type PackageJson = {
  version?: string;
  [key: string]: unknown;
};

type ReleaseCiArgs = {
  requestedVersion: string;
  bodyFile: string;
  notes?: string;
  dryRun: boolean;
};

type CompareResponse = {
  total_commits?: number;
  commits?: CompareCommit[];
};

type UpstreamRemoteState = {
  previousUpstreamUrl: string | null;
};

const DEFAULT_GITHUB_RELEASE_REPO = 'SamWang32191/oh-my-opencode-medium';

function runCommand(command: string, args: string[], errorMessage: string) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stderr = result.stderr ?? '';
  const stdout = result.stdout ?? '';

  if (result.status !== 0) {
    const details = stderr.trim() || stdout.trim();
    throw new Error(details ? `${errorMessage}\n${details}` : errorMessage);
  }

  return stdout.trim();
}

function runGitCommand(args: string[], errorMessage: string) {
  return runCommand('git', args, errorMessage);
}

function runJsonCommand<T>(
  command: string,
  args: string[],
  errorMessage: string,
) {
  const output = runCommand(command, args, errorMessage);

  try {
    return JSON.parse(output) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${errorMessage}\n${message}`);
  }
}

function runGhApi<T>(endpoint: string, errorMessage: string) {
  return runJsonCommand<T>(
    'gh',
    ['api', '-H', 'Accept: application/vnd.github+json', endpoint],
    errorMessage,
  );
}

export function parseReleaseCiArgs(args: string[]): ReleaseCiArgs {
  let requestedVersion: string | undefined;
  let bodyFile: string | undefined;
  let notes: string | undefined;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--version') {
      const value = args[index + 1];

      if (!value || value.startsWith('--')) {
        throw new Error('Missing required --version X.Y.Z argument.');
      }

      requestedVersion = value;
      index += 1;
      continue;
    }

    if (arg === '--body-file') {
      const value = args[index + 1];

      if (!value || value.startsWith('--')) {
        throw new Error('Missing required --body-file <path> argument.');
      }

      bodyFile = value;
      index += 1;
      continue;
    }

    if (arg === '--notes') {
      const value = args[index + 1];

      if (value === undefined || value.startsWith('--')) {
        throw new Error('Missing value for --notes.');
      }

      notes = assertSingleLineReleaseNotes(value);
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!requestedVersion) {
    throw new Error('Missing required --version X.Y.Z argument.');
  }

  if (!bodyFile) {
    throw new Error('Missing required --body-file <path> argument.');
  }

  return {
    requestedVersion: validateRequestedReleaseVersion(requestedVersion),
    bodyFile,
    notes,
    dryRun,
  };
}

export function shouldMutateReleaseState(dryRun: boolean) {
  return !dryRun;
}

export function resolveGithubReleaseRepo(env: NodeJS.ProcessEnv = process.env) {
  const githubRepository = env.GITHUB_REPOSITORY?.trim();
  return githubRepository === undefined || githubRepository === ''
    ? DEFAULT_GITHUB_RELEASE_REPO
    : githubRepository;
}

export function buildCompareEndpoint({
  base,
  head,
  githubRepository,
}: {
  base: string;
  head: string;
  githubRepository: string;
}) {
  return `repos/${githubRepository}/compare/${base}...${head}`;
}

export function shouldWriteReleaseBodyFile(path: string) {
  return path.trim() !== '' && path !== '-';
}

export function buildUpstreamRemoteRestoreArgs(
  previousUpstreamUrl: string | null,
) {
  if (previousUpstreamUrl === null) {
    return ['remote', 'remove', 'upstream'];
  }

  return ['remote', 'set-url', 'upstream', previousUpstreamUrl];
}

export function assertCompareResponseComplete({
  totalCommits,
  loadedCommitCount,
}: {
  totalCommits: number | undefined;
  loadedCommitCount: number;
}) {
  if (typeof totalCommits === 'number' && totalCommits > loadedCommitCount) {
    throw new Error(
      `GitHub compare API response is truncated (${loadedCommitCount}/${totalCommits} commits loaded). Narrow the compare range or add paginated commit fetching before generating changelog.`,
    );
  }
}

export function determineCompareBaseAndHead({
  previousReleaseTag,
  currentHeadCommit,
}: {
  previousReleaseTag: string | null;
  currentHeadCommit: string;
}) {
  return {
    base: previousReleaseTag ?? currentHeadCommit,
    head: currentHeadCommit,
  };
}

function ensureOnMediumBranch() {
  const branchName = runGitCommand(
    ['symbolic-ref', '--short', 'HEAD'],
    'Release CI script must run from the medium branch.',
  );

  if (branchName !== 'medium') {
    throw new Error(
      `Release CI script must run from the medium branch. Current branch: ${branchName}`,
    );
  }
}

function ensureCleanWorkingTree() {
  const statusOutput = runGitCommand(
    ['status', '--porcelain'],
    'Failed to read working tree status.',
  );

  if (statusOutput !== '') {
    throw new Error('Working tree must be clean before releasing medium.');
  }
}

function getCurrentUpstreamRemoteUrl() {
  const remoteResult = spawnSync('git', ['remote', 'get-url', 'upstream'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (remoteResult.status !== 0) {
    return null;
  }

  const upstreamRemoteUrl = (remoteResult.stdout ?? '').trim();
  return upstreamRemoteUrl === '' ? null : upstreamRemoteUrl;
}

function configureUpstreamRemote(
  upstreamRemoteUrl: string,
): UpstreamRemoteState {
  const previousUpstreamUrl = getCurrentUpstreamRemoteUrl();

  if (previousUpstreamUrl !== null) {
    runGitCommand(
      ['remote', 'set-url', 'upstream', upstreamRemoteUrl],
      "Failed to reset 'upstream' remote URL.",
    );
    return { previousUpstreamUrl };
  }

  runGitCommand(
    ['remote', 'add', 'upstream', upstreamRemoteUrl],
    "Failed to create 'upstream' remote.",
  );

  return { previousUpstreamUrl };
}

function restoreUpstreamRemote(state: UpstreamRemoteState) {
  const restoreArgs = buildUpstreamRemoteRestoreArgs(state.previousUpstreamUrl);
  const restoreErrorMessage =
    state.previousUpstreamUrl === null
      ? "Failed to remove temporary 'upstream' remote."
      : "Failed to restore original 'upstream' remote URL.";

  runGitCommand(restoreArgs, restoreErrorMessage);
}

function fetchRemotesAndTags() {
  runGitCommand(
    ['fetch', 'origin', '--prune', '--tags'],
    'Failed to fetch origin tags.',
  );
  runGitCommand(
    ['fetch', 'upstream', '--prune', '--tags'],
    'Failed to fetch upstream tags.',
  );
}

function getNormalizedUpstreamTags() {
  const output = runGitCommand(
    ['ls-remote', '--tags', '--refs', 'upstream', 'v*'],
    'Failed to list upstream tags.',
  );

  return normalizeRemoteTagRefs(output);
}

function getReachableTags() {
  const output = runGitCommand(
    ['tag', '--merged', 'HEAD', '--list'],
    'Failed to list reachable tags.',
  );

  return output === '' ? [] : output.split('\n');
}

function getCommitForTag(tagName: string) {
  const commit = runGitCommand(
    ['rev-list', '-n', '1', tagName],
    `Failed to resolve commit for ${tagName}.`,
  );

  if (commit === '') {
    throw new Error(`Failed to resolve commit for ${tagName}.`);
  }

  return commit;
}

function getCurrentHeadCommit() {
  const commit = runGitCommand(
    ['rev-parse', 'HEAD'],
    'Failed to resolve current medium HEAD commit.',
  );

  if (commit === '') {
    throw new Error('Failed to resolve current medium HEAD commit.');
  }

  return commit;
}

function ensureTagDoesNotExist(tagName: string) {
  const existingTag = runGitCommand(
    ['tag', '--list', tagName],
    `Failed to check whether tag ${tagName} exists.`,
  );

  if (existingTag !== '') {
    throw new Error(`Tag already exists: ${tagName}`);
  }
}

function readPackageJson() {
  try {
    return JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse package.json\n${message}`);
  }
}

function writePackageVersion(packageVersion: string) {
  try {
    const packageJson = readPackageJson();
    packageJson.version = packageVersion;
    writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write package.json\n${message}`);
  }
}

function readReleaseMappingContent() {
  if (!existsSync('docs/release-mapping.md')) {
    return RELEASE_MAPPING_HEADER;
  }

  try {
    return readFileSync('docs/release-mapping.md', 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read docs/release-mapping.md\n${message}`);
  }
}

function writeReleaseMapping(content: string) {
  try {
    writeFileSync('docs/release-mapping.md', content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write docs/release-mapping.md\n${message}`);
  }
}

function fetchCompareCommits(
  base: string,
  head: string,
  githubRepository: string,
) {
  const response = runGhApi<CompareResponse>(
    buildCompareEndpoint({
      base,
      head,
      githubRepository,
    }),
    'Failed to load compare data from GitHub API.',
  );

  const commits = response.commits ?? [];

  assertCompareResponseComplete({
    totalCommits: response.total_commits,
    loadedCommitCount: commits.length,
  });

  return commits;
}

function fetchPullRequestsForCommit(
  commitSha: string,
  githubRepository: string,
) {
  return runGhApi<CommitPullRequest[]>(
    `repos/${githubRepository}/commits/${commitSha}/pulls`,
    `Failed to load pull requests for commit ${commitSha}.`,
  );
}

function stageReleaseFiles() {
  runGitCommand(['add', 'package.json'], 'Failed to stage package.json.');
  runGitCommand(
    ['add', 'docs/release-mapping.md'],
    'Failed to stage docs/release-mapping.md.',
  );
}

function commitRelease(version: string) {
  runGitCommand(
    ['commit', '-m', `chore: release ${version}`],
    `Failed to commit release ${version}.`,
  );
}

function createAnnotatedTag(tagName: string) {
  runGitCommand(
    ['tag', '-a', tagName, '-m', `medium release ${tagName}`],
    `Failed to create annotated tag ${tagName}.`,
  );
}

function writeReleaseBodyFile(bodyFile: string, releaseBody: string) {
  if (!shouldWriteReleaseBodyFile(bodyFile)) {
    throw new Error('Release body file path must be a writable file path.');
  }

  const parentDirectory = dirname(bodyFile);

  if (parentDirectory !== '' && !existsSync(parentDirectory)) {
    mkdirSync(parentDirectory, { recursive: true });
  }

  writeFileSync(bodyFile, `${releaseBody}\n`);
}

function getRequiredUpstreamRemoteUrl() {
  const upstreamRemoteUrl = process.env.UPSTREAM_REMOTE_URL;

  if (!upstreamRemoteUrl || upstreamRemoteUrl.trim() === '') {
    throw new Error('Missing required env: UPSTREAM_REMOTE_URL');
  }

  return upstreamRemoteUrl;
}

export function runReleaseCi(args = parseReleaseCiArgs(process.argv.slice(2))) {
  ensureOnMediumBranch();
  ensureCleanWorkingTree();

  const upstreamRemoteUrl = getRequiredUpstreamRemoteUrl();
  const githubRepository = resolveGithubReleaseRepo();
  const upstreamRemoteState = configureUpstreamRemote(upstreamRemoteUrl);

  try {
    fetchRemotesAndTags();

    const currentMappingContent = readReleaseMappingContent();
    const highestMappedVersion = getHighestMappedReleaseVersion(
      currentMappingContent,
    );
    const normalizedUpstreamTags = getNormalizedUpstreamTags();
    const reachableTags = getReachableTags();
    const reachableUpstreamTags = deriveReachableUpstreamTags(
      normalizedUpstreamTags,
      reachableTags,
    );
    const releasePlan = buildMediumReleasePlan({
      requestedVersion: args.requestedVersion,
      reachableUpstreamTags,
      highestMappedVersion,
    });
    const upstreamCommit = getCommitForTag(releasePlan.upstreamTag);
    const releaseDate = new Date().toISOString().slice(0, 10);
    const notes = args.notes ?? DEFAULT_RELEASE_NOTES;
    const provenanceBlock = formatGithubReleaseBody({
      mediumVersion: releasePlan.packageVersion,
      upstreamTag: releasePlan.upstreamTag,
      upstreamCommit,
      notes,
    });
    const currentHeadCommit = getCurrentHeadCommit();
    const previousReleaseTag =
      highestMappedVersion === null ? null : `v${highestMappedVersion}`;
    const compareRange = determineCompareBaseAndHead({
      previousReleaseTag,
      currentHeadCommit,
    });
    const compareCommits = fetchCompareCommits(
      compareRange.base,
      compareRange.head,
      githubRepository,
    );
    const pullRequestsByCommit: Record<string, CommitPullRequest[]> = {};

    for (const compareCommit of compareCommits) {
      pullRequestsByCommit[compareCommit.sha] = fetchPullRequestsForCommit(
        compareCommit.sha,
        githubRepository,
      );
    }

    const releaseItems = collectReleaseItems(
      compareCommits,
      pullRequestsByCommit,
    );
    const changelogMarkdown = buildChangelogMarkdown(releaseItems);
    const releaseBody = [
      provenanceBlock,
      '',
      '### Upstream changelog',
      '',
      changelogMarkdown,
    ].join('\n');
    ensureTagDoesNotExist(releasePlan.gitTag);

    writeReleaseBodyFile(args.bodyFile, releaseBody);

    if (shouldMutateReleaseState(args.dryRun)) {
      writePackageVersion(releasePlan.packageVersion);

      const nextMappingContent = upsertReleaseMapping(currentMappingContent, {
        mediumVersion: releasePlan.packageVersion,
        releaseDate,
        upstreamTag: releasePlan.upstreamTag,
        upstreamCommit,
        notes,
      });

      writeReleaseMapping(nextMappingContent);
      stageReleaseFiles();
      commitRelease(releasePlan.packageVersion);
      createAnnotatedTag(releasePlan.gitTag);

      console.log(`Updated package.json to ${releasePlan.packageVersion}`);
      console.log('Updated docs/release-mapping.md');
      console.log(`Created tag ${releasePlan.gitTag}`);
      console.log('Prepared local release commit and tag');
    } else {
      console.log('Dry run enabled: skipped release state mutations');
      console.log('Dry run enabled: skipped local commit/tag creation');
    }

    console.log(`Wrote release body to ${args.bodyFile}`);
  } finally {
    restoreUpstreamRemote(upstreamRemoteState);
  }
}

try {
  if (import.meta.main) {
    runReleaseCi();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

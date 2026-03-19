#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  buildMediumReleasePlan,
  validateRequestedReleaseVersion,
} from '../src/release/medium-version';
import {
  DEFAULT_RELEASE_NOTES,
  RELEASE_MAPPING_HEADER,
  formatGithubReleaseBody,
  upsertReleaseMapping,
} from '../src/release/release-mapping';

type PackageJson = {
  version?: string;
  [key: string]: unknown;
};

type ReleaseArgs = {
  requestedVersion: string;
  dryRun: boolean;
  notes?: string;
};

type ReleasePlanDetails = ReturnType<typeof buildMediumReleasePlan> & {
  upstreamCommit: string;
  releaseDate: string;
  notes: string;
  releaseBody: string;
};

function runGitCommand(args: string[], errorMessage: string) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const details = result.stderr.trim() || result.stdout.trim();
    throw new Error(details ? `${errorMessage}\n${details}` : errorMessage);
  }

  return result.stdout.trim();
}

export function parseReleaseArgs(args: string[]): ReleaseArgs {
  let requestedVersion: string | undefined;
  let dryRun = false;
  let notes: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--version') {
      const value = args[index + 1];

      if (!value || value.startsWith('--')) {
        throw new Error('Missing required --version X.Y.Z argument.');
      }

      requestedVersion = value;
      index += 1;
      continue;
    }

    if (arg === '--notes') {
      const value = args[index + 1];

      if (value === undefined || value.startsWith('--')) {
        throw new Error('Missing value for --notes.');
      }

      notes = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!requestedVersion) {
    throw new Error('Missing required --version X.Y.Z argument.');
  }

  return {
    requestedVersion: validateRequestedReleaseVersion(requestedVersion),
    dryRun,
    notes,
  };
}

export function normalizeRemoteTagRefs(output: string) {
  if (output === '') {
    return [];
  }

  return output
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.replace(/\r$/, ''))
    .map((line) => {
      const parts = line.split('\t');

      if (parts.length !== 2 || !parts[1].startsWith('refs/tags/')) {
        throw new Error(`Unexpected git ls-remote output: ${line}`);
      }

      return parts[1].slice('refs/tags/'.length);
    });
}

export function deriveReachableUpstreamTags(
  upstreamTags: string[],
  reachableTags: string[],
) {
  const reachableTagSet = new Set(reachableTags);
  return upstreamTags.filter((tag) => reachableTagSet.has(tag));
}

export function shouldFetchUpstreamTags(dryRun: boolean) {
  return !dryRun;
}

function ensureUpstreamRemoteExists() {
  runGitCommand(
    ['remote', 'get-url', 'upstream'],
    "Remote 'upstream' is not configured.",
  );
}

function ensureOnMediumBranch() {
  const branchName = runGitCommand(
    ['symbolic-ref', '--short', 'HEAD'],
    'Release script must run from the medium branch.',
  );

  if (branchName !== 'medium') {
    throw new Error(
      `Release script must run from the medium branch. Current branch: ${branchName}`,
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

function fetchUpstreamTags() {
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

function ensureTagDoesNotExist(tagName: string) {
  const existingTag = runGitCommand(
    ['tag', '--list', tagName],
    `Failed to check whether tag ${tagName} exists.`,
  );

  if (existingTag !== '') {
    throw new Error(`Tag already exists: ${tagName}`);
  }
}

function createAnnotatedTag(tagName: string) {
  runGitCommand(
    ['tag', '-a', tagName, '-m', `medium release ${tagName}`],
    `Failed to create annotated tag ${tagName}.`,
  );
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

function stageReleaseFiles() {
  runGitCommand(
    ['add', 'package.json'],
    'Failed to stage package.json for release.',
  );
  runGitCommand(
    ['add', 'docs/release-mapping.md'],
    'Failed to stage docs/release-mapping.md for release.',
  );
}

function commitRelease(version: string) {
  runGitCommand(
    ['commit', '-m', `chore: release ${version}`],
    `Failed to commit release ${version}.`,
  );
}

function buildReleasePlanDetails(args: ReleaseArgs): ReleasePlanDetails {
  const normalizedUpstreamTags = getNormalizedUpstreamTags();
  const reachableTags = getReachableTags();
  const reachableUpstreamTags = deriveReachableUpstreamTags(
    normalizedUpstreamTags,
    reachableTags,
  );
  const releasePlan = buildMediumReleasePlan({
    requestedVersion: args.requestedVersion,
    reachableUpstreamTags,
  });
  const upstreamCommit = getCommitForTag(releasePlan.upstreamTag);
  const releaseDate = new Date().toISOString().slice(0, 10);
  const notes = args.notes ?? DEFAULT_RELEASE_NOTES;
  const releaseBody = formatGithubReleaseBody({
    mediumVersion: releasePlan.packageVersion,
    upstreamTag: releasePlan.upstreamTag,
    upstreamCommit,
    notes,
  });

  return {
    ...releasePlan,
    upstreamCommit,
    releaseDate,
    notes,
    releaseBody,
  };
}

function printDryRun(plan: ReleasePlanDetails) {
  console.log(`Package version: ${plan.packageVersion}`);
  console.log(`Git tag: ${plan.gitTag}`);
  console.log(`Upstream tag: ${plan.upstreamTag}`);
  console.log(`Upstream commit: ${plan.upstreamCommit}`);
  console.log('');
  console.log('GitHub Release body:');
  console.log(plan.releaseBody);
}

function runRelease(args: ReleaseArgs) {
  ensureUpstreamRemoteExists();
  ensureOnMediumBranch();
  ensureCleanWorkingTree();

  if (shouldFetchUpstreamTags(args.dryRun)) {
    fetchUpstreamTags();
  }

  const plan = buildReleasePlanDetails(args);
  ensureTagDoesNotExist(plan.gitTag);

  if (args.dryRun) {
    printDryRun(plan);
    return;
  }

  writePackageVersion(plan.packageVersion);

  const currentMappingContent = readReleaseMappingContent();
  const nextMappingContent = upsertReleaseMapping(currentMappingContent, {
    mediumVersion: plan.packageVersion,
    releaseDate: plan.releaseDate,
    upstreamTag: plan.upstreamTag,
    upstreamCommit: plan.upstreamCommit,
    notes: plan.notes,
  });

  writeReleaseMapping(nextMappingContent);
  stageReleaseFiles();
  commitRelease(plan.packageVersion);
  createAnnotatedTag(plan.gitTag);

  console.log(`Updated package.json to ${plan.packageVersion}`);
  console.log(`Updated docs/release-mapping.md`);
  console.log(`Created tag ${plan.gitTag}`);
}

try {
  if (import.meta.main) {
    runRelease(parseReleaseArgs(process.argv.slice(2)));
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

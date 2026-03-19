# Medium Release Versioning Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fork's prerelease-style `<upstream>-medium.N` release scheme with stable fork-owned semver releases published to npm `latest`, while recording upstream provenance in a mapping document and GitHub Release body output.

**Architecture:** Keep git-facing orchestration in the existing release entry script and move deterministic rules into small helper modules. One helper module owns semver/tag/provenance logic, another owns `docs/release-mapping.md` and GitHub Release body formatting, and the script stitches git state, file updates, commit/tag creation, and dry-run output together.

**Tech Stack:** Bun, TypeScript, Bun test, git CLI, GitHub Actions, npm Trusted Publisher, Markdown docs

---

## File Map

- Modify: `src/release/medium-version.ts` - replace old upstream-derived fork version logic with stable release helpers: stable tag parsing, semver comparison, requested-version validation, and reachable-upstream provenance selection
- Modify: `src/release/medium-version.test.ts` - TDD coverage for the new pure release logic
- Create: `src/release/release-mapping.ts` - deterministic `docs/release-mapping.md` section update helpers and GitHub Release body formatter
- Create: `src/release/release-mapping.test.ts` - tests for mapping section ordering, duplicate protection, date formatting assumptions, and release body output
- Modify: `scripts/release-medium.ts` - require `--version`, support `--dry-run`, intersect upstream remote tags with tags reachable from `HEAD`, update `package.json`, update the mapping document, commit, tag, and print release metadata
- Modify: `package.json` - rename scripts to `release` and `release:dry`, keep the script target pointed at `scripts/release-medium.ts`, and leave the current package version unchanged until an actual release is created
- Modify: `src/package-json.test.ts` - assert the renamed package scripts
- Modify: `.github/workflows/release.yml` - trigger on stable release tags, validate `vX.Y.Z`, and publish to npm `latest` without `--tag medium`
- Modify: `docs/medium-release.md` - rewrite the SOP for stable versions, explicit `--version`, dry runs, mapping updates, and manual GitHub Release creation
- Create: `docs/release-mapping.md` - committed mapping document with deterministic header/template for future release entries

## Chunk 1: Pure Release Logic

### Task 1: Rework stable release helper tests before touching implementation

**Files:**
- Modify: `src/release/medium-version.test.ts`
- Modify: `src/release/medium-version.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'bun:test';
import {
  buildMediumReleasePlan,
  getLatestReachableStableUpstreamVersion,
  parseStableReleaseTag,
  validateRequestedReleaseVersion,
} from './medium-version';

describe('validateRequestedReleaseVersion', () => {
  test('accepts exact stable semver', () => {
    expect(validateRequestedReleaseVersion('1.0.0')).toBe('1.0.0');
  });

  test('rejects prerelease versions', () => {
    expect(() => validateRequestedReleaseVersion('1.0.0-rc.1')).toThrow(
      'Release version must be stable semver in X.Y.Z form.',
    );
  });
});

test('parses a stable release tag', () => {
  expect(parseStableReleaseTag('v1.2.3')).toEqual({
    version: '1.2.3',
  });
});

test('selects the highest reachable stable upstream version by semver', () => {
  expect(
    getLatestReachableStableUpstreamVersion([
      'v0.8.9',
      'v0.10.0',
      'v0.10.0-rc.1',
      'v1.0',
    ]),
  ).toBe('0.10.0');
});

test('builds a stable release plan from explicit version input', () => {
  expect(
    buildMediumReleasePlan({
      requestedVersion: '1.0.0',
      reachableUpstreamTags: ['v0.8.2', 'v0.8.3'],
    }),
  ).toEqual({
    packageVersion: '1.0.0',
    gitTag: 'v1.0.0',
    upstreamTag: 'v0.8.3',
    releaseCommitMessage: 'chore: release 1.0.0',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/release/medium-version.test.ts`
Expected: FAIL because the new exports do not exist and the old `-medium.N` behavior still drives the module.

- [ ] **Step 3: Write the minimal implementation**

Implement these rules in `src/release/medium-version.ts`:

```ts
const STABLE_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;
const STABLE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function validateRequestedReleaseVersion(version: string) {
  if (!STABLE_VERSION_PATTERN.test(version)) {
    throw new Error('Release version must be stable semver in X.Y.Z form.');
  }

  return version;
}

export function parseStableReleaseTag(tag: string) {
  const match = STABLE_TAG_PATTERN.exec(tag);
  return match ? { version: match[1] } : null;
}

export function getLatestReachableStableUpstreamVersion(tags: string[]) {
  // Filter exact vX.Y.Z tags only, compare numerically, return highest version.
}

export function buildMediumReleasePlan({
  requestedVersion,
  reachableUpstreamTags,
}: {
  requestedVersion: string;
  reachableUpstreamTags: string[];
}) {
  const packageVersion = validateRequestedReleaseVersion(requestedVersion);
  const upstreamVersion =
    getLatestReachableStableUpstreamVersion(reachableUpstreamTags);

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/release/medium-version.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/release/medium-version.ts src/release/medium-version.test.ts
git commit -m "refactor: switch release helpers to stable semver"
```

## Chunk 2: Mapping Document and Release Body Helpers

### Task 2: Add deterministic mapping and release-body tests first

**Files:**
- Create: `src/release/release-mapping.ts`
- Create: `src/release/release-mapping.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_RELEASE_NOTES,
  formatGithubReleaseBody,
  upsertReleaseMapping,
} from './release-mapping';

const EMPTY_MAPPING = `# Release Mapping

> Maps medium releases to upstream tags and commits.
`;

describe('upsertReleaseMapping', () => {
  test('inserts newest version section first', () => {
    const current = `${EMPTY_MAPPING}

## 1.0.0

- Date: 2026-03-19
- Upstream Tag: v0.8.3
- Upstream Commit: abc1234
- Notes:
  - Initial stable release
`;

    expect(
      upsertReleaseMapping(current, {
        mediumVersion: '1.0.1',
        releaseDate: '2026-03-20',
        upstreamTag: 'v0.8.3',
        upstreamCommit: 'def5678',
        notes: 'Patch release',
      }),
    ).toMatch(/## 1\.0\.1[\s\S]*## 1\.0\.0/);
  });

  test('rejects duplicate medium versions', () => {
    expect(() =>
      upsertReleaseMapping(
        `${EMPTY_MAPPING}

## 1.0.0

- Date: 2026-03-19
- Upstream Tag: v0.8.3
- Upstream Commit: abc1234
- Notes:
  - Initial
`,
        {
          mediumVersion: '1.0.0',
          releaseDate: '2026-03-20',
          upstreamTag: 'v0.8.4',
          upstreamCommit: 'def5678',
          notes: 'Duplicate',
        },
      ),
    ).toThrow('Release mapping already contains version 1.0.0.');
  });
});

test('formats copy-paste-ready GitHub Release body', () => {
  expect(
    formatGithubReleaseBody({
      mediumVersion: '1.0.0',
      upstreamTag: 'v0.8.3',
      upstreamCommit: 'abc1234',
      notes: 'Initial stable release',
    }),
  ).toContain('Based on upstream v0.8.3 (abc1234)');
});

test('omits the changes list when notes are empty', () => {
  expect(
    formatGithubReleaseBody({
      mediumVersion: '1.0.0',
      upstreamTag: 'v0.8.3',
      upstreamCommit: 'abc1234',
      notes: DEFAULT_RELEASE_NOTES,
    }),
  ).toContain('### Medium-specific changes');
});

test('rejects malformed mapping content', () => {
  expect(() =>
    upsertReleaseMapping('not canonical markdown', {
      mediumVersion: '1.0.1',
      releaseDate: '2026-03-20',
      upstreamTag: 'v0.8.3',
      upstreamCommit: 'def5678',
      notes: 'Patch release',
    }),
  ).toThrow('Release mapping file is malformed.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/release/release-mapping.test.ts`
Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Implement `src/release/release-mapping.ts` with:

```ts
type ReleaseMappingEntry = {
  mediumVersion: string;
  releaseDate: string;
  upstreamTag: string;
  upstreamCommit: string;
  notes?: string;
};

export const DEFAULT_RELEASE_NOTES = 'No medium-specific changes documented.';

export const RELEASE_MAPPING_HEADER = `# Release Mapping

> Maps medium releases to upstream tags and commits.
`;

export function upsertReleaseMapping(
  currentContent: string,
  entry: ReleaseMappingEntry,
) {
  // Validate the canonical header and section structure first.
  // If the file is malformed or non-canonical, throw
  // "Release mapping file is malformed."
  // Otherwise parse ## <version> sections, reject duplicate versions, insert by
  // semver descending, and return normalized markdown ending with a trailing
  // newline.
}

export function formatGithubReleaseBody(entry: {
  mediumVersion: string;
  upstreamTag: string;
  upstreamCommit: string;
  notes?: string;
}) {
  const notes = entry.notes ?? DEFAULT_RELEASE_NOTES;

  return [
    `## ${entry.mediumVersion}`,
    '',
    `Based on upstream ${entry.upstreamTag} (${entry.upstreamCommit})`,
    '',
    '### Medium-specific changes',
    `- ${notes}`,
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/release/release-mapping.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/release/release-mapping.ts src/release/release-mapping.test.ts
git commit -m "feat: add release mapping helpers"
```

## Chunk 3: Release Script and Package Scripts

### Task 3: Drive the release script through CLI-facing tests and then implement it

**Files:**
- Modify: `scripts/release-medium.ts`
- Modify: `package.json`
- Modify: `src/package-json.test.ts`
- Modify: `src/release/medium-version.ts`
- Modify: `src/release/release-mapping.ts`

- [ ] **Step 1: Write the failing package metadata assertions**

Update `src/package-json.test.ts` to assert:

```ts
expect(packageJson.scripts?.release).toBe('bun run scripts/release-medium.ts');
expect(packageJson.scripts?.['release:dry']).toBe(
  'bun run scripts/release-medium.ts --dry-run',
);
expect(packageJson.scripts?.['release:medium']).toBeUndefined();
expect(packageJson.scripts?.['release:medium:dry']).toBeUndefined();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/package-json.test.ts`
Expected: FAIL because `package.json` still exposes `release:medium` scripts.

- [ ] **Step 3: Update `package.json` scripts**

Change only the release script names:

```json
{
  "scripts": {
    "release": "bun run scripts/release-medium.ts",
    "release:dry": "bun run scripts/release-medium.ts --dry-run"
  }
}
```

Leave the current `"version": "0.8.3-medium.7"` unchanged in this implementation
pass. The next real release command will write `1.0.0` when used.

- [ ] **Step 4: Re-run the metadata test**

Run: `bun test src/package-json.test.ts`
Expected: PASS

- [ ] **Step 5: Add the script behavior tests**

Before editing `scripts/release-medium.ts`, add or extend helper seams so the
script can be exercised through pure functions. Target these behaviors:

```ts
test('rejects missing --version input', () => {
  expect(() => parseReleaseArgs([])).toThrow(
    'Missing required --version X.Y.Z.',
  );
});

test('accepts --dry-run with explicit version', () => {
  expect(
    parseReleaseArgs([
      '--dry-run',
      '--version',
      '1.0.0',
      '--notes',
      'Initial stable release',
    ]),
  ).toEqual({
    dryRun: true,
    version: '1.0.0',
    notes: 'Initial stable release',
  });
});
```

- [ ] **Step 6: Run focused tests to verify they fail**

Run: `bun test src/release/medium-version.test.ts src/release/release-mapping.test.ts src/package-json.test.ts`
Expected: FAIL because argument parsing and script orchestration do not match the new flow yet.

- [ ] **Step 7: Implement the release script changes**

In `scripts/release-medium.ts`, implement this flow exactly:

```ts
// parse args: require --version, allow --dry-run, accept optional --notes
// assert upstream remote exists
// assert current branch is medium
// assert clean working tree
// git fetch upstream --prune --tags
// upstreamRemoteTags = git ls-remote --tags --refs upstream "v*"
// normalize upstreamRemoteTags from refs/tags/vX.Y.Z to bare vX.Y.Z names
// reachableTags = git tag --merged HEAD --list
// reachableUpstreamTags = intersection(upstreamRemoteTags, reachableTags)
// upstreamTag = buildMediumReleasePlan({ requestedVersion, reachableUpstreamTags }).upstreamTag
// upstreamCommit = git rev-list -n 1 <upstreamTag>
// releaseDate = new Date().toISOString().slice(0, 10)
// notes = parsed --notes value ?? DEFAULT_RELEASE_NOTES
// read package.json, replace version only in real mode
// read docs/release-mapping.md or use RELEASE_MAPPING_HEADER if missing
// update mapping content in real mode
// in dry-run: print packageVersion, gitTag, upstreamTag, upstreamCommit, release body
// in real mode: git add package.json docs/release-mapping.md
// commit with "chore: release X.Y.Z"
// ensure tag does not already exist
// create annotated tag vX.Y.Z
```

Use these git commands:

- `git remote get-url upstream`
- `git symbolic-ref --short HEAD`
- `git status --porcelain`
- `git fetch upstream --prune --tags`
- `git ls-remote --tags --refs upstream "v*"`
- `git tag --merged HEAD --list`
- `git rev-list -n 1 <tag>`
- `git tag --list <target>`
- `git tag -a <target> -m "medium release <target>"`

Keep the script side effects in normal mode only. `--dry-run` must not modify
files, create commits, or create tags.

- [ ] **Step 8: Run targeted tests to verify they pass**

Run: `bun test src/release/medium-version.test.ts src/release/release-mapping.test.ts src/package-json.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add package.json src/package-json.test.ts src/release/medium-version.ts src/release/medium-version.test.ts src/release/release-mapping.ts src/release/release-mapping.test.ts scripts/release-medium.ts
git commit -m "feat: redesign medium release command"
```

## Chunk 4: Workflow and Operator Documentation

### Task 4: Update publish workflow and release SOP

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `docs/medium-release.md`
- Create: `docs/release-mapping.md`

- [ ] **Step 1: Write the failing documentation/workflow expectations**

Add or update assertions in existing tests where practical, and record these
manual expectations in the task notes:

- release workflow must stop publishing with `--tag medium`
- release workflow must validate stable `vX.Y.Z` tags
- documentation must show `bun run release -- --version X.Y.Z`
- documentation must show `bun run release:dry -- --version X.Y.Z`
- documentation must describe `docs/release-mapping.md` and manual GitHub
  Release creation from stdout output

- [ ] **Step 2: Update the workflow**

Modify `.github/workflows/release.yml` so it:

- triggers on the narrowest practical stable-release glob, `v*.*.*`
- rejects any non-`vX.Y.Z` tag in the validation step
- keeps the package/tag version equality check
- keeps the branch ancestry check against `origin/medium`
- runs `npm publish --provenance --access public --registry=https://registry.npmjs.org/`
  with no `--tag medium`

- [ ] **Step 3: Create the initial mapping document**

Create `docs/release-mapping.md` with exactly this starter content:

```md
# Release Mapping

> Maps medium releases to upstream tags and commits.
```

- [ ] **Step 4: Rewrite the release SOP**

Update `docs/medium-release.md` so it documents:

- stable semver releases and `vX.Y.Z` tags
- `release` and `release:dry` script names
- required `--version`
- dry-run output fields
- `docs/release-mapping.md` as the provenance source of record
- GitHub Release notes built from the command's stdout body
- npm Trusted Publisher still using provenance and public access

- [ ] **Step 5: Run focused verification**

Run: `bun test src/package-json.test.ts`
Expected: PASS

Run: `bun run check:ci`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/release.yml docs/medium-release.md docs/release-mapping.md
git commit -m "docs: update stable release workflow"
```

## Chunk 5: End-to-End Verification

### Task 5: Verify the redesigned workflow before handoff

**Files:**
- Modify: none required unless verification finds issues

- [ ] **Step 1: Run dry-run verification with the new CLI**

Run: `bun run release:dry -- --version 1.0.0`
Expected:
- prints `Package version: 1.0.0`
- prints `Git tag: v1.0.0`
- prints a reachable upstream tag in `vX.Y.Z` form
- prints an upstream commit SHA
- prints a copy-paste-ready GitHub Release body
- does not modify `package.json`
- does not modify `docs/release-mapping.md`

- [ ] **Step 2: Run the full automated checks**

Run: `bun test`
Expected: PASS

Run: `bun run typecheck`
Expected: PASS

Run: `bun run build`
Expected: PASS

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --stat HEAD~4..HEAD`
Expected: Only the planned release helper, mapping, workflow, package metadata, and docs changes are present.

- [ ] **Step 4: Commit any verification-driven fixes**

```bash
git add <any-fixed-files>
git commit -m "fix: resolve release workflow verification issues"
```

- [ ] **Step 5: Request code review**

Use superpowers:requesting-code-review after implementation is complete and all
verification commands pass.

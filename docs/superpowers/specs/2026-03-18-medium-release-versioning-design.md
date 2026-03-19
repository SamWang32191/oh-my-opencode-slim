# Medium Release Versioning Redesign

## Summary

Redesign the fork's release versioning so npm publishes stable releases to the
`latest` dist-tag instead of publishing semver prereleases. The fork will stop
encoding the upstream version inside `package.json.version` and git tags.
Instead, each medium release will use an independent stable semver, while the
upstream base version and commit are recorded in a mapping document and in the
GitHub Release notes.

This change is driven by the requirement that users should be able to upgrade
through `oh-my-opencode-medium@latest` and by the observation that the current
`<upstream>-medium.<n>` scheme is always treated as a prerelease by semver
consumers.

## Current State

Today the release flow is:

1. Run `bun run release:medium`
2. Push `medium`
3. Push tags
4. Manually create a GitHub Release in the web UI

The current release identifiers are:

- `package.json.version`: `<upstream-version>-medium.<fork-patch>`
- git tag: `v<upstream-version>-medium.<fork-patch>`

Example:

- package version: `0.8.3-medium.7`
- git tag: `v0.8.3-medium.7`

That scheme preserves upstream provenance in the version string, but semver
interprets it as a prerelease. As a result, npm ecosystem behavior around
`latest`, update prompts, and version comparisons is not aligned with the
desired upgrade path.

## Goals

- Publish medium releases as stable semver versions.
- Make `oh-my-opencode-medium@latest` the canonical install and auto-update
  target.
- Preserve upstream provenance in a durable, human-readable place.
- Ensure GitHub Releases clearly show which upstream tag and commit a medium
  release is based on.
- Keep the release workflow simple enough to run from the terminal with minimal
  manual bookkeeping.

## Non-Goals

- Full changelog generation in this iteration.
- Automatic GitHub Release creation in this iteration.
- Reconstructing historical provenance for every past release beyond what is
  practical to document during migration.
- Encoding upstream provenance into semver build metadata or other version
  syntax that depends on inconsistent tooling support.

## Options Considered

### Option 1: Independent stable semver for the fork

Example:

- `package.json.version`: `1.0.0`
- git tag: `v1.0.0`

Provenance is recorded separately:

- mapping document entry: `v1.0.0 -> upstream v0.8.3`
- GitHub Release body includes upstream tag and commit

Pros:

- Works naturally with npm `latest`
- Aligns with standard semver expectations
- Simplifies tooling and version comparisons

Cons:

- The version string alone no longer reveals the upstream base

### Option 2: Stable semver plus build metadata

Example:

- `package.json.version`: `1.0.0+upstream.0.8.3`

Pros:

- Avoids prerelease semantics in theory
- Keeps upstream information near the version

Cons:

- Build metadata handling is inconsistent across tooling and UX surfaces
- Adds parsing and display complexity for little practical value
- Increases risk of subtle release-tool incompatibilities

### Option 3: Encode upstream in normal numeric segments

Example:

- `package.json.version`: `8.3.7`

Pros:

- Keeps some visible relationship to upstream

Cons:

- Creates ambiguous semantics
- Becomes brittle when upstream versioning changes
- Makes fork-specific version intent harder to reason about

## Decision

Adopt **Option 1**.

The fork will maintain its own stable semver line, independent from the
upstream semver string. Upstream provenance will move out of the version number
and into release metadata that is explicit, searchable, and stable.

## Versioning Rules

### Package Version

- `package.json.version` must always be a stable semver in exact `X.Y.Z` form.
- The first release under the new scheme is fixed as `1.0.0`.
- Future fork-only fixes increment patch.
- Feature releases increment minor.
- Breaking release-process or user-facing compatibility changes increment major.

### Git Tag

- Git tags must match the package version exactly in the form `vX.Y.Z`.
- The release workflow must reject tags that do not match the stable form.
- The tagged commit must remain reachable from `origin/medium`.

### npm Publish

- npm publish must target the default `latest` dist-tag.
- The medium-specific `npm publish --tag medium` behavior must be removed.
- The published version must match `package.json.version` exactly.
- `.github/workflows/release.yml` must be updated to trigger on stable
  `vX.Y.Z` tags and to publish the package without overriding the dist-tag to
  `medium`.

## Provenance Mapping

### Mapping Document

Add a committed repository document at:

- `docs/release-mapping.md`

Each release entry should record:

- medium release version
- release date
- upstream tag
- upstream commit SHA
- optional notes for medium-specific highlights

The document should be append-only in practice, with the newest release easiest
to find.

### GitHub Release Notes

Every GitHub Release must explicitly include:

- medium release version
- upstream tag
- upstream commit
- a short summary of medium-specific changes

At minimum, the release body should contain a clearly recognizable line such as:

`Based on upstream v0.8.3 (<commit-sha>)`

This satisfies the requirement that provenance remains visible even though the
git tag itself no longer encodes the upstream version.

## Release Workflow Design

### CLI Release Flow

The release flow remains terminal-first:

1. sync and merge upstream into `medium` as usual
2. run `bun run release -- --version X.Y.Z`
3. push `medium`
4. push the release tag
5. create the GitHub Release manually in the web UI using the recorded metadata

### Release Command Responsibilities

The release command should stop deriving the next package version from upstream
tags. Instead, it should:

- verify `upstream` exists
- verify the current branch is `medium`
- verify the working tree is clean
- fetch upstream tags so provenance is available locally
- determine or accept the next stable medium version
- identify the exact upstream stable tag used for release provenance
- capture the upstream tag and commit used for this release
- update `package.json`
- update the release mapping document
- create a release commit
- create an annotated git tag
- print a copy-paste-ready GitHub Release body to stdout

The canonical script names under `package.json` should become:

- `release`
- `release:dry`

The old `release:medium` and `release:medium:dry` names should be removed
rather than preserved as aliases.

The release command must use explicit version input as the primary interaction
model:

- `bun run release -- --version 1.0.0`

This is preferred over bump shorthands because the fork now owns an independent
semver line and the human releasing should decide whether the next version is a
patch, minor, or major release.

Bump shorthands such as `patch` or `minor` are out of scope for this redesign
unless they fall out naturally from implementation with near-zero added
complexity.

The dry-run preview remains part of the operator workflow and should be exposed
as:

- `bun run release:dry -- --version 1.0.0`

The dry run must perform the same validation and metadata computation as the
real release command, but it must not modify files, create commits, update the
mapping document, or create tags.

### Upstream Detection

The release flow should still work with upstream tags in exact `vX.Y.Z` form
and ignore upstream prerelease tags such as `v0.8.4-rc.1`.

For provenance, the release flow must not use the newest upstream tag in the
repository globally. It must use the newest stable upstream tag that is
reachable from the release commit by git ancestry after fetching upstream tags.

Operationally, this means:

- collect stable upstream tags only
- limit candidates to tags whose tagged commit is reachable from `HEAD`
- choose the semver-highest candidate among those reachable tags

This makes provenance deterministic and ties the recorded upstream version to
what is actually contained in the release branch history.

That upstream tag is no longer part of the package version. It is release
metadata and must be persisted in the mapping document and surfaced in release
output.

## Migration

### Strategy

The new strategy intentionally creates a visible boundary between the old
prerelease-like naming scheme and the new stable fork-owned version line.

Migration cutover:

- current package: `0.8.3-medium.7`
- first new-style package: `1.0.0`
- first new-style tag: `v1.0.0`

### Documentation Updates

The implementation must update release documentation so the documented SOP
matches the new strategy:

- `docs/medium-release.md`
- `package.json` scripts and package metadata tests that still assert
  `release:medium` / `release:medium:dry`
- any other docs that still assert old release commands or tag formats
- workflow comments or validation that still mention `v*-medium.*`

### Historical Compatibility

Existing old-format tags remain in git history. They should not be rewritten.
New release automation only needs to recognize the new stable tag format for new
releases.

The GitHub Actions release workflow must also migrate from matching
`v*-medium.*` to matching stable `vX.Y.Z` tags for new releases.

If historical mapping entries are easy to infer, they can be added to
`docs/release-mapping.md`, but full historical backfill is optional and should
not block migration.

## Error Handling

The release command must fail with actionable messages when:

- `upstream` is missing
- the current branch is not `medium`
- the working tree is dirty
- no stable upstream tag can be found
- the requested release version is invalid
- the target git tag already exists
- the mapping document cannot be updated safely

## Testing Requirements

Implementation planning should include tests for:

- parsing and validating stable release tags in `vX.Y.Z` form
- identifying the latest stable upstream tag while ignoring prereleases
- identifying the semver-highest stable upstream tag reachable from `HEAD`
- building release metadata without encoding upstream into the version string
- rejecting invalid requested versions
- updating mapping content deterministically
- keeping workflow validation aligned with the new tag format
- printing a deterministic release body template for manual GitHub Release
  creation

## Open Questions Resolved

- **Should npm publish use `latest`?** Yes.
- **Should upstream provenance stay visible?** Yes, through committed mapping and
  GitHub Release notes rather than semver prerelease syntax.
- **Should GitHub Release creation be automated now?** No. Manual creation
  remains acceptable in this iteration as long as the required metadata is
  produced consistently.

## Implementation Boundary

This redesign covers one release system for one package in this repository. It
does not introduce a broader release platform, generalized changelog engine, or
multi-package version coordination.

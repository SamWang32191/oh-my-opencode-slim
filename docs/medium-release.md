# Medium Release SOP

This repository now uses stable semver releases:

- package versions are fork-owned stable semver releases like `1.2.3`
- git tags are exact `vX.Y.Z`
- the `medium` branch remains the release branch, and release commits must stay
  reachable from `origin/medium`

## Release Flow

### 1. Keep `medium` in sync

Before releasing, make sure `medium` contains the desired upstream merge and
your working tree is clean.

```bash
git switch medium
git pull --ff-only origin medium
git status
```

### 2. Preview the release

```bash
bun run release:dry -- --version X.Y.Z
```

The dry run prints:

- package version
- git tag
- upstream tag
- upstream commit
- GitHub Release body

The preview does not modify files, create commits, or create tags.

### 3. Create the release

```bash
bun run release -- --version X.Y.Z [--notes "..."]
```

The real release:

1. updates `package.json`
2. updates `docs/release-mapping.md`
3. creates the release commit
4. creates the `vX.Y.Z` git tag

The mapping doc is the source of record for upstream provenance. The GitHub
Release in the web UI should paste the generated body, including:

```text
Based on upstream <tag> (<sha>)
```

### 4. Push the release

```bash
git push origin medium
git push origin vX.Y.Z
```

After the tag reaches GitHub, `.github/workflows/release.yml` validates the
tag, checks the package version, confirms the tagged commit is reachable from
`origin/medium`, runs the build/test pipeline, and publishes to npm.

## npm Publishing

Publishing uses npm **Trusted Publisher** through GitHub OIDC.

- `npm publish` keeps `--provenance`
- npm access stays `public`
- no `NPM_TOKEN` is required

Configure the Trusted Publisher entry in npm package settings if it is not set
up yet. Point it at `.github/workflows/release.yml` for this repository.

## Version Rules

- versions are stable semver owned by this fork, such as `1.2.3`
- release tags are exact `v1.2.3`
- versions do not use the old `<upstream>-medium.N` pattern
- only stable upstream tags in exact `vX.Y.Z` form are used as inputs for the
  release mapping and release body

## Troubleshooting

### `Working tree must be clean before releasing.`

Commit or stash your local changes first, then rerun:

```bash
git status
```

### `Release script must run from the medium branch.`

Switch back to `medium`:

```bash
git switch medium
```

### `Remote 'upstream' is not configured.`

Add the upstream remote first:

```bash
git remote add upstream <upstream-url>
```

### `Tag already exists: vX.Y.Z`

That stable release version was already used. Choose a new `--version` and rerun
the dry run:

```bash
bun run release:dry -- --version X.Y.Z
```

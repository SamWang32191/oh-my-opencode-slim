# Medium Release SOP

This repository uses stable semver releases:

- package versions use fork-owned stable semver like `1.2.3`
- git tags are exact `vX.Y.Z`
- `medium` is the only release branch

## Primary Release Flow (GitHub Actions)

GitHub Actions is the primary release path.

Before triggering release, confirm `medium` already contains the target
upstream merge and intended release content.

The workflow locks to the dispatch-time `medium` snapshot (`github.sha`) and
does not float to newer commits merged after dispatch.

1. Open **Actions** and run `.github/workflows/release.yml` from the `medium`
   branch in the GitHub Actions UI.
2. Provide required `version` (`X.Y.Z`).
3. Optionally provide one-line `notes`.
4. Optionally set `dry_run = true` to run end-to-end validation without
   persistent release-state mutation or publishing.

The workflow then:

1. checks out `medium` with full history (`fetch-depth: 0`) and asserts the
   current branch is `medium`
2. installs dependencies (`bun install --frozen-lockfile`)
3. runs quality gates: `bun run lint`, `bun run typecheck`, `bun test`,
   `bun run build`
4. runs `bun run scripts/release-ci.ts --version ... --body-file ... [--notes ...] [--dry-run]`
   to generate release body, and (non-dry-run only) prepare local release
   commit/tag state
5. uploads `release-body.md` as a workflow artifact for recovery
6. (non-dry-run only) pushes the release commit to `origin/medium`
7. (non-dry-run only) publishes to npm using OIDC Trusted Publisher
   (`npm publish --provenance`)
8. (non-dry-run only) pushes the release tag `vX.Y.Z`
9. (non-dry-run only) creates the GitHub Release using
   `gh release create --notes-file`

When `dry_run = true`, workflow still executes checkout/setup/install/lint/
typecheck/test/build, temporarily updates/fetches `upstream` refs/tags as
needed, fetches compare+PR data, generates the same release body, and uploads
the artifact preview. It does **not** perform persistent release-state
mutation: no `package.json` update, no `docs/release-mapping.md` update, no
commit/tag creation, and no push/publish/GitHub Release creation.

`UPSTREAM_REMOTE_URL` is set to:

```text
https://github.com/alvinunreal/oh-my-opencode-slim.git
```

This workflow is the only complete release path (git + npm + GitHub Release).

## Partial Release Recovery

If `origin/medium` push succeeds but `npm publish` fails (and the tag was not
pushed yet), do not assume rerunning the same version is always safe.

- recover first (for example, revert the release commit so `package.json` and
  `docs/release-mapping.md` return to the pre-release state), then rerun
- or manually complete the remaining steps from the same prepared release
  commit/tag state after validating publish conditions

If `npm publish` already succeeds but tag push or GitHub Release creation fails,
recover from the release commit already pushed to `medium`:

- recreate `vX.Y.Z` from that pushed release commit, then push the tag
- create the missing GitHub Release
- if needed, download `release-body-<version>` workflow artifact to recover the
  exact release notes body

Do not create a second release commit for the same published npm version.

## Changelog Source and Classification

GitHub Actions primary flow generates changelog content from GitHub compare
data:

- primary source: merged PR metadata per commit
- fallback source: direct commit metadata when no PR is linked
- classification priority: PR labels first, title prefixes second

Local fallback does not provide this same PR/direct-commit auto changelog
generation behavior.

## Secondary / Fallback Local Flow

Local release command is a secondary recovery/manual fallback path:

Before running local fallback/recovery, ensure all of the following:

- your current branch is `medium` and the worktree is clean
- git remote `upstream` is configured
- `gh` CLI is installed and authenticated

```bash
bun run release -- --version X.Y.Z [--notes "..."]
```

Use this only when GitHub Actions is unavailable. It is not equivalent to the
full workflow: it does not perform npm publish and does not generate the
GitHub Actions PR/direct-commit auto changelog. However, it still performs the
current script's git/GitHub actions (push `medium`, push tag, create GitHub
Release) using its own single-line `--notes` release body behavior.

## npm Publishing

Publishing uses npm **Trusted Publisher** via GitHub OIDC:

- no `NPM_TOKEN` is required
- workflow clears token-based auth before publish
- package is published as public with provenance

## Version Rules

- versions must be stable semver (`X.Y.Z`)
- release tags must be exact `vX.Y.Z`
- `--version` must be greater than the highest mapped release version in
  `docs/release-mapping.md`
- only stable upstream tags in exact `vX.Y.Z` form are used for mapping

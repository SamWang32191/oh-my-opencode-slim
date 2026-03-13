# oh-my-opencode-medium Design

## Goal

Publish this fork as a clearly labeled, publicly maintained npm package under a new
name while preserving an easy path to sync changes from upstream.

## Current Context

- Repository: `oh-my-opencode-slim`
- Current package name: `oh-my-opencode-slim`
- Current license: `MIT`
- Fork layout already exists: `origin` points to the user's fork and `upstream`
  points to the source repository
- Desired npm owner: `w32191`
- Desired public package name: `oh-my-opencode-medium`
- Desired product position: public maintained fork, not an internal-only package

## Design Decisions

### 1. Product Positioning

This package should be presented as a maintained fork rather than an official
continuation of the upstream package. The package, repository metadata, and README
should make the fork relationship obvious.

The public-facing message should be:

- this package is forked from `alvinunreal/oh-my-opencode-slim`
- this package is maintained independently by `w32191`
- this package may track upstream changes, but releases are published on its own
  schedule

### 2. Naming Strategy

Preferred publish target:

- `oh-my-opencode-medium`

Fallback publish target if the unscoped name is unavailable:

- `@w32191/oh-my-opencode-medium`

The implementation should treat the unscoped name as the preferred brand, but keep
the scoped fallback ready because npm name availability cannot be assumed.

Before making package-identity changes, verify:

- whether `oh-my-opencode-medium` is available on npm
- whether the `w32191` npm account can publish under the `@w32191` scope
- which name will actually be used in docs and release commands

Recommended verification method:

- run `npm view oh-my-opencode-medium version` and treat a successful lookup as an
  occupied unscoped name
- run `npm view @w32191/oh-my-opencode-medium version` and treat a successful lookup
  as an existing package under that scope
- run `npm whoami` to confirm the active publisher before the first release

Related identifiers should stay consistent:

- package name in `package.json`
- CLI `bin` name, which should remain an unscoped executable such as
  `oh-my-opencode-medium`
- installation snippets in `README.md`
- any references in docs, scripts, or release instructions

Even if the package is published with the scoped fallback,
`@w32191/oh-my-opencode-medium`, the installed CLI command should still remain
`oh-my-opencode-medium`.

### 3. Compatibility Strategy

Behavioral compatibility with the current fork should be preserved where possible.
Renaming should focus on package identity, installation commands, and documentation
rather than changing the plugin's runtime behavior.

This keeps migration simple for early users and avoids mixing branding work with
feature changes.

### 4. Repository Metadata

These fields should point to the maintained fork rather than the upstream project:

- `repository.url`
- `bugs.url`
- `homepage`

The package description should mention that it is a fork, for example:

`Medium-weight agent orchestration plugin for OpenCode, forked from oh-my-opencode-slim`

### 5. README Strategy

The README should be updated so the fork relationship is explicit near the top of
the document.

The opening section should communicate:

- what the project is
- that it is forked from `oh-my-opencode-slim`
- why this fork exists
- where users should file issues
- how to install this fork's npm package

Installation examples should use the new package name. If the scoped fallback is
used instead of the unscoped package, all install examples must switch to the
scoped name consistently.

### 5.1 User Migration

If any users already installed this fork under the old package name, the rename
should include a migration note.

The migration note should cover:

- the old package name and the new package name
- whether users need to reinstall or update OpenCode/plugin configuration
- where future releases will be published

If the maintainer also controls any older npm package that should no longer be used,
they may optionally publish a final deprecation notice that points users to the new
package name.

### 6. Versioning and Releases

This fork should use an independent release cadence.

Recommended release policy:

- keep SemVer for this fork's own releases
- do not imply that the version number is an official upstream version
- mention the upstream base commit, tag, or release in changelog or release notes
  whenever a release significantly syncs upstream behavior, fixes, or security
  changes

Existing release scripts can stay in place if they only need package-name updates,
but release docs should clarify that publishing is performed from the fork.

### 6.1 Version Starting Point

The fork should keep an independent version history, but it does not need to pretend
it starts from the upstream project's original timeline.

Recommended default:

- keep the current version lineage and bump from the current fork version
- avoid resetting to `1.0.0` unless there is a deliberate product decision to
  signal stability or a new compatibility contract
- when useful, note the upstream base commit or release in changelog or release
  notes for upstream-heavy sync releases instead of trying to encode that
  relationship into SemVer alone

### 7. Upstream Sync Workflow

Keep the existing fork workflow:

- `origin` = maintained fork
- `upstream` = source project
- `master` = integration branch
- short-lived feature branches for day-to-day work

Recommended sync flow:

```bash
git fetch origin --prune
git fetch upstream --prune
git switch master
git pull --ff-only origin master
git merge upstream/master
git push origin master
```

Then update in-flight branches from `master`.

For review or shared branches, prefer merge:

```bash
git switch feat/my-branch
git merge master
git push origin feat/my-branch
```

For private, unshared branches, rebase is acceptable if a linear history is wanted.

### 8. Publish Workflow

Recommended publish flow:

1. Confirm npm authentication is ready with the publishing account that owns the
   chosen package name or scope
2. Confirm package-name availability before editing docs and publish instructions:
   - `oh-my-opencode-medium`
   - fallback `@w32191/oh-my-opencode-medium`
3. Update package identity fields and docs
4. Run verification commands:
   - `bun run build`
   - `bun run check:ci`
   - `bun test`
5. Run `npm pack` to inspect the publish payload
6. Publish from the fork using the chosen package name

If publishing a scoped public package, ensure npm access is set correctly during the
first publish, for example with `npm publish --access public`.

## Files Expected To Change

- `package.json`
- `README.md`
- optionally release or install docs that mention the package name

Potentially affected references may also exist in:

- `docs/installation.md`
- `docs/quick-reference.md`
- CLI or script text that prints install commands

## Non-Goals

- changing the plugin's core runtime behavior
- redesigning the agent system
- fully rebranding every internal identifier unless needed for user-facing clarity
- replacing the current fork sync model with a different branching strategy

## Risks And Mitigations

### npm name unavailable

Mitigation: fall back to `@w32191/oh-my-opencode-medium` and update docs
consistently.

### npm auth or scope setup is incomplete

Mitigation: verify `npm whoami`, confirm the `w32191` account is the active
publisher, and validate that the fallback scoped package can be published before
finalizing release instructions.

### Existing package name or legacy package confusion

Mitigation: only deprecate or redirect any older npm package if it is actually owned
by the maintainer of this fork. Otherwise, rely on README and npm metadata to make
the maintained package choice clear.

### User confusion about official ownership

Mitigation: label the project as a fork in `README.md`, package description, and
repository metadata.

### Drift from upstream becomes hard to manage

Mitigation: keep the integration branch sync workflow simple and avoid unnecessary
divergence during the initial rename/publish phase.

## Success Criteria

- the project can be published to npm under a new name owned by `w32191`
- the fork relationship is explicit in user-facing metadata and docs
- install commands point to the new package name
- the repository remains easy to sync with upstream
- users can understand whether they are using the upstream package or the fork

## Notes

This design documents the planned publishing model only. No git commit is created as
part of this planning step unless explicitly requested.

# oh-my-opencode-medium Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish this fork under the new npm identity `oh-my-opencode-medium` with clear upstream attribution, consistent user-facing naming, and explicit migration instructions for existing users.

**Architecture:** Implement the rename in three layers. First, lock the actual npm publish target (`oh-my-opencode-medium` or fallback `@w32191/oh-my-opencode-medium`). Second, update package metadata, plugin/runtime constants, config naming, and CLI surface area to use the new public identity. Third, update docs with explicit migration steps, then verify the published payload with local checks before the first npm release.

**Tech Stack:** TypeScript, Bun test runner, npm publishing, Biome, OpenCode plugin runtime

---

## File Structure

- `package.json` - package name, bin name, description, repository metadata, release scripts
- `bun.lock` - dependency metadata updated after package rename if Bun rewrites it
- `src/index.ts` - plugin registration name exposed to OpenCode
- `src/hooks/auto-update-checker/constants.ts` - npm package lookup target and installed package path
- `src/hooks/auto-update-checker/index.ts` - user-facing update messages
- `src/hooks/auto-update-checker/checker.test.ts` - update-checker package-name assertions
- `src/hooks/auto-update-checker/cache.test.ts` - update cache assertions if package name is embedded
- `src/cli/index.ts` - help text and `bunx` install examples
- `src/cli/install.ts` - installer banners and user-visible install text
- `src/cli/custom-skills.ts` - user-facing references to the project/package root
- `src/cli/paths.ts` - plugin config filename helpers
- `src/cli/paths.test.ts` - config filename expectations
- `src/config/loader.ts` - plugin config discovery, prompts dir naming, and preset env naming for the medium identity
- `src/config/loader.test.ts` - config discovery tests for medium-only filenames and identifiers
- `src/cli/config-io.ts` - config write/read messaging and plugin entry package-name updates
- `src/cli/config-io.test.ts` - config path and output assertions
- `src/cli/config-manager.test.ts` - config manager expectations tied to plugin filename/package name
- `README.md` - project identity, install commands, fork attribution, migration note
- `docs/installation.md` - install/update/uninstall commands and config-file references
- `docs/quick-reference.md` - install snippets and config path references
- `docs/antigravity.md` - install/config references
- `docs/tmux-integration.md` - config path references
- `docs/cartography.md` - installer/package references

## Implementation Notes

- Prefer the unscoped publish target `oh-my-opencode-medium` if npm name availability allows it.
- If the unscoped name is taken, switch the package name and install snippets to `@w32191/oh-my-opencode-medium`, but keep the CLI executable name unscoped as `oh-my-opencode-medium`.
- Use `oh-my-opencode-medium.json` / `.jsonc` as the only supported plugin config filenames after the rename.
- Existing users must rename old slim-named config files manually; do not add runtime fallback logic for `oh-my-opencode-slim.json` / `.jsonc`.
- Do not change unrelated internal architecture during the rename.

## Chunk 1: Package Identity, Compatibility, and Publish Prep

### Task 1: Verify the final npm publish target

Implementation note:

```md
Chosen publish target: `oh-my-opencode-medium`
Fallback needed: no
Auth check status: `npm whoami` returned `w32191`
Availability check `npm view oh-my-opencode-medium version`: 404/not found (available)
Availability check `npm view @w32191/oh-my-opencode-medium version`: 404/not found (available)
```


**Files:**
- Modify: `docs/superpowers/plans/2026-03-13-oh-my-opencode-medium.md`
- Verify: `package.json`

- [ ] **Step 1: Verify npm auth and name availability**

Run:

```bash
npm whoami
npm view oh-my-opencode-medium version
npm view @w32191/oh-my-opencode-medium version
```

Expected:
- `npm whoami` prints `w32191`
- each `npm view ... version` either returns a version (occupied) or a 404/not found response (available)

- [ ] **Step 2: Record the chosen publish target in the plan before code changes**

Add a short note under this task when implementation starts, for example:

```md
Chosen publish target: `oh-my-opencode-medium`
Fallback needed: no
```

or:

```md
Chosen publish target: `@w32191/oh-my-opencode-medium`
Fallback needed: yes
CLI binary: `oh-my-opencode-medium`
```

- [ ] **Step 3: Do not edit user-facing install snippets until the chosen target is recorded**

Verification: `package.json` and docs still match the chosen target decision before any commit.

- [ ] **Step 4: Commit the preflight decision if it changes the plan document**

```bash
git add docs/superpowers/plans/2026-03-13-oh-my-opencode-medium.md
git commit -m "docs: record medium package publish target"
```

### Task 2: Rename package metadata and update-checker identity

**Files:**
- Modify: `package.json`
- Modify: `src/index.ts`
- Modify: `src/hooks/auto-update-checker/constants.ts`
- Modify: `src/hooks/auto-update-checker/index.ts`
- Test: `src/hooks/auto-update-checker/checker.test.ts`
- Test: `src/hooks/auto-update-checker/cache.test.ts`

- [ ] **Step 1: Write or update failing tests for the new package identity**

In `src/hooks/auto-update-checker/checker.test.ts`, update the mocked package name and plugin entries so they assert against the chosen target. Example for the unscoped path:

```ts
mock.module('./constants', () => ({
  PACKAGE_NAME: 'oh-my-opencode-medium',
  USER_OPENCODE_CONFIG: '/mock/config/opencode.json',
  USER_OPENCODE_CONFIG_JSONC: '/mock/config/opencode.jsonc',
  INSTALLED_PACKAGE_JSON:
    '/mock/cache/node_modules/oh-my-opencode-medium/package.json',
}));
```

If using the scoped fallback, keep `PACKAGE_NAME` scoped, URL-encode it before constructing npm registry URLs, and make the CLI/install examples unscoped only where they refer to the binary rather than the npm package.

- [ ] **Step 2: Run the targeted tests to verify they fail for the old package name**

Run:

```bash
bun test src/hooks/auto-update-checker/checker.test.ts src/hooks/auto-update-checker/cache.test.ts
```

Expected: at least one assertion fails because code still points at `oh-my-opencode-slim`.

- [ ] **Step 3: Implement the minimal package identity changes**

Update:

- `package.json`
  - `name`
  - `description`
  - `bin`
  - `repository.url`
  - `bugs.url`
  - `homepage`
- `src/index.ts`
  - plugin `name`
- `src/hooks/auto-update-checker/constants.ts`
  - `PACKAGE_NAME`
  - derived npm registry URL
  - installed cached package path
- `src/hooks/auto-update-checker/index.ts`
  - any status text that prints the old package name

Expected implementation shape in `src/hooks/auto-update-checker/constants.ts`:

```ts
export const PACKAGE_NAME = 'oh-my-opencode-medium';
export const NPM_REGISTRY_URL =
  `https://registry.npmjs.org/-/package/${encodeURIComponent(PACKAGE_NAME)}/dist-tags`;
```

- [ ] **Step 4: Re-run the targeted tests**

Run:

```bash
bun test src/hooks/auto-update-checker/checker.test.ts src/hooks/auto-update-checker/cache.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit the identity update**

```bash
git add package.json src/index.ts src/hooks/auto-update-checker/constants.ts src/hooks/auto-update-checker/index.ts src/hooks/auto-update-checker/checker.test.ts src/hooks/auto-update-checker/cache.test.ts
git commit -m "feat: rename published package to oh-my-opencode-medium"
```

### Task 3: Switch config naming fully to the medium identity

**Files:**
- Modify: `src/cli/paths.ts`
- Modify: `src/config/loader.ts`
- Modify: `src/cli/config-io.ts`
- Test: `src/cli/paths.test.ts`
- Test: `src/config/loader.test.ts`
- Test: `src/cli/config-io.test.ts`
- Test: `src/cli/config-manager.test.ts`

- [ ] **Step 1: Write failing tests for medium-only config filenames and identifiers**

Add or update tests so these behaviors are explicit:

- preferred path becomes `~/.config/opencode/oh-my-opencode-medium.json`
- `.jsonc` companion becomes `~/.config/opencode/oh-my-opencode-medium.jsonc`
- config loader and related helpers stop referring to slim-named config files,
  prompt directories, and preset env names
- slim-named config files are not auto-loaded anymore

Example test shape in `src/cli/paths.test.ts`:

```ts
test('getLiteConfig() returns medium config path', () => {
  process.env.XDG_CONFIG_HOME = '/tmp/xdg-config';
  expect(getLiteConfig()).toBe(
    '/tmp/xdg-config/opencode/oh-my-opencode-medium.json',
  );
});
```

- [ ] **Step 2: Run focused config-path tests and confirm they fail**

Run:

```bash
bun test src/cli/paths.test.ts src/config/loader.test.ts src/cli/config-io.test.ts src/cli/config-manager.test.ts
```

Expected: FAIL because code still refers to slim-named config files or identifiers.

- [ ] **Step 3: Implement medium-only config naming**

Implementation requirements:

- `src/cli/paths.ts`
  - return new `oh-my-opencode-medium.*` paths from `getLiteConfig()` and `getLiteConfigJsonc()`
  - keep existing-path resolution aligned with the medium filename only
- `src/config/loader.ts`
  - use `oh-my-opencode-medium` config, prompt, and preset identifiers consistently
- `src/cli/config-io.ts`
  - print the new preferred filename in user-facing output
  - ensure written OpenCode plugin entries use the chosen package name rather than `oh-my-opencode-slim`

Suggested helper shape:

```ts
const CONFIG_BASENAME = 'oh-my-opencode-medium';
```

Suggested preset/env naming shape in `src/config/loader.ts`:

```ts
const PROMPTS_DIR_NAME = 'oh-my-opencode-medium';
const PRESET_ENV = 'OH_MY_OPENCODE_MEDIUM_PRESET';
```

Add an explicit negative test in `src/config/loader.test.ts` or
`src/cli/config-manager.test.ts` showing that a standalone
`oh-my-opencode-slim.json` / `.jsonc` file is ignored after the rename.

- [ ] **Step 4: Re-run focused config-path tests**

Run:

```bash
bun test src/cli/paths.test.ts src/config/loader.test.ts src/cli/config-io.test.ts src/cli/config-manager.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit the compatibility work**

```bash
git add src/cli/paths.ts src/config/loader.ts src/cli/config-io.ts src/cli/paths.test.ts src/config/loader.test.ts src/cli/config-io.test.ts src/cli/config-manager.test.ts
git commit -m "feat: switch config naming to medium"
```

### Task 4: Update CLI help text and installer output

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `src/cli/install.ts`
- Modify: `src/cli/custom-skills.ts`
- Verify: `package.json`

- [ ] **Step 1: Update all user-visible CLI names and install examples**

Change help text and installer strings from `oh-my-opencode-slim` to the chosen publish target where package installation is referenced, and to `oh-my-opencode-medium` where the executable/binary name is referenced.

Examples to update in `src/cli/index.ts`:

```text
oh-my-opencode-medium installer

Usage: bunx oh-my-opencode-medium install [OPTIONS]
       bunx oh-my-opencode-medium models [OPTIONS]
```

- [ ] **Step 2: Verify there are no remaining old install examples in CLI sources**

Run:

```bash
grep -R "oh-my-opencode-slim" src/cli src/index.ts src/hooks/auto-update-checker
```

Expected: only intentional legacy-compatibility references remain; no stale help text or install command examples.
Expected: no legacy compatibility references remain in runtime code; old slim-name mentions are allowed only for fork attribution or migration instructions.

- [ ] **Step 3: Commit the CLI text updates**

```bash
git add src/cli/index.ts src/cli/install.ts src/cli/custom-skills.ts
git commit -m "docs: update medium installer and CLI messaging"
```

### Task 5: Update README and user-facing docs for the renamed fork

**Files:**
- Modify: `README.md`
- Modify: `docs/installation.md`
- Modify: `docs/quick-reference.md`
- Modify: `docs/antigravity.md`
- Modify: `docs/tmux-integration.md`
- Modify: `docs/cartography.md`

- [ ] **Step 1: Update the README introduction and install examples**

The top section of `README.md` should explicitly state:

- this project is forked from `alvinunreal/oh-my-opencode-slim`
- it is independently maintained by `w32191`
- where users should file issues for this fork
- npm installation now uses the chosen package name
- existing users of the slim fork should follow the migration note

Suggested opening note:

```md
> Forked from `alvinunreal/oh-my-opencode-slim` and maintained independently by `w32191`.
> Publish target: `oh-my-opencode-medium`
```

- [ ] **Step 2: Add a short migration section for existing users**

Minimum content:

- old package name: `oh-my-opencode-slim`
- new package name: `oh-my-opencode-medium`
- whether users should reinstall or update their OpenCode plugin entry
- that legacy slim config files are no longer auto-read and users must rename the
  existing file or recreate/regenerate config manually

- [ ] **Step 3: Update install and config-path references across docs**

Make docs consistent with the implementation:

- package install snippets use the chosen publish target
- CLI command examples use `oh-my-opencode-medium`
- preferred config filename examples use `oh-my-opencode-medium.json` / `.jsonc`
- old slim config filenames are mentioned only in migration instructions that tell users to rename them

- [ ] **Step 4: Verify no stale user-facing references remain in docs**

Run:

```bash
grep -R "oh-my-opencode-slim" README.md docs
```

Expected: only intentional fork-attribution or migration-note references remain.

- [ ] **Step 5: Commit the docs update**

```bash
git add README.md docs/installation.md docs/quick-reference.md docs/antigravity.md docs/tmux-integration.md docs/cartography.md
git commit -m "docs: describe medium fork package and migration"
```

### Task 6: Full-project verification and first-release dry run

**Files:**
- Verify: `package.json`
- Verify: `README.md`
- Verify: `docs/installation.md`

- [ ] **Step 1: Run repository checks**

Run:

```bash
bun run build
bun run check:ci
bun run typecheck
bun test
```

Expected: all commands PASS

- [ ] **Step 2: Inspect the publish payload**

Run:

```bash
npm pack
```

Expected: npm creates a tarball for the chosen package name and the payload includes only the intended publish files from `package.json`.

- [ ] **Step 3: Verify the final package metadata in the tarball summary**

Confirm:

- package name matches the chosen target
- version matches the intended release version
- versioning continues from the current fork lineage unless a separate deliberate decision was made to reset it
- README and LICENSE are included
- `dist/` and `src/skills/` are present as expected

- [ ] **Step 4: Stop for manual approval before publish or tagging**

Checkpoint:

- confirm the chosen package name one last time
- confirm `npm whoami` still returns `w32191`
- confirm the version is the intended next release in the current fork lineage
- do not run `npm publish` or create release tags until the human maintainer explicitly decides to proceed

- [ ] **Step 5: Publish the package manually**

For unscoped publish:

```bash
npm publish
```

For first scoped public publish:

```bash
npm publish --access public
```

Expected: npm returns the published package name and version.

- [ ] **Step 6: Tag and document the release source**

Record in the release notes or git tag description:

- chosen npm package name
- first public release version
- upstream commit/tag this fork release is based on

Suggested release note line:

```md
Based on upstream `alvinunreal/oh-my-opencode-slim` at commit `<sha>`.
```

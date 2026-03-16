---
id: npm-trusted-publisher-publish-needs-provenance
date: 2026-03-16
scope: project
tags:
  - npm
  - trusted-publisher
  - github-actions
  - oidc
  - releases
source: bug-fix
confidence: 0.5
related:
  - [[github-actions-merge-base-needs-full-history]]
---

# npm Trusted Publisher needs provenance at publish time

## Context
While publishing this package from GitHub Actions with npm Trusted Publisher,
the workflow had `id-token: write` and the correct registry, but `npm publish`
failed with `E404` during the PUT request.

## Mistake
I assumed OIDC would be used automatically once the workflow permissions were in
place. The publish command was missing `--provenance`, so npm did not complete
the Trusted Publisher flow as intended.

## Lesson
- When using npm Trusted Publisher in GitHub Actions, include
  `npm publish --provenance` in the publish step.
- For public releases, adding `--access public` keeps the intent explicit.
- If publish fails with an unexpected 404 even though the package exists, check
  whether the workflow is missing provenance before assuming the package name is
  wrong.

## When to Apply
Apply this when creating or debugging npm publish workflows that rely on GitHub
OIDC / Trusted Publisher instead of a long-lived npm token.

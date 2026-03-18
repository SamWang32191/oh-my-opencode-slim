---
id: local-dev-plugin-detection-should-validate-package-json
date: 2026-03-18
scope: project
tags:
  - local-dev
  - plugins
  - versioning
  - startup
  - file-url
source: bug-fix
confidence: 0.5
related: []
---

# Local dev plugin detection should validate package.json

## Context
The startup toast showed the installed cache version instead of the local dev
version suffix because the local plugin was loaded from a `file://` path.

## Mistake
I treated a local dev plugin path as valid only when the raw `file://` string
contained the package name. That broke for arbitrary folder names, symlinks, or
worktree paths that still pointed to the correct package.

## Lesson
- For local `file://` plugin entries, resolve the path first and verify the
  target by locating its `package.json` and checking the package name.
- Do not infer package identity from a path substring when the package metadata
  is available.

## When to Apply
Apply this when detecting local plugins, packages, or workspaces from config
entries, especially when paths may come from symlinks, worktrees, or custom
directory names.

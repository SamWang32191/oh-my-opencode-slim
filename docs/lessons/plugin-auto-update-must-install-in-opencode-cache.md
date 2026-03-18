---
id: plugin-auto-update-must-install-in-opencode-cache
date: 2026-03-18
scope: project
tags:
  - plugins
  - auto-update
  - cache
  - bun
  - restart
source: bug-fix
confidence: 0.5
related: []
---

# Plugin auto-update must install in OpenCode cache

## Context
The auto-update flow invalidated the plugin package under the OpenCode cache and
then told users to restart, but the same update prompt kept appearing after
restart.

## Mistake
I used the session working directory for `bun install` even though plugin
packages are loaded from OpenCode's cache directory. That meant the update step
could succeed in the wrong place while the actual cached plugin stayed old.

## Lesson
- When a plugin update reads or invalidates packages from the OpenCode cache,
  the reinstall step must also run inside that same cache directory.
- Do not assume `PluginInput.directory` is the plugin install location; it is
  the current workspace directory.

## When to Apply
Apply this when implementing plugin installation, auto-update, or cache
invalidation flows that mix session context with OpenCode's plugin storage.

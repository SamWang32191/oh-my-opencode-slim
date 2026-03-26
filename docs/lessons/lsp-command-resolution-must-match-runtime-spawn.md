---
id: lsp-command-resolution-must-match-runtime-spawn
date: 2026-03-26
scope: project
tags:
  - lsp
  - command-resolution
  - spawn
  - windows
  - cache
source: user-correction
confidence: 0.7
related:
  - '[[opencode-lsp-binaries-live-in-cache-not-config-dir]]'
---

# LSP command resolution must match runtime spawn

## Context

The LSP lookup path was updated to search OpenCode's cache bin, but live Go
diagnostics still failed with `Executable not found in $PATH: "gopls"`.

## Mistake

I fixed install detection without making runtime execution consume the same
resolved command. That let install checks pass while `spawn()` still received a
bare command name. I also missed bundle layouts like
`~/.cache/opencode/bin/jdtls/bin/jdtls` and Windows batch wrappers.

## Lesson

- LSP install detection and runtime execution must share one command-resolution
  path; do not keep a boolean "installed" check separate from the actual
  command used by `spawn()`.
- OpenCode-managed tools may be stored either as direct executables in
  `cache/opencode/bin` or as bundle-style launchers in `cache/opencode/bin/<cmd>/bin`.
- On Windows, resolved `.cmd`/`.bat` launchers must be wrapped with
  `cmd.exe /c` before spawning.

## When to Apply

Apply this when changing any LSP server lookup, execution, PATH injection, or
OpenCode-managed binary discovery flow.

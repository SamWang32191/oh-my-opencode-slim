---
id: git-fetch-multiple-remotes-needs-separate-commands
date: 2026-03-12
scope: project
tags:
  - git
  - remotes
  - commands
  - workflow
source: retrospective
confidence: 0.3
related: []
---

# Git fetch multiple remotes needs separate commands

## Context
While evaluating a fork-sync workflow skill, I used `git fetch origin upstream --prune` to update both fork and upstream references.

## Mistake
`git fetch` treats the first positional argument as the remote name and later positional arguments as refspecs, not additional remotes, so `upstream` was parsed incorrectly and the command failed.

## Lesson
When a workflow needs to refresh both `origin` and `upstream`, use separate commands like `git fetch origin --prune && git fetch upstream --prune`, or use a deliberate `git fetch --all --prune` only when fetching every remote is acceptable.

## When to Apply
Apply this when writing Git automation, aliases, or skills that work with forked repositories and multiple remotes.

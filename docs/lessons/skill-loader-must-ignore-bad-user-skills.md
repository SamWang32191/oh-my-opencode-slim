---
id: skill-loader-must-ignore-bad-user-skills
date: 2026-03-12
scope: project
tags:
  - skills
  - loader
  - startup
  - validation
source: bug-fix
confidence: 0.5
related: []
---

# Skill loader must ignore bad user skills

## Context
The plugin discovers user-installed skills during the `config()` hook, before normal startup finishes.

## Mistake
The loader let `readdir()` and `readFile()` errors escape, registered skills even when `parseFrontmatter()` reported malformed metadata, and skipped symlinked skill directories because discovery only followed `Dirent.isDirectory()`.

## Lesson
Anything loaded from user-controlled skill directories during startup must use warn-and-skip behavior for unreadable directories, unreadable files, and malformed frontmatter instead of aborting plugin initialization, and directory discovery must resolve symlinked folders because skill trees are often linked into `~/.agents/skills`.

## When to Apply
Apply this when adding or changing startup-time discovery for skills, prompts, configs, or other user-authored files that should not block the plugin from loading.

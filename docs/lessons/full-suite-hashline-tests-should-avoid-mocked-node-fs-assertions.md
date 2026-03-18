---
id: full-suite-hashline-tests-should-avoid-mocked-node-fs-assertions
date: 2026-03-18
scope: project
tags: [tests, bun, mocks, hashline, isolation]
source: bug-fix
confidence: 0.5
related: []
---

# Full-suite hashline tests should avoid mocked node:fs assertions

## Context
The new hashline executor tests passed in isolation but failed in the full Bun suite with false `File not found` and `existsSync` assertions.

## Mistake
The test setup used `node:fs` helpers like `writeFileSync` and `existsSync`, while other test files in the repo used module-level `mock.module('node:fs', ...)`. In the full batch run, those mocks leaked into the executor test environment and made setup/assertions lie about the real filesystem state.

## Lesson
- For integration-style tests that must survive the whole Bun suite, prefer `Bun.write()` and `Bun.file(...).exists()` over `node:fs` assertions when other tests mock `node:fs` at module scope.
- When a test fails only in the full suite, compare isolated vs batched runs first and look for runtime/module mocks before changing production code.
- Treat full-suite-only failures as test-isolation bugs until proven otherwise.

## When to Apply
Apply this when adding filesystem-heavy tests in this repo, especially under `src/tools/` or `src/hooks/`, and any time a Bun test passes alone but fails in the full suite.

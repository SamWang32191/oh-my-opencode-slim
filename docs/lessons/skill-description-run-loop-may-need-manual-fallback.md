---
id: skill-description-run-loop-may-need-manual-fallback
date: 2026-03-12
scope: project
tags:
  - skills
  - description
  - evals
  - tooling
source: retrospective
confidence: 0.3
related: []
---

# Skill description run loop may need manual fallback

## Context
I used the skill-creator description optimization workflow on a local skill and launched `python3 -m scripts.run_loop` with the current session model identifier.

## Mistake
The eval phase ran, but the improvement phase crashed at the internal `claude -p` call, so the loop could not automatically propose a better description.

## Lesson
When using the skill-creator description optimization scripts outside a Claude-native model flow, verify the `claude -p` improvement step actually works. If it fails, keep the generated eval set, run the eval step separately, and fall back to manual description tuning plus saved before/after eval outputs.

## When to Apply
Apply this when optimizing skill descriptions with `scripts.run_loop`, especially in mixed-model environments or when the current session model is not obviously the same model family the helper script expects.

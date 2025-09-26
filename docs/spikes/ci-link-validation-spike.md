---
title: "CI Link Validation Spike"
category: "Platform & Infrastructure"
status: "🔴 Not Started"
priority: "Medium"
timebox: "2 days"
created: 2025-09-26
updated: 2025-09-26
owner: "team"
tags:
  - "technical-spike"
  - "ci"
  - "docs"
    - "link-validation"
    - "markdown"
    - "testing"
    - "vitest"
    - "unit-tests"
    - "best-practices"
---

# CI Link Validation Spike

## Summary

**Spike Objective:** Prototype a CI check that validates the paths and links listed in `llms.txt` (and other project docs) to ensure references are present and avoid stale links. This test will be simple, fast, and run in CI on PRs.

**Why This Matters:** `llms.txt` is intended to be a navigation aid for LLMs and humans. Stale or missing links reduce its usefulness and cause confusion.

**Timebox:** 2 days

**Decision Deadline:** 2 days from start to avoid merge-time surprises.

## Research Question(s)

**Primary Question:** What is the simplest reliable approach to validate local file links and detect missing files in `llms.txt` during CI?

**Secondary Questions:**

- Should the CI job validate external HTTP links as well, or only local repository paths?
- How to handle generated/ignored files (e.g., `dist/`, local secrets) in validation?

## Investigation Plan

### Research Tasks

- [ ] Parse `llms.txt` and extract markdown-style links and relative paths.
- [ ] Implement a small Node.js script `scripts/validate-links.js` (or TypeScript) that checks the existence of local files referenced.
- [ ] Add a `vitest` or simple `node` script runner step to `package.json` (e.g., `npm run validate:links`) and CI workflow stub.
- [ ] Decide on optional external HTTP checks (configurable with `--check-http` flag).

### Success Criteria

This spike is complete when:

- [ ] A script exists that returns non-zero when a local link is missing.
- [ ] A PR workflow example is provided that runs the script.
- [ ] Documentation added to `README.md` describing how to run locally.

## Technical Context

**Related Components:**

- [llms.txt](../../../llms.txt) (root)
- [package.json](../../../package.json) scripts
- [vitest](../../../node_modules/vitest) (optional runner)

**Constraints:**

- Keep the script fast; only local file existence checks by default.
- Allow optional HTTP checks behind a flag to avoid CI slowness.

## Research Findings

### Investigation Results

[Document implementation notes and sample outputs here]

### Prototype/Testing Notes

[Add outputs and CI snippet here]

### External Resources

- Examples of link validation scripts (open-source projects)

## Decision

### Recommendation
[Record recommended script, flags, and CI workflow snippet here]

### Follow-up Actions

- [ ] Add `scripts/validate-links.js` or `ts`
- [ ] Wire into GitHub Actions as `validate-links` job
- [ ] Document usage in `README.md`

## Status History

| Date | Status | Notes |
| ---- | ------ | ----- |
| 2025-09-26 | 🔴 Not Started | Spike created and scoped |

---

_Last updated: 2025-09-26 by team_

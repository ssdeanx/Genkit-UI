---
title: "Tools Hardening & Sandboxing Spike"
category: "Security"
status: "🔴 Not Started"
priority: "Medium"
timebox: "3 days"
created: 2025-09-26
updated: 2025-09-26
owner: "team"
tags:
  - "technical-spike"
  - "tools"
  - "security"
  - "retry"
  - "sandboxing"
  - "testing"
---

# Tools Hardening & Sandboxing Spike

## Summary

**Spike Objective:** Improve robustness and safety of tool calls used by flows and agents (e.g., `src/tools/wikipediaTool.ts`, `src/tools/weatherTool.ts`, `src/tools/calculatorTool.ts`). Focus on sandboxing, deterministic behavior for tests, caching, and retry semantics.

**Why This Matters:** Agents call external services (web search, Wikipedia) through tools. Failures, slow responses, or unsafe inputs can cascade through flows. Hardened tools improve reliability and make local testing predictable.

**Timebox:** 3 days

**Decision Deadline:** 3 days to avoid introducing fragile tool behavior into agent flows.

## Research Question(s)

**Primary Question:** What patterns and wrappers should we apply to tools to provide timeouts, retries with jitter, input sanitization, and test-mode stubs?

**Secondary Questions:**

- Where to place caching (in the tool layer vs at a higher layer)?
- How should tools expose test hooks for deterministic testing (mock mode)?
- Should tools run in isolated processes or have throttling to avoid blocking the main agent thread?

## Investigation Plan

### Research Tasks

- [ ] Review `src/tools/*` to find current error handling and missing timeouts.
- [ ] Implement a small `tool-wrapper.ts` that provides standard timeouts, retry-with-jitter, and optional caching.
- [ ] Add a `TEST_MODE` env flag path for tools to return deterministic fixtures.
- [ ] Convert `wikipediaTool.ts` to use the wrapper (POC).

### Success Criteria

- [ ] A `tool-wrapper.ts` proof-of-concept is available and one tool converted.
- [ ] Tests demonstrate deterministic behavior with `TEST_MODE=true`.
- [ ] Documentation added to `docs/spikes/tools-hardening-spike.md` with recommended defaults.

## Technical Context
**Related Components:**

- [wikipediaTool.ts](../../src/tools/wikipediaTool.ts)
- [weatherTool.ts](../../src/tools/weatherTool.ts)
- [calculatorTool.ts](../../src/tools/calculatorTool.ts)

**Constraints:**

- Keep the wrapper lightweight and pure-TS so it works in local dev and CI without extra infra.

## Research Findings

[Record findings here]

## Decision

### Recommendation
[Record recommended wrapper and defaults here]

### Follow-up Actions

- [ ] Add `src/tools/tool-wrapper.ts` and convert at least one tool.
- [ ] Add `TEST_MODE` support and test fixtures.

## Status History

| Date | Status | Notes |
| ---- | ------ | ----- |
| 2025-09-26 | 🔴 Not Started | Spike created and scoped |

---

_Last updated: 2025-09-26 by team_

---
title: "Flows Authoring & Testing Spike"
category: "Architecture"
status: "🔴 Not Started"
priority: "Medium"
timebox: "3 days"
created: 2025-09-26
updated: 2025-09-26
owner: "team"
tags:
  - "technical-spike"
  - "flows"
  - "zod"
  - "testing"
    - "vitest"
    - "unit-tests"
    - "integration-tests"
  - "best-practices"
---

# Flows Authoring & Testing Spike

## Summary

**Spike Objective:** Document and prototype best practices for authoring Genkit flows in this repository: structured (Zod) outputs, streaming vs non-streaming choices, and unit/integration testing patterns (Vitest). Provide guidance for reusable flow patterns and testing harnesses.

**Why This Matters:** Flows are the primary way logic is expressed in Genkit; consistent patterns reduce bugs and make agent behavior predictable. The repo includes example flows in `src/flows/` and many agent `genkit.ts` files that create flows — this spike will standardize patterns and testing approaches.

**Timebox:** 3 days

**Decision Deadline:** 3 days to avoid inconsistent flow patterns proliferating.

## Research Question(s)

**Primary Question:** What authoring and testing patterns should be recommended for Genkit flows to maximize reliability, maintainability, and testability?

**Secondary Questions:**

- When to prefer streaming responses vs synchronous responses in flows?
- How to structure Zod schemas for composable flow outputs?
- What test harness is best for flows (unit vs integration) using `vitest`?

## Investigation Plan

### Research Tasks

- [ ] Inventory flows and flow usage in `src/flows/` and `src/agents/*/genkit.ts`.
- [ ] Draft a minimal test harness pattern that can run flows locally with deterministic inputs (mock tools and deterministic `ai` instance, e.g., set temperature to 0).
- [ ] Create an example unit test converting `src/flows/recipeGeneratorFlow.ts` to use the harness.
- [ ] Recommend schema patterns for multi-step flows and streaming partial results.

### Success Criteria

- [ ] Documented authoring guide for flows in `docs/spikes/flows-authoring-spike.md`.
- [ ] A small test harness script in `scripts/` or `test/helpers/` and one converted unit test.

## Technical Context
**Related Components:**

- [recipeGeneratorFlow.ts](../../src/flows/recipeGeneratorFlow.ts)
- [weatherFlow.ts](../../src/flows/weatherFlow.ts)
- [recipeSchema.ts](../../src/schemas/recipeSchema.ts)
- Agent [genkit.ts](../../src/agents/*/genkit.ts) files that compose flows

**Constraints:**

- Tests should be fast and not depend on external API keys by default; use deterministic `ai` (mock) instances.

## Research Findings

[Record findings here]

## Decision

### Recommendation
[Document recommended flow patterns and testing approaches here]

### Follow-up Actions

- [ ] Add test harness helper under `test/helpers/` or `scripts/`.
- [ ] Convert one flow test to use the harness.

## Status History

| Date | Status | Notes |
| ---- | ------ | ----- |
| 2025-09-26 | 🔴 Not Started | Spike created and scoped |

---

_Last updated: 2025-09-26 by team_

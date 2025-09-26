---
title: "Gemini Model Cost & Configuration Spike"
category: "Platform & Infrastructure"
status: "🔴 Not Started"
priority: "High"
timebox: "3 days"
created: 2025-09-26
updated: 2025-09-26
owner: "team"
tags:
  - "technical-spike"
  - "platform"
  - "gemini"
    - "cost"
    - "configuration"
    - "monitoring"
    - "genkit"
---

# Gemini Model Cost & Configuration Spike

## Summary

**Spike Objective:** Evaluate the tradeoffs between Gemini model variants (e.g., Gemini 1.x/2.x/flash) and Genkit configuration options (temperature, streaming, structuredOutput, toolConfig) to produce cost-aware defaults for `src/config.ts`.

**Why This Matters:** `src/config.ts` centralizes the model selection and options used across flows and agents. Choosing default model settings affects cost, latency, and capabilities (structured outputs, tool-calling). This spike recommends safe defaults and gating for production.

**Timebox:** 3 days

**Decision Deadline:** 3 days from start to avoid unexpected cost overruns in integration tests.

## Research Question(s)

**Primary Question:** Which Gemini model variant and Genkit options provide the best balance of cost, latency, and feature set (structured output + tool calling) for our agent workflows?

**Secondary Questions:**

- When should streaming be enabled vs disabled for cost and UX tradeoffs?
- Which options (groundedGeneration, structuredOutput) materially impact cost or token usage?
- What logging/monitoring should we add to measure per-agent model usage and costs?

## Investigation Plan

### Research Tasks

- [ ] Inventory current model usage (`src/config.ts`) and which flows call the model synchronously vs streaming.
- [ ] Research Gemini pricing and model feature matrix for structured outputs and streaming support.
- [ ] Run quick latency/cost experiments using sample prompts from `src/flows/` (recipe + weather) to estimate token usage and latency with two model choices.
- [ ] Propose a configuration matrix for `dev` vs `staging` vs `prod` (e.g., dev: gemini-2.5-flash, stream=true; prod: gemini-2.5-pro, stream=false).
- [ ] Add monitoring suggestions (per-agent model usage metrics, per-request token counts).

### Success Criteria
This spike is complete when:

- [ ] A recommended default config for `src/config.ts` is documented.
- [ ] A small test script exists that can estimate token usage for a sample prompt.
- [ ] Monitoring hooks for token/count metrics are suggested (where and how to emit them).

## Technical Context
**Related Components:**

- [config.ts](../../src/config.ts) (current model selection and Genkit options)
- Flows & agents in [src/flows/](../../src/flows/) and [src/agents/*/genkit.ts](../../src/agents/*/genkit.ts)

**Dependencies:**

- Gemini API docs/pricing
- Genkit options and plugin behavior

**Constraints:**

- Real cost testing requires a Gemini API key; experiments may be limited in local dev without a key.

## Research Findings

### Investigation Results
[Record findings here]

### External Resources

- Gemini pricing and model docs
- Genkit structured output and tool-calling docs

## Decision

### Recommendation
[Write recommendation after experiments]

### Follow-up Actions

- [ ] Update `src/config.ts` with dev/prod profiles and document their differences in `GEMINI.md`.
- [ ] Add a small script to measure token usage for sample flows.

## Status History

| Date | Status | Notes |
| ---- | ------ | ----- |
| 2025-09-26 | 🔴 Not Started | Spike created and scoped |

---

_Last updated: 2025-09-26 by team_

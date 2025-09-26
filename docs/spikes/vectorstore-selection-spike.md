---
title: "Vectorstore Selection Spike"
category: "Architecture"
status: "🔴 Not Started"
priority: "High"
timebox: "3 days"
created: 2025-09-26
updated: 2025-09-26
owner: "team"
tags:
  - "technical-spike"
  - "vectorstore"
  - "architecture"
  - "embeddings"
  - "vector-databases"
  - "scaling"
---

# Vectorstore Selection Spike

## Summary

**Spike Objective:** Evaluate options for the project's vectorstore needs: the dev "dev-local-vectorstore" currently used in `src/config.ts` vs production options (Pinecone, Milvus, Qdrant, Weaviate, Chroma Cloud). Produce recommendations for small-scale dev, staging, and production environments.

**Why This Matters:** Agents use embeddings and vector lookups for tool grounding and context retrieval. Choice of vectorstore affects latency, cost, API compatibility, and operational complexity.

**Timebox:** 3 days

**Decision Deadline:** 3 days from start to avoid blocking memory/recall design work.

## Research Question(s)

**Primary Question:** Which vectorstore(s) provide the best balance of developer ergonomics, cost, and scaling for Genkit-based agent flows?

**Secondary Questions:**

- Is the current `dev-local-vectorstore` sufficient for dev and CI tests?
- Which production options offer the best SDK/TypeScript experience and managed hosting?
- How should embeddings be batched and cached to reduce costs?

## Investigation Plan

### Research Tasks

- [ ] Inventory where vectorstore usage appears in the codebase (search for "vector"/"vectorstore" in `src/`).
- [ ] Compare SDKs, features, and host options for Chroma Cloud, Pinecone, Qdrant, and Weaviate.
- [ ] Prototype small examples inserting and querying 1k vectors in each store (or the ones that provide free tiers / local Docker images).
- [ ] Measure latency and cost estimates for 1k-10k vector operations.
- [ ] Recommend dev vs prod patterns (local Chroma for dev, Pinecone/Qdrant for prod, etc.).

### Success Criteria

This spike is complete when:

- [ ] Clear recommendation for dev/staging/prod vectorstore choices is documented.
- [ ] Prototype scripts and minimal usage notes exist for the recommended option(s).
- [ ] Migration notes and data export/import suggestions are included.

## Technical Context

**Related Components:**

- [config.ts](../../src/config.ts) (dev-local-vectorstore config)
- Any flow or agent that calls vectorstore or embedding functions (inspect [src/agents/*/genkit.ts](../../src/agents/*/genkit.ts) for usage)

**Constraints:**

- Avoid introducing large infra complexity during the spike—use local Docker images or free tiers for experiments.

## Research Findings

### Investigation Results

[Record findings here]

### Prototype/Testing Notes

[Results from small POCs go here]

### External Resources

- Chroma Cloud docs
- Pinecone docs
- Qdrant docs
- Weaviate docs

## Decision

### Recommendation

[Recommend vectorstore(s) and dev/prod configuration after testing]

### Implementation Notes

[Outline changes to `src/config.ts` and helper utilities for cross-store compatibility.]

### Follow-up Actions

- [ ] Add prototypes under `scripts/` or `tools/` to run vectorstore benchmarks
- [ ] Update `src/config.ts` with selectable backends and document in `GEMINI.md`

## Status History

| Date | Status | Notes |
| ---- | ------ | ----- |
| 2025-09-26 | 🔴 Not Started | Spike created and scoped |

---

_Last updated: 2025-09-26 by team_

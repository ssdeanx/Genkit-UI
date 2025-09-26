---
goal: Implement core multi-agent architecture per spec (flows, evaluators, MCP, vectorstore, telemetry, Vertex)
version: 1.0
date_created: 2025-09-26
last_updated: 2025-09-26
owner: Platform AI (sam)
status: Planned
tags:
	- architecture
	- genkit
	- multi-agent
	- evaluations
	- express
	- mcp
	- vectorstore
	- telemetry
	- vertex-ai
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan implements the architecture defined in `spec/spec-architecture-multi-agent-coder-orchestrator.md` across flows, evaluators, MCP integration, dev-local vectorstore, telemetry, Express exposure, and optional Vertex AI support. Execution is deterministic and file-specific.

## 1. Requirements & Constraints

- REQ-001: Genkit context propagation in flows/tools/prompts
- REQ-002: Dotprompt usage for agents; prompts in `src/prompts/*` (moved from previous locations)
- REQ-003: Tools with Zod schemas and safe errors
- REQ-004: Interrupt tooling for risky actions
- REQ-005: Coder streaming parse via defineFormat and final aggregated validation
- REQ-006: Coder idle timeout and max duration with AbortController
- REQ-007: Evaluation flows and datasets; CLI integration
- REQ-008: Use UserFacingError for user-visible issues
- REQ-009: Optional RAG integration
- REQ-010: A2A boundaries observed
- REQ-011: Zod schemas for all I/O
- REQ-012: Prompts registered as tools for triage
- REQ-013: Flows visible in Dev UI; Express exposure
- REQ-014: Custom evaluators via defineEvaluator
- REQ-015: MCP Toolbox integration
- REQ-016: Dev local vectorstore for RAG
- REQ-017: Telemetry enabled and requestId propagation
- REQ-018: Vertex AI provider switch
- REQ-019: Express auth → context provider mapping
- CON-001: TypeScript strict; no any
- CON-002: Respect versions in package.json (Genkit ^1.20.x)
- GUD-001: Prefer ai.prompt()
- GUD-002: Bounded maxTurns in tool loops

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Foundation – config, prompts, context stubs

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Update `src/config.ts` to expose a context provider skeleton with `auth`, `trace.requestId`, flags; add `ENABLE_VERTEX` and `TELEMETRY_ENABLED` env toggles (no behavior change yet). |  |  |
| TASK-002 | Ensure Coder uses `src/prompts/coder_multi_file_codegen.prompt`: set `promptDir` in `src/agents/coder/genkit.ts` and verify `defineCodeFormat(ai)` is registered. | ✅ | 2025-09-26 |
| TASK-003 | Add `docs/runbook-context.md` documenting `context` shape, header mapping for Express. |  |  |

### Implementation Phase 2

- GOAL-002: Flows and Express exposure (Dev UI visible)

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Create `src/flows/orchestratorFlow.ts` with Zod input `{ query: string }` and output `{ planId: string }`; internally call Orchestrator A2A (no business change). |  |  |
| TASK-005 | Create `src/flows/coderEvalFlow.ts` that calls Coder agent with a small spec and returns filenames; Zod schemas. |  |  |
| TASK-006 | Mount flows on Express using `@genkit-ai/express` in `main/src/index.ts` or `src/index.ts`, ensuring they appear in Dev UI; add context provider mapping `Authorization` header → `context.auth.rawToken`. |  |  |
| TASK-007 | Add an interrupt demo tool `src/tools/interrupts/confirmOverwrite.ts` using `ai.defineInterrupt`. |  |  |

### Implementation Phase 3

- GOAL-003: Coder streaming finalization & timeouts

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | In `src/agents/coder/index.ts`, add idle timeout and max duration using `AbortController`; on timeout finalize with aggregated parse. |  |  |
| TASK-009 | Re-parse full text via `CodeMessageSchema.parse()` before publishing final artifacts; fail with `UserFacingError` if invalid. |  |  |
| TASK-010 | Emit artifacts only after validation; keep in-progress updates as is. |  |  |

### Implementation Phase 4

- GOAL-004: Evaluators & datasets

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Create `src/evaluators/codeQuality.ts` with `ai.defineEvaluator` measuring: files count > 0, filenames non-empty, language present; return 0..1 score. |  |  |
| TASK-012 | Create datasets: `datasets/coder.json`, `datasets/editor.json`, `datasets/planner.json` (minimal examples). |  |  |
| TASK-013 | Ensure `package.json` has script `eval:coder`: `genkit eval:flow src/flows/coderEvalFlow.ts --input datasets/coder.json`. |  |  |

### Implementation Phase 5

- GOAL-005: MCP Toolbox and Vectorstore

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Wrap one MCP tool: `src/tools/mcp/dbQueryTool.ts` using `@genkit-ai/mcp` client; strict Zod schemas and timeout (5000 ms). |  |  |
| TASK-015 | Add vectorstore ingestion script `scripts/ingestVectorstore.ts` indexing sample docs to `menuQA`; create retriever util `src/tools/retriever.ts` and demonstrate usage in Planner. |  |  |

### Implementation Phase 6

- GOAL-006: Telemetry

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Wire `@genkit-ai/firebase` telemetry when `TELEMETRY_ENABLED=true` in `src/config.ts`; ensure traces include tool spans and `requestId`. |  |  |
| TASK-017 | Add minimal `docs/telemetry.md` with verification steps in Dev UI. |  |  |

### Implementation Phase 7

- GOAL-007: Vertex AI provider switch

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018 | In `src/config.ts`, support `ENABLE_VERTEX=true` to switch plugin to `@genkit-ai/vertexai` and model IDs (documented). Default remains Google AI plugin. |  |  |
| TASK-019 | Smoke test script `scripts/smoke-vertex.ts` running a simple generation; update docs with model/region config. |  |  |

### Implementation Phase 8

- GOAL-008: CI pipeline for evaluations

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-020 | Create `.github/workflows/eval.yml` to run `npm ci`, start Dev UI server, and execute `genkit eval:flow` for coder dataset; upload results as artifact. |  |  |
| TASK-021 | Gate on minimum score threshold from evaluator; mark job failed if below 0.6. |  |  |

## 3. Alternatives

- ALT-001: Skip MCP and use direct HTTP tools – rejected due to A2A and security boundaries.
- ALT-002: Use production vector store in dev – rejected; dev-local is faster and safer.
- ALT-003: Only Google AI provider – acceptable, but Vertex option retained for enterprise parity.

## 4. Dependencies

- DEP-001: `@genkit-ai/*` packages at ^1.20.x (already present per package.json)
- DEP-002: MCP toolbox availability for selected tool
- DEP-003: Firebase project for telemetry (optional)

## 5. Files

- FILE-001: `src/config.ts` – provider toggle, telemetry, context provider
- FILE-002: `src/agents/coder/index.ts` – timeouts and final validation
- FILE-003: `src/flows/*.ts` – new flows with Zod schemas
- FILE-004: `src/evaluators/*.ts` – custom evaluators
- FILE-005: `src/tools/mcp/*.ts`, `src/tools/retriever.ts` – MCP and vectorstore utils
- FILE-006: `scripts/*.ts` – ingestion and smoke tests
- FILE-007: `datasets/*.json` – evaluation inputs
- FILE-008: `.github/workflows/eval.yml` – CI

## 6. Testing

- TEST-001: Run `genkit start` and verify flows visible in Dev UI; curl Express endpoints return 200 with schema-validated payloads.
- TEST-002: Run `genkit eval:flow src/flows/coderEvalFlow.ts --input datasets/coder.json`; verify evaluator metrics present and > 0.6.
- TEST-003: Cancel a coder task; verify `canceled` status update emitted.
- TEST-004: Trigger idle timeout; verify final aggregated parse runs and either publishes valid artifacts or fails with UserFacingError.
- TEST-005: Ingest vectorstore and retrieve; verify retriever returns snippets in traces.
- TEST-006: Toggle `ENABLE_VERTEX=true` and run `scripts/smoke-vertex.ts`; expect success.
- TEST-007: Telemetry enabled shows traces with `requestId` and tool spans.

## 7. Risks & Assumptions

- RISK-001: Model output format variance may cause parse failures – mitigated by final validation and evaluator checks.
- RISK-002: MCP tool latency or failures – mitigated by timeouts and safe error handling.
- RISK-003: Telemetry configuration in local may require credentials – mitigated by making it optional.
- ASSUMPTION-001: Ports 41242..41248 available; GEMINI_API_KEY provided.

## 8. Related Specifications / Further Reading

- `spec/spec-architecture-multi-agent-coder-orchestrator.md`
- `docs/components/*-documentation.md`
- Genkit docs: flows, evaluators, MCP, telemetry, express, vertex, vectorstore

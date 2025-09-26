---
title: Multi-Agent Architecture Spec for Orchestrator, Planner, Coder, and Content Editor
version: 1.0
date_created: 2025-09-26
last_updated: 2025-09-26
owner: Platform AI (sam)
tags:
  - "architecture"
  - "process"
  - "design"
  - "genkit"
  - "multi-agent"
  - "evaluation"
  - "tool-calling"
  - "interrupts"
  - "rag"
  - "context"
  - "observability"
  - "express"
  - "vertex-ai"
  - "mcp"
  - "vectorstore"
---

# Introduction

This specification defines architecture, requirements, and interfaces to harden and evolve four core agents (Orchestrator, Planner, Coder, Content Editor) built on Google Genkit. It consolidates Genkit capabilities (context propagation, evaluation, interrupts, RAG, tool calling, error types, multi-agent prompts) into actionable design for reliable streaming, structured outputs, evaluation in CI, and safe tool orchestration across agents.

## 1. Purpose & Scope

- Purpose: Provide a unified, AI-ready architecture and contract for agent interactions, streaming code generation, content editing, planning, and orchestration.
- Scope: Applies to `src/agents/*` (orchestrator-agent, planning-agent, coder, content-editor), shared interfaces, and prompts. Does not define external deployment policy.
- Audience: Engineers working on Genkit-based agents; CI owners; QA.
- Assumptions: Node.js + TypeScript; Genkit ^1.20.x; GoogleAI plugin (with optional Vertex AI); A2A protocol already in use.

## 2. Definitions

- Genkit Context: Side-channel object propagated to flows/tools/prompts not necessarily visible to the model.
- Evaluation: Inference-based or raw assessment of outputs using datasets and metrics via Dev UI or CLI.
- Interrupts: Special tool type to pause generation and require external input/approval before resuming.
- RAG: Retrieval-Augmented Generation; enriching prompts with retrieved documents.
- Tool Calling: Genkit loop where models call developer-defined tools with structured I/O.
- Multi-Agent: Top-level agent delegates to specialist agents (prompts-as-tools or A2A endpoints) with focused prompts and tools.
- CodeMessage: Structured code streaming format with Zod schema used by Coder.

## 3. Requirements, Constraints & Guidelines

- REQ-001 (Context): All flows/tools/prompts must accept and propagate a `context` structure with `auth` shape per Genkit docs. Use context for auth, tracing metadata, and per-request flags; do not leak secrets to prompts.
- REQ-002 (Dotprompt): Each agent uses prompt files via `ai.prompt('<name>')`. Coder prompts are placed under `.github/prompts/coder/*` to enable language-specific templates. Planner and Editor use their dedicated prompt files.
- REQ-003 (Tool Calling): Orchestrator and specialist agents define tools via `ai.defineTool` with Zod schemas. Tools must include clear `description`, input/output schemas, and safe error handling.
- REQ-004 (Interrupts): Use `defineInterrupt` or restartable tools when human-in-the-loop confirmation is required (e.g., risky file overwrites or deletions in Coder). Respect `finishReason === 'interrupted'` and handle `resume`.
- REQ-005 (Coder Streaming): Coder must parse streamed output using a registered `defineFormat` (CodeMessage). Apply per-chunk validation and a final aggregated validation before publishing artifacts. Enforce that each file has a non-empty filename and content.
- REQ-006 (Finalization & Timeouts): Coder must implement idle timeout and max duration using AbortController. On timeout, run final validation of aggregated text and either publish valid artifacts or fail gracefully with diagnostics.
- REQ-007 (Evaluation): Provide at least one evaluation flow per agent (or a wrapper flow) and dataset support. Use `genkit eval:flow` in CI with selected metrics (regex/JSONata/custom) to catch regressions.
- REQ-008 (Error Types): Use `UserFacingError` for user-visible conditions and generic errors for internal failures. Ensure hosting adapters mask internal errors.
- REQ-009 (RAG Optional): Planner and Editor may integrate retrievers; when used, attach retrieved `docs` to model calls; do not excessively expand context window without evaluation of cost/benefit.
- REQ-010 (A2A Boundaries): Orchestrator delegates using A2A protocol to Planner/Coder/Editor. Avoid direct HTTP-cheating for cross-agent calls; keep messages typed via shared interfaces.
- REQ-011 (Schemas): All inputs/outputs for flows/tools/prompts must use Zod schemas with explicit field docs. Planner emits `ResearchPlan`; Editor emits `EditedContent`; Coder emits `CodeMessage` artifacts.
- REQ-012 (Prompts-as-Tools): For multi-agent triage, register specialist prompts as tools on the Orchestrator triage prompt. Keep descriptions crisp so the model routes well.
- REQ-013 (Flows & Express): Expose key agent capabilities as Genkit flows (with Zod input/output) and, where applicable, mount them on Express via the Genkit Express adapter. Flows must appear in the Dev UI and be callable with context.
- REQ-014 (Custom Evaluators): Implement at least one custom evaluator per domain (e.g., code correctness, editorial quality) using `ai.defineEvaluator`. Evaluators must be runnable via `genkit eval:flow`/`eval:run` and surface metrics in the Dev UI.
- REQ-015 (MCP Toolbox Integration): Integrate selected MCP tools by wrapping them as Genkit tools with strict Zod schemas, timeouts, and error handling. Use them from Planner/Research/Coder when appropriate.
- REQ-016 (Dev Local Vectorstore): Use `@genkit-ai/dev-local-vectorstore` for development-time RAG. Provide ingestion and retrieval utilities, configurable via env/flags; avoid coupling to prod stores.
- REQ-017 (Telemetry/Observability): Enable telemetry (Firebase plugin or equivalent). Capture traces, metrics, and logs for flows/tools; propagate `requestId` in context; exclude PII from logs.
- REQ-018 (Vertex AI Optional): Provide a configuration switch to use `@genkit-ai/vertexai` models in addition to `@genkit-ai/google-genai`. Document model IDs, region, and feature parity. Default remains Google AI plugin unless overridden.
- REQ-019 (Express Auth Context): When flows are mounted on Express, extract auth from headers/session and inject into Genkit `context.auth` via a context provider.
- CON-001: Maintain TypeScript strict mode; avoid `any`.
- CON-002: Respect existing package versions and project style from `.github/copilot-instructions.md`.
- GUD-001: Prefer `ai.prompt()` callable pattern and Genkit Developer UI for prompt iteration.
- GUD-002: Use `maxTurns` for tool loops with bounded cost in Orchestrator.

## 4. Interfaces & Data Contracts

- Context (subset):
  - `auth: { uid: string; token?: object; rawToken?: string }`
  - `trace?: { requestId: string; parentId?: string }`
  - `flags?: { dryRun?: boolean; allowOverwrite?: boolean }`

- Orchestrator → Planner:
  - Input: `{ query: string, constraints?: object }`
  - Output: `ResearchPlan` (shared schema) with steps, risks, and acceptance criteria.

- Orchestrator → Coder:
  - Input: `{ specification: string; language: string; templateName?: string }` via prompt `coder/multi-file-codegen` or language-specific template.
  - Output: `CodeMessage` with `files: Array<{ filename: string; content: string }>` and optional `done` markers. Final artifacts only after validation.

- Orchestrator → Content Editor:
  - Input: `{ content: string; goals?: string[]; tone?: 'formal'|'casual' }`
  - Output: `{ edited: string; changeset?: string[] }` with rationale.

- Tool Contracts (examples):
  - `getWeather` (demo): `input: { location: string } -> output: string`
  - `askQuestion` (interrupt): `input: { choices: string[], allowOther?: boolean } -> output: string`

## 5. Acceptance Criteria

- AC-001 (Coder Finalization): Given a streaming generation that emits partial chunks, when the stream ends or idle timeout triggers, then the Coder re-parses the aggregated text and Zod-validates `CodeMessage`; only then publishes final artifacts.
- AC-002 (Interrupt Safety): Given a risky action (overwrite), when `allowOverwrite` flag is false, then an interrupt fires to request user confirmation; upon `APPROVED`, action proceeds; upon `REJECTED`, action is aborted with `UserFacingError`.
- AC-003 (Evaluation CLI): Given a dataset `coderDataset.json`, when `genkit eval:flow coderEvalFlow --input coderDataset.json` runs, then results appear in Dev UI and any configured metrics are computed without runtime errors.
- AC-004 (Context Propagation): Given a flow call with `{ context: { auth: { uid }}}`, when inner tools/prompts run, then they can access the same `uid` unless explicitly overridden.
- AC-005 (Tool Loop Bounds): Orchestrator generations using tools set `maxTurns` to a bounded value and never exceed it; when limit is reached, the response is gracefully returned.
- AC-006 (Flows Visible & Express Mounted): All declared flows appear in Genkit Dev UI with correct schemas and can be invoked successfully. If Express is enabled, corresponding endpoints return 200 with validated I/O.
- AC-007 (Custom Evaluator Runs): A custom evaluator executes via `genkit eval:flow` or `eval:run` against a small dataset and records at least one metric without runtime errors.
- AC-008 (MCP Tool Usage): At least one MCP-wrapped tool can be called by an agent (e.g., Coder or Research) within a bounded timeout with structured I/O and safe failure modes.
- AC-009 (Vectorstore RAG): Ingest sample documents into the dev local vector store and retrieve them via a retriever; retrieved snippets are attached to the prompt call and visible in traces.
- AC-010 (Telemetry Present): Telemetry backend shows traces/metrics for a representative flow run, including propagated `requestId` and tool invocations; no PII present in logs.
- AC-011 (Vertex AI Switch): When the Vertex AI config switch is on, a smoke flow completes successfully using a Vertex model; when off, the system uses the Google AI plugin path.

## 6. Test Automation Strategy

- Test Levels: Integration (preferred) and flow-level evaluation runs; unit tests optional for parsers.
- Frameworks: Vitest for integration; Genkit Dev UI for dataset/evaluation.
- CI/CD Integration: Add a job that starts the app and runs `genkit eval:flow` with a small dataset for each key agent wrapper flow.
- Coverage: Focus on parser correctness (Coder) and prompt-tool loops (Orchestrator).
- Performance: Enforce idle timeouts; avoid unbounded tool loops.

## 7. Rationale & Context

- Context: Keeps security-sensitive data out of model prompts but available to tools.
- Evaluation: Provides measurable quality signals (especially for Coder/content) in CI.
- Interrupts: Required for human gates when model proposes sensitive operations.
- RAG: Optional for Planner/Editor to ground decisions; keep costs controlled.
- Tool Calling & Multi-Agent: Scales capabilities by routing tasks to specialized prompts/tools.

## 8. Dependencies & External Integrations

### External Systems

- EXT-001: Google Generative AI via `@genkit-ai/google-genai` for models.
- EXT-002: Vertex AI via `@genkit-ai/vertexai` (optional, switchable).

### Third-Party Services

- SVC-001: Vector stores (optional) for RAG: e.g., Dev Local Vector Store during dev.
- SVC-002: Telemetry backend (e.g., Firebase/Cloud) for traces/metrics/logs.

### Infrastructure Dependencies

- INF-001: Genkit Dev UI and CLI (`genkit start`, `genkit eval:*`).
- INF-002: Express server for agents/flows exposure when enabled.
- INF-003: MCP server/toolbox (optional) reachable by the MCP client wrapper.

### Data Dependencies

- DAT-001: Datasets for evaluation stored locally (JSON) or via Dev UI datasets.

### Technology Platform Dependencies

- PLT-001: Node.js + TypeScript; Genkit ^1.20.x; Express ^4.x if used by agents.
- PLT-002: `@genkit-ai/express` adapter (if used) compatible with Genkit version.
- PLT-003: `@genkit-ai/dev-local-vectorstore` for local RAG in development.

### Compliance Dependencies

- COM-001: Secrets management via environment variables; do not leak in prompts.

## 9. Examples & Edge Cases

```ts
// Coder finalization (pseudo):
const aggregated: string[] = [];
for await (const chunk of stream) {
  aggregated.push(chunk.text ?? '');
  const partial = codeFormat.parseChunk(chunk); // tolerant
  if (partial) publishInProgress(partial);
}
const final = codeFormat.parseMessage(aggregated.join(''));
CodeMessageSchema.parse(final);
publishFinalArtifacts(final.files);
```

Edge cases:

- Model emits malformed fences: partial parse tolerated; final parse must pass.
- Idle stream: abort after idleTimeout and finalize best-effort with clear status.
- Interrupt multiple outstanding requests: handle `response.interrupts` array.
- Tool loop exceeds maxTurns: exit gracefully; include partial results if any.

## 10. Validation Criteria

- VC-001: Orchestrator, Planner, Coder, Editor flows compile with strict TS and pass lint.
- VC-002: `genkit start -- <dev command>` opens Dev UI; prompts load from `.github/prompts`.
- VC-003: `genkit eval:flow <agentEvalFlow> --input <dataset.json>` runs successfully with at least one metric.
- VC-004: Coder publishes final artifacts only after schema validation.

## 11. Related Specifications / Further Reading

- Genkit Docs: context, evaluation, interrupts, RAG, tool-calling, error-types, multi-agent.
- Project file: `GENKIT.md` for CLI usage guidance.
- `.github/prompts/coder/*` for coder prompt templates.

## 12. Operational Notes (non-binding)

- Flows & Express: Ensure flows are defined with Zod schemas and appear in the Dev UI. If mounting on Express, use the Genkit Express adapter and register a context provider to map HTTP auth → `context.auth`.
- Evaluations: Start with a small JSON dataset per agent. Implement at least one custom evaluator via `ai.defineEvaluator` and run it locally; wire a CI job to run a minimal eval to prevent regressions.
- MCP: Select a small set of high-signal MCP tools. Wrap them as Genkit tools with strict schemas, short timeouts, and retries. Avoid exposing raw network surfaces to model prompts.
- Vectorstore: Use `@genkit-ai/dev-local-vectorstore` for development. Provide simple ingestion scripts/utilities and a retriever used by Planner/Editor when grounding helps.
- Telemetry: Enable Firebase/Cloud telemetry in development. Verify traces, tool spans, and error logs. Tag with `requestId` to correlate across agents.
- Vertex AI: Add a configuration flag to toggle providers. Validate smoke runs on both providers and document any feature gaps or model differences.

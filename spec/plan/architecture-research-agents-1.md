---
goal: Implement flows and wiring for Research Agents (Web, News, Academic, Data Analysis, Content Editor)
version: 1.1
date_created: 2025-09-27
last_updated: 2025-09-27
owner: Platform AI (sam)
status: 'Planned'
tags:
  - feature
  - architecture
  - agents
  - flows
  - genkit
  - a2a
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan implements the flows and wiring defined in `spec/spec-architecture-research-agents.md` to expose the Research Agents via Genkit flows and ensure A2A-compliant behavior. It will create five new flows (web, news, academic, data analysis, content editor), export them in `src/index.ts`, and register them in `src/flowServer.ts`. The plan follows Genkit docs for flows, Express integration, tool-calling, and Dotprompt and includes deterministic tasks with objective validation criteria.

## 1. Requirements & Constraints

- REQ-001: Create flows with Zod schemas as specified in the spec (web/news/academic/dataAnalysis/contentEditor).
- REQ-002: Export all new flows in `src/index.ts`.
- REQ-003: Register flows in `src/flowServer.ts` so they appear in Dev UI via `startFlowServer` (per Genkit Express docs).
- REQ-004: Each flow MUST call its corresponding Dotprompt via `ai.prompt('<id>')` and return schema-validated output (per Dotprompt docs).
- REQ-005: All code MUST compile under TypeScript strict mode with no `any` in new code.
- REQ-006: Implement safe structured output; if `output` is null, throw a `UserFacingError` with a clear message.
- REQ-007: Use `googleAI.model('gemini-2.5-flash')` implicitly via `src/config.ts` and respect `promptDir: './src/prompts'`.
- SEC-001: Do not log secrets; validate required env (GEMINI_API_KEY) without leaking values.
- CON-001: Respect existing project versions (Genkit ^1.20.x; TS ^5.9.x; Express ^4.21.x) and repository patterns.
- GUD-001: Keep functions cohesive and short; mirror patterns in existing flows (e.g., `weatherFlow.ts`).
- PAT-001: Use `ai.defineFlow` with `inputSchema`/`outputSchema` and return typed outputs (per Genkit Flows docs).

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Create Web, News, Academic, Data Analysis, and Content Editor flows with Zod schemas and Dotprompt calls

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `src/flows/webResearchFlow.ts` defining `export const webResearchFlow = ai.defineFlow({...})` with input/output per spec 4.3/4.4.1; invoke `const webPrompt = ai.prompt('web_research')`; call and return validated output; throw `UserFacingError` on null output. |  |  |
| TASK-002 | Create `src/flows/newsResearchFlow.ts` defining `newsResearchFlow` per spec 4.3/4.4.2; use `ai.prompt('news_research')`; handle null output with `UserFacingError`. |  |  |
| TASK-003 | Create `src/flows/academicResearchFlow.ts` defining `academicResearchFlow` per spec 4.3/4.4.3; use `ai.prompt('academic_research')`; handle null output with `UserFacingError`. |  |  |
| TASK-004 | Create `src/flows/dataAnalysisFlow.ts` defining `dataAnalysisFlow` per spec 4.3/4.4.4; use `ai.prompt('data_analysis')`; handle null output with `UserFacingError`. |  |  |
| TASK-005 | Create `src/flows/contentEditorFlow.ts` defining `contentEditorFlow` to call `ai.prompt('content_editor')` and return `{ edited: string }`. |  |  |

Dependencies: None between TASK-001..TASK-004 (parallelizable). TASK-005 independent.

Completion criteria:

- Each file compiles with strict types; `ai.defineFlow` present with Zod `inputSchema` and `outputSchema`.
- Each flow calls its Dotprompt by ID and returns `response.output` validated by Zod.
- On invalid/empty output, a `UserFacingError` is thrown with code `INVALID_ARGUMENT` and message explaining the schema mismatch.

### Implementation Phase 2

- GOAL-002: Export and register flows for Dev UI visibility

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Update `src/index.ts` to export all new flows using `export { webResearchFlow } from './flows/webResearchFlow.js'` etc. |  |  |
| TASK-007 | Update `src/flowServer.ts` to import and include new flows in the `flows` array for `startFlowServer({ flows })`. |  |  |

Dependencies: Phase 1 tasks must be complete.

Completion criteria:

- Genkit Dev UI lists all new flows under Run tab.
- Console logs from `flowServer.ts` include new flow names.

### Implementation Phase 3

- GOAL-003: Validation, typecheck, and minimal datasets

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Run typecheck via internal error scan (`get_errors` tool) targeting changed files; resolve all diagnostics to zero. |  |  |
| TASK-009 | Add minimal datasets: `datasets/web.json`, `datasets/news.json`, `datasets/academic.json`, `datasets/data-analysis.json`, `datasets/editor.json`. Include 1-2 example inputs per flow. |  |  |
| TASK-010 | Smoke test flows in Dev UI; verify outputs conform to schemas; confirm invalid JSON triggers `UserFacingError`. |  |  |

Dependencies: Phases 1 and 2 complete.

Completion criteria:

- `get_errors` reports PASS for new/edited files; no TypeScript errors remain.
- Flows return schema-conformant results in Dev UI with valid prompts.
- Negative-path testing shows clear, user-facing errors on invalid output.

## 3. Alternatives

- **ALT-001**: Implement flows as direct HTTP calls to agents instead of prompts — Rejected to maintain Genkit prompt parity and keep flows self-contained for Dev UI.
- **ALT-002**: Combine all research flows into a single polymorphic flow — Rejected due to clarity and testing simplicity for discrete flows.

## 4. Dependencies

- DEP-001: Genkit ^1.20.x available and configured (`src/config.ts` with `ai = genkit({...})`).
- DEP-002: Dotprompts available in `src/prompts` (`web_research.prompt`, `news_research.prompt`, `academic_research.prompt`, `data_analysis.prompt`, `content_editor.prompt`).
- DEP-003: Environment `GEMINI_API_KEY` provided.
- DEP-004: `@genkit-ai/express` available to run `startFlowServer` and expose flows (per Express docs).

## 5. Files

- FILE-001: `src/flows/webResearchFlow.ts` — Defines `webResearchFlow`.
- FILE-002: `src/flows/newsResearchFlow.ts` — Defines `newsResearchFlow`.
- FILE-003: `src/flows/academicResearchFlow.ts` — Defines `academicResearchFlow`.
- FILE-004: `src/flows/dataAnalysisFlow.ts` — Defines `dataAnalysisFlow`.
- FILE-005: `src/flows/contentEditorFlow.ts` — Defines `contentEditorFlow`.
- FILE-006: `src/index.ts` — Export new flows.
- FILE-007: `src/flowServer.ts` — Register flows in server.
- FILE-008: `datasets/*.json` — Minimal dataset files for new flows.

## 6. Testing

- TEST-001: Typecheck: `get_errors` on new/edited files returns PASS.
- TEST-002: Flow schema validation: Dev UI invocation returns outputs matching 4.4.x JSON structures.
- TEST-003: Prompt invocation: Flows call the correct prompt id and pass messages/context if needed.
- TEST-004: Error path: Invalid JSON from model yields a thrown error with a clear message.
- TEST-005: Express server: Start flows server and verify endpoints respond (e.g., `POST /webResearchFlow`).

## 7. Risks & Assumptions

- RISK-001: Prompt outputs may not strictly adhere to JSON — mitigated via strict parse and error surface.
- RISK-002: Dotprompts missing or misnamed — mitigate by verifying prompt IDs exist in `src/prompts`.
- ASSUMPTION-001: Dotprompts are accurate and stable; environment has API key configured.
- ASSUMPTION-002: `@genkit-ai/express` `startFlowServer` behavior matches docs for listing/serving flows.

## 8. Related Specifications / Further Reading

- `spec/spec-architecture-research-agents.md`
- `.github/prompts/update-implementation-plan.prompt.md`
- `GENKIT.md` (see js/flows.md; js/frameworks/express.md; js/tool-calling.md; js/dotprompt.md)
- Genkit docs referenced:
  - Flows: js/flows.md
  - Express plugin: js/frameworks/express.md
  - Tool calling: js/tool-calling.md
  - Dotprompt: js/dotprompt.md
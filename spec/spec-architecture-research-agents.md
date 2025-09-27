---
title: Multi-Agent Research Suite (Web, News, Academic, Data Analysis, Content Editor)
version: 1.0
date_created: 2025-09-27
last_updated: 2025-09-27
owner: Platform AI (sam)
tags:
  - architecture
  - process
  - agents
  - genkit
  - a2a
  - research
  - analysis
  - content
---

# Introduction

This specification defines the architecture, requirements, constraints, interfaces, and validation criteria for a suite of A2A-compliant research and analysis agents: Web Research, News Research, Academic Research, Data Analysis, and Content Editor. These agents coordinate via A2A, use Google Genkit for prompting with dotprompts, and expose consistent task semantics and optional streaming. The spec also defines flow contracts so these agents can be exercised from the Genkit Dev UI and Flow server.

## 1. Purpose & Scope

- Purpose: Provide a consistent, production-ready foundation for research/analysis agents with A2A compliance, Genkit integration, schema-driven outputs, and flow exposure for testing and orchestration.
- Scope:
  - Agents: web-research-agent, news-research-agent, academic-research-agent, data-analysis-agent, content-editor.
  - Interop: A2A protocol, Agent Cards, task status updates, cancellation, optional streaming.
  - Model: Genkit with Google AI (Gemini 2.5 Flash) and dotprompts for each agent.
  - Flows: Web/News/Academic/Data Analysis flows surfaced in Dev UI via `flowServer.ts` and exported in `src/index.ts`.
- Audience: System integrators, agent implementers, QA engineers, orchestrator developers.
- Assumptions: Node.js/TypeScript environment; Genkit ^1.20.x; Express ^4.21.x; API keys present for external services.

## 2. Definitions

- A2A: Agent-to-Agent protocol for standardized agent communication and control semantics.
- Agent Card: Machine-readable descriptor at `/.well-known/agent-card.json` describing agent capabilities.
- Task: A2A unit of work with id, contextId, status (submitted|working|completed|failed|canceled), history, artifacts.
- Genkit: Google Genkit framework for prompts, flows, tools, evaluators, and telemetry.
- Dotprompt: Prompt file with metadata/templating (e.g., `web_research.prompt`).
- Credibility Score: 0–1 score indicating source reliability with qualitative factors and level (low/medium/high).
- Research Finding: Claim/evidence tuple with sources, confidence, and category.
- Dataset: JSON input used by evaluators to benchmark flows/agents.
- Cancellation: A2A cancel pathway that produces final `canceled` status quickly.

## 3. Requirements, Constraints & Guidelines

- REQ-001: All agents MUST implement A2A with `DefaultRequestHandler` and `A2AExpressApp`; expose a valid Agent Card.
- REQ-002: Agents MUST support task lifecycle: submitted → working (streaming allowed) → completed|failed|canceled.
- REQ-003: Agents MUST map A2A history to Genkit `MessageData` for prompt calls with role mapping (user|agent → user|model).
- REQ-004: Agents MUST handle cancellation promptly; publish a final `canceled` status and cease further processing.
- REQ-005: Agents MUST use their dotprompt and produce JSON-parseable outputs where the prompt requires JSON (web/news/academic/data-analysis).
- REQ-006: Agents MUST fail fast with descriptive errors on parse or external API errors; no silent success. Simulated fallbacks are allowed only if explicitly permitted by the prompt and clearly labeled.
- REQ-007: Agents MUST validate required env vars (e.g., `GEMINI_API_KEY`; `SERPAPI_API_KEY`/`NEWSAPI_API_KEY` where applicable) and exit with a clear message if missing.
- REQ-008: Agents MUST reject empty/no-text message inputs with a clear failed status.
- REQ-009: Agents SHOULD publish artifact metadata for machine consumption only when non-empty/valid.
- REQ-010: Agents SHOULD provide key stage logs (submitted, searching, analyzing, synthesizing, completed/failed) without leaking secrets.
- REQ-011: Agents SHOULD cap tool/API calls/loops; avoid unbounded retries (bounded `maxTurns`).
- REQ-012: All agents MUST compile under TypeScript strict mode; avoid `any` in core logic; prefer precise interfaces.
- REQ-013: Ports MUST be configurable via env with defaults: web=41243, academic=41245, news=41246, data-analysis=41247, content-editor=10003.
- REQ-014: Dotprompts for each flow MUST exist in `src/prompts` and be discoverable via `promptDir` (see `src/config.ts`). Required prompt ids: `web_research`, `news_research`, `academic_research`, `data_analysis`, `content_editor`.
- REQ-015: Flows MUST be wired to use the above dotprompts (ai.prompt('<id>')) and return strict, schema-validated outputs (see Section 4.4).
- REQ-016: Expanded Tooling MUST be documented and implemented incrementally (Section 4.5), each tool defined with Zod schemas, safe errors, and bounded `maxTurns` when used in tool loops.
- SEC-001: API keys MUST NOT be logged; use environment variables and dotenv; do not embed secrets.
- SEC-002: Production deployments MUST configure auth on Express/A2A (securitySchemes + security); dev may run open.
- CON-001: Respect repo versions: Genkit ^1.20.x; TypeScript ^5.9.x; Express ^4.21.x; Node types ^24.5.x.
- CON-002: In-memory task store is sufficient for dev; persistence is future work.
- GUD-001: Prefer `ai.prompt()` for prompt invocation; pass `messages` consistently.
- GUD-002: For JSON-output prompts, parse strictly and surface parse errors; simulated output must be explicit.
- GUD-003: Keep Agent Card skills aligned with actual capabilities; default input/output modes include `text`; `streaming: true`.
- PAT-001: Startup env validation → initial Task publish on submit → periodic working updates → final status (completed/failed/canceled) → optional artifacts.

Alignment with documentation:

- Follow GENKIT.md local rules: keep provider `@genkit-ai/google-genai` unless user toggles; flows defined with `ai.defineFlow` and Zod schemas; expose via Express using `@genkit-ai/express` `startFlowServer`.
- Follow Genkit docs (js/dotprompt.md, js/flows.md, js/frameworks/express.md, js/tool-calling.md) for prompt management, flow definition, server exposure, and tool calling.

## 4. Interfaces & Data Contracts

### 4.1 A2A Endpoints (common)

- `/.well-known/agent-card.json` → AgentCard
- `POST /a2a/task` → Submit task (DefaultRequestHandler)
- `GET /a2a/task/{taskId}` → Retrieve task state/history
- `POST /a2a/task/{taskId}/cancel` → Cancel task
- Streaming: SSE or chunked status updates where supported by the A2A library.

### 4.2 Message Mapping (A2A → Genkit)

- Role mapping: A2A `user` → Genkit `user`; A2A `agent` → Genkit `model`.
- Include only text parts with non-empty text. Ignore non-text parts for prompt calls.

### 4.3 Flow Contracts (Genkit Flows)

Flows MUST be exported in `src/index.ts` and registered in `src/flowServer.ts` so they appear in Dev UI.

#### Web Research Flow

- Name: `webResearchFlow`
- Input (Zod schema):
  - `query: string` (required)
  - `researchScope?: string`
  - `credibilityThreshold?: number` (0..1)
- Output: `webResearch` object as defined in 4.4.1

#### News Research Flow

- Name: `newsResearchFlow`
- Input (Zod schema):
  - `query: string` (required)
  - `newsScope?: string`
  - `urgencyLevel?: 'breaking' | 'high' | 'normal'`
- Output: `newsResearch` object as defined in 4.4.2

#### Academic Research Flow

- Name: `academicResearchFlow`
- Input (Zod schema):
  - `query: string` (required)
  - `researchDomain?: string`
  - `methodologicalFocus?: string`
- Output: `academicResearch` object as defined in 4.4.3

#### Data Analysis Flow

- Name: `dataAnalysisFlow`
- Input (Zod schema):
  - `query: string` (required)
  - `analysisType?: string`
  - `dataCharacteristics?: string`
  - `data?: unknown` (optional payload or reference)
- Output: `dataAnalysis` object as defined in 4.4.4

#### Content Editor Flow (optional convenience)

- Name: `contentEditorFlow`
- Input (Zod schema):
  - `text: string` (required)
  - `style?: string`
- Output: `{ edited: string }` (final polished content)

### 4.4 JSON Output Structures

4.4.1 Web Research Output

```json
{
  "webResearch": {
    "query": "original research query",
    "searchStrategy": {
      "queries": ["search query 1"],
      "sources": ["search engine", "government"],
      "timeframe": "last 12 months"
    },
    "findings": [
      {
        "topic": "sub-topic",
        "summary": "key info",
        "sources": [
          {
            "url": "https://example.com",
            "title": "Source Title",
            "credibilityScore": 0.78,
            "publicationDate": "2024-09-10T00:00:00Z",
            "keyExcerpts": ["relevant quote"]
          }
        ],
        "confidence": 0.7,
        "supportingEvidence": "explanation"
      }
    ],
    "analysis": {
      "keyInsights": ["insight"],
      "contradictions": [],
      "gaps": [],
      "recommendations": []
    },
    "metadata": {
      "totalSources": 12,
      "averageCredibility": 0.72,
      "researchTime": "~20m",
      "lastUpdated": "2025-09-27T00:00:00Z"
    }
  }
}
```

4.4.2 News Research Output

```json
{
  "newsResearch": {
    "query": "original news research query",
    "newsSearch": {
      "timeframe": "breaking",
      "sources": ["Reuters", "AP"],
      "geographicScope": "global",
      "focusAreas": ["technology"]
    },
    "newsFindings": [
      {
        "event": "specific news event",
        "timeline": [
          {
            "date": "2025-09-27T02:00:00Z",
            "headline": "headline",
            "summary": "key details",
            "sources": [
              {
                "outlet": "Reuters",
                "url": "https://example.com",
                "credibilityScore": 0.92,
                "publicationDate": "2025-09-27T01:30:00Z",
                "biasAssessment": "neutral",
                "keyQuotes": ["quote"]
              }
            ]
          }
        ],
        "currentStatus": "developing",
        "impactLevel": "international",
        "stakeholderImpacts": ["affected groups"]
      }
    ],
    "mediaAnalysis": {
      "coverageConsensus": "high",
      "dominantNarratives": ["narrative"],
      "underreportedAspects": [],
      "mediaBiasObservations": [],
      "factCheckingStatus": "verified"
    },
    "contextAndAnalysis": {
      "historicalContext": "background",
      "expertReactions": ["expert quote"],
      "publicReaction": "summary",
      "futureImplications": "implications",
      "relatedStories": ["related headline"]
    },
    "metadata": {
      "totalArticles": 18,
      "dateRange": "2025-09-26 to 2025-09-27",
      "primarySources": 6,
      "credibilityAverage": 0.84,
      "lastUpdated": "2025-09-27T02:10:00Z",
      "breakingNews": true
    }
  }
}
```

4.4.3 Academic Research Output

```json
{
  "academicResearch": {
    "query": "original research query",
    "literatureSearch": {
      "databases": ["Google Scholar", "arXiv", "Semantic Scholar"],
      "searchQueries": ["query 1"],
      "dateRange": "2019-2025",
      "inclusionCriteria": ["peer-reviewed", "impact factor > 2.0"]
    },
    "scholarlyFindings": [
      {
        "topic": "finding area",
        "keyStudies": [
          {
            "title": "Study Title",
            "authors": ["Author One", "Author Two"],
            "journal": "Journal Name",
            "publicationYear": 2023,
            "doi": "10.1234/journal.12345",
            "citations": 150,
            "impactFactor": 4.5,
            "methodology": "systematic review",
            "keyFindings": "summary",
            "qualityScore": 0.9
          }
        ],
        "consensusLevel": "high",
        "evidenceStrength": "strong",
        "researchGaps": ["gap 1"]
      }
    ],
    "methodologicalAnalysis": {
      "dominantApproaches": ["quantitative"],
      "methodologicalStrengths": ["peer review"],
      "methodologicalLimitations": ["sample size"],
      "recommendations": ["replication studies"]
    },
    "citationAnalysis": {
      "keyInfluentialWorks": ["work 1"],
      "emergingTrends": ["trend 1"],
      "researchFrontiers": ["frontier 1"]
    },
    "metadata": {
      "totalPublications": 25,
      "averageImpactFactor": 3.2,
      "dateRange": "2019-2025",
      "lastUpdated": "2025-09-27T00:00:00Z",
      "searchCompleteness": 0.85
    }
  }
}
```

4.4.4 Data Analysis Output

```json
{
  "dataAnalysis": {
    "query": "original data analysis query",
    "dataAssessment": {
      "dataSources": ["source 1"],
      "sampleSize": 1000,
      "dataQuality": "high",
      "variables": ["x", "y"],
      "missingData": "2%"
    },
    "statisticalAnalysis": {
      "methodology": "inferential",
      "testsPerformed": [
        {
          "testName": "regression",
          "variables": ["x", "y"],
          "results": {
            "statistic": 5.12,
            "pValue": 0.002,
            "effectSize": 0.42,
            "confidenceInterval": [0.21, 0.63],
            "interpretation": "significant positive association"
          }
        }
      ],
      "keyFindings": ["finding 1"],
      "statisticalPower": 0.86
    },
    "dataVisualization": {
      "recommendedCharts": [
        {
          "type": "scatterplot",
          "variables": ["x", "y"],
          "insights": "linear pattern",
          "dataRange": "x:0-100,y:0-100"
        }
      ],
      "visualizationPrinciples": ["clear labeling", "appropriate scales"]
    },
    "quantitativeInsights": {
      "primaryConclusions": ["conclusion"],
      "effectMagnitudes": ["moderate"],
      "practicalSignificance": ["implication"],
      "limitations": ["limitation"],
      "recommendations": ["next step"]
    },
    "methodologicalNotes": {
      "assumptionsTested": ["normality"],
      "robustnessChecks": ["sensitivity analysis"],
      "alternativeAnalyses": ["non-parametric"],
      "dataTransparency": "documented"
    },
    "metadata": {
      "analysisDate": "2025-09-27T00:00:00Z",
      "softwareTools": ["R", "Python"],
      "statisticalMethods": ["regression"],
      "confidenceLevel": 0.95,
      "reproducibilityScore": 0.9,
      "dataLastUpdated": "2025-09-27T00:00:00Z"
    }
  }
}
```

4.4.5 Content Editor Output

- Output MUST be final polished content as plain text. For A2A, the final status-update `message.parts[0].text` contains the edited content. If exposed as a flow, return `{ "edited": "..." }`.

### 4.5 Dotprompts

Dotprompt files MUST exist in `src/prompts` with the following ids and core content requirements:

- `src/prompts/web_research.prompt`
  - role: system; persona: expert web research AI; MUST instruct to output valid JSON matching 4.4.1.
  - variables: `query`, `researchScope?`, `credibilityThreshold?`, `now`.
- `src/prompts/news_research.prompt`
  - role: system; persona: expert news research AI; MUST output JSON matching 4.4.2.
  - variables: `query`, `newsScope?`, `urgencyLevel?`, `now`.
- `src/prompts/academic_research.prompt`
  - role: system; persona: expert academic research AI; MUST output JSON matching 4.4.3.
  - variables: `query`, `researchDomain?`, `methodologicalFocus?`, `now`.
- `src/prompts/data_analysis.prompt`
  - role: system; persona: expert data analyst; MUST output JSON matching 4.4.4.
  - variables: `query`, `analysisType?`, `dataCharacteristics?`, `now`.
- `src/prompts/content_editor.prompt` (already present)
  - role: system; persona: expert editor; MUST output final polished text only.

All dotprompts MUST include explicit "ALWAYS output valid JSON" (where applicable), avoid extra prose, and define example outputs. See js/dotprompt.md for best practices.

### 4.6 Tooling (Expanded Set)

The following tools are proposed to enhance research and analysis reliability. Each tool MUST be defined via `ai.defineTool` with Zod `inputSchema`/`outputSchema`, safe error handling, and explicit timeouts; when used in tool loops, cap iterations with `maxTurns` (js/tool-calling.md).

| Tool ID | Purpose | Input Schema (Zod) | Output Schema (Zod) | Dependencies |
|---|---|---|---|---|
| urlFetch | Fetch and sanitize HTML/JSON from a URL | `{ url: z.string().url() }` | `{ status: z.number(), content: z.string(), contentType: z.string() }` | fetch |
| extractReadable | Extract main content and metadata from HTML | `{ html: z.string() }` | `{ title: z.string().optional(), text: z.string(), meta: z.record(z.string()).optional() }` | cheerio/readability |
| credibilityScore | Heuristic credibility score for a source | `{ domain: z.string(), recencyDays: z.number().optional(), sourceType: z.enum(['web','news','academic']) }` | `{ score: z.number().min(0).max(1), level: z.enum(['low','medium','high']), factors: z.array(z.string()) }` | none |
| timelineExtractor | Build event timeline from multiple snippets | `{ snippets: z.array(z.string()) }` | `{ events: z.array(z.object({ date: z.string(), headline: z.string(), summary: z.string() })) }` | none |
| quoteExtractor | Extract verbatim quotes with attribution | `{ text: z.string() }` | `{ quotes: z.array(z.object({ quote: z.string(), speaker: z.string().optional() })) }` | none |
| entityTagger | Extract entities (people, orgs, places) | `{ text: z.string() }` | `{ entities: z.array(z.object({ type: z.string(), value: z.string() })) }` | none |
| deduplicate | Deduplicate similar items by title/url | `{ items: z.array(z.object({ title: z.string(), url: z.string().url().optional() })) }` | `{ unique: z.array(z.object({ title: z.string(), url: z.string().optional() })) }` | none |
| pdfLoader | Load text from a PDF buffer or URL | `{ url: z.string().url().optional(), dataBase64: z.string().optional() }` | `{ text: z.string(), pages: z.number() }` | pdf-parse |
| youtubeTranscript | Fetch YT transcript | `{ videoUrl: z.string().url() }` | `{ transcript: z.string(), segments: z.array(z.object({ start: z.number(), text: z.string() })) }` | 3rd-party API |
| languageDetect | Detect language | `{ text: z.string() }` | `{ lang: z.string(), confidence: z.number() }` | library |
| translate | Translate text | `{ text: z.string(), targetLang: z.string() }` | `{ translated: z.string(), detectedLang: z.string() }` | provider |
| schemaValidate | Validate JSON against schema | `{ data: z.unknown(), schema: z.any() }` | `{ valid: z.boolean(), errors: z.array(z.string()).optional() }` | ajv |

Initial implementation priority: `urlFetch`, `extractReadable`, `credibilityScore`, `deduplicate`, `pdfLoader`. Others can follow.

## 5. Acceptance Criteria

- AC-001: Given a running agent server, when requesting `/.well-known/agent-card.json`, then a valid AgentCard JSON is returned with required fields and correct skills.
- AC-002: Given an A2A submit with a non-empty text message, when processed, then agent publishes initial Task (submitted), at least one working status-update, and finally completed|failed|canceled.
- AC-003: Given a cancel request for an in-flight task, when processed, then agent publishes a final `canceled` status within 2 seconds and stops processing.
- AC-004: For web/news/academic/data-analysis agents, when the prompt requires JSON, then the agent attempts strict JSON parse; on parse failure, it publishes `failed` with a descriptive error (unless prompt explicitly allows simulated output labeled clearly).
- AC-005: Given missing required env (e.g., `GEMINI_API_KEY`), when starting agent, then it exits with a clear error and non-zero code.
- AC-006: Given external API errors (SerpAPI/NewsAPI/Semantic Scholar), when searches fail, then the agent continues best-effort with partial results if designed (and records errors), else fails with a clear error message; no silent success.
- AC-007: Given the content-editor agent, when provided text input, then final output message contains only the polished content text (no extra framing), consistent with the prompt.
- AC-008: Given Dev UI and flow server, when `webResearchFlow`, `newsResearchFlow`, `academicResearchFlow`, and `dataAnalysisFlow` are exported and registered, then they appear in Dev UI and accept schema-validated inputs, returning schema-conformant outputs or a clear error.
- AC-009: All agent/flow TypeScript builds pass under strict mode with no `any` in core logic.
- AC-010: Given dotprompts in `src/prompts`, when running flows, then `ai.prompt('<id>')` resolves and returns model output; missing prompts cause a clear startup/test failure.
- AC-011: Given the expanded tools, when invoked with invalid inputs, then they fail with safe, descriptive errors; when invoked with valid inputs, they return outputs matching their Zod schemas within configured timeouts.

## 6. Test Automation Strategy

- Test Levels: Unit (parsers, mappers), Integration (agent endpoints + A2A handler), Flow-level sanity (Dev UI), Evaluations (Genkit evaluators/datasets).
- Frameworks: Vitest for unit/integration; Genkit Evaluator for heuristic scoring (e.g., research/data-quality in future).
- Test Data Management: Deterministic datasets (`datasets/editor.json`, `datasets/planner.json`, and add datasets for web/news/academic/data-analysis).
- CI/CD Integration: GitHub Actions to run lint, typecheck, unit tests, and selected evaluations via `genkit eval:flow`.
- Coverage Requirements: Target ≥80% for parsing/mapping modules; ≥60% for server bootstrap.
- Performance Testing: Basic timing checks (<5s) under light dev load.
- Prompt Discovery: Unit test to assert `promptDir` (`./src/prompts`) includes required prompt ids and prompt rendering round-trips for sample inputs.
- Tools: Unit tests for each tool’s happy path and error path; ensure `maxTurns` bounded when used in tool loops (see js/tool-calling.md).

## 7. Rationale & Context

A2A standardizes agent orchestration and lifecycle across heterogeneous agents, enabling the orchestrator to coordinate work and cancellations predictably. Dotprompts keep model behavior declarative and auditable; JSON outputs power downstream automations and evaluators. Strict parsing and explicit failure pathways reduce silent errors and make reliability measurable. Typed interfaces align with TypeScript strict mode for maintainability.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: A2A protocol/SDK — Agent lifecycle, Agent Card, task communication.
- **EXT-002**: Google Genkit — Prompt execution, flows, evaluators, telemetry.

### Third-Party Services

- **SVC-001**: Google AI (Gemini) — prompt execution; requires `GEMINI_API_KEY`.
- **SVC-002**: SerpAPI — web/news/scholar searches; requires `SERPAPI_API_KEY`.
- **SVC-003**: NewsAPI — news search enrichment; requires `NEWSAPI_API_KEY` (optional).
- **SVC-004**: Semantic Scholar — academic search enrichment; optional API key.

### Infrastructure Dependencies

- **INF-001**: Node.js runtime; Express servers for agents.

### Data Dependencies

- **DAT-001**: Datasets for evaluations — JSON inputs per flow.

### Technology Platform Dependencies

- **PLT-001**: Genkit ^1.20.x, TypeScript ^5.9.x, Express ^4.21.x (aligned with repository constraints).
- **PLT-002**: Optional Vertex AI provider toggle via environment flag (documented elsewhere).
- **PLT-003**: `@genkit-ai/express` for `startFlowServer` (js/frameworks/express.md); ensure flows are imported from `src/index.ts`.

### Compliance Dependencies

- **COM-001**: Secret management — API keys via environment variables; no secrets in code.

## 9. Examples & Edge Cases

```code
// Edge 1: No text parts in user message
// Expected: Agent fails with "No input message found to process."

// Edge 2: JSON parse failure from model output
// Expected: Agent publishes failed with descriptive error; no fake success.

// Edge 3: Cancellation during search
// Expected: Agent quickly emits canceled; no further processing.

// Edge 4: Missing optional API key (NewsAPI/Semantic Scholar)
// Expected: Log/store error, continue best-effort with remaining sources; do not crash.

// Edge 5: Dates as string/number (publicationYear)
// Expected: Coerce safely to publicationDate or omit if invalid.

// Edge 6: Empty findings
// Expected: Complete with working updates; omit artifacts or return empty findings explicitly.
```

## 10. Validation Criteria

- Lint/Typecheck: PASS with TypeScript strict; no `any` in core logic.
- A2A Conformance: Agent Card valid; routes mounted; submit/cancel flows behave per AC.
- Prompt Invocation: Messages mapped correctly; roles consistent; model config per repo.
- JSON Contracts: Web/News/Academic/DataAnalysis agents return parseable structures or fail cleanly.
- Env Guards: Startup validation for required keys; helpful error messages.
- Cancellation: `canceled` state published reliably; no stray completions afterward.
- Logging: Key stage logs present; no secret leakage.
- Flows: Research flows exported/registered; Dev UI shows them and input/output schemas validate.

## 11. Related Specifications / Further Reading

- `spec/spec-architecture-multi-agent-coder-orchestrator.md`
- `AGENTS.md`
- `docs/components/*-documentation.md`
- Genkit documentation (flows, evaluators, dotprompts, express integration)
- A2A SDK documentation (Agent Card, task lifecycle, event bus)

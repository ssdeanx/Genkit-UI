---
title: Unified Flow Schemas and Web Scraping Flow
version: 1.0
date_created: 2025-09-27
owner: Genkit-UI Maintainers
---

# Introduction

This specification standardizes structured input/output schemas for all Genkit flows and introduces a new flow for the web scraping tool. It ensures flows use shared Zod schemas under `src/schemas` and that these schemas match the data contracts used by associated A2A agents and Dotprompt definitions.

## 1. Purpose & Scope

- Define a single source of truth for flow input/output schemas in `src/schemas/*`.
- Align the following flows with shared schemas and agent contracts:
  - `webResearchFlow`
  - `newsResearchFlow`
  - `academicResearchFlow`
  - `dataAnalysisFlow`
  - `contentEditorFlow`
  - New: `webScrapingFlow` (wrapping `webScrapingTool`)
- Applies to Genkit runtime (model: Gemini 2.5 Flash) and A2A agent integrations.

## 2. Definitions

- Genkit: Google Genkit JS framework for AI flows/tools.
- A2A: Agent-to-Agent protocol for inter-agent communication.
- Zod: Runtime validation and TypeScript schema library used via Genkit `z`.

## 3. Requirements, Constraints & Guidelines

- REQ-001: All flows MUST import input/output schemas from `src/schemas/*` (no inline schemas).
- REQ-002: Flow schemas MUST match agent contracts and Dotprompt `input.schema`/`output.schema` names.
- REQ-003: Flows MUST validate model outputs using `safeParse` and throw `UserFacingError` on failure.
- REQ-004: Web scraping capabilities MUST be exposed via a Genkit flow `webScrapingFlow` wrapping `webScrapingTool`.
- REQ-005: Schema files MUST only expose named exports with clear type aliases.
- CON-001: Maintain ESM (NodeNext) import style using `.js` specifiers in source.
- GUD-001: Prefer `z` from `genkit` to mirror project patterns.
- PAT-001: Keep flow definitions minimal, offloading logic to prompts/tools.

## 4. Interfaces & Data Contracts

- INT-001: Flow APIs
  - `webResearchFlow(input: WebResearchInput) => WebResearchOutput`
  - `newsResearchFlow(input: NewsResearchInput) => NewsResearchOutput`
  - `academicResearchFlow(input: AcademicResearchInput) => AcademicResearchOutput`
  - `dataAnalysisFlow(input: DataAnalysisInput) => DataAnalysisOutput`
  - `contentEditorFlow(input: ContentEditorInput) => ContentEditorOutput`
  - `webScrapingFlow(input: WebScrapingInput) => WebScrapingOutput`

- DAT-001: Web Research Schemas (`src/schemas/webResearchSchema.ts`)
  - Input: `{ query, researchScope?, credibilityThreshold?, now? }`
  - Output: `{ topic, findings[], sources[], methodology, confidence, generatedAt, processingTime }`

- DAT-002: News Research Schemas (`src/schemas/newsResearchSchema.ts`)
  - Input: `{ query, newsScope?, urgencyLevel?, now? }`
  - Output: `{ newsFindings[], mediaAnalysis, contextAndAnalysis, metadata }`

- DAT-003: Academic Research Schemas (`src/schemas/academicResearchSchema.ts`)
  - Input: `{ query, researchDomain?, methodologicalFocus?, now? }`
  - Output: `{ topic, findings[], sources[], methodology, confidence, generatedAt, processingTime }`

- DAT-004: Data Analysis Schemas (`src/schemas/dataAnalysisSchema.ts`)
  - Input: `{ analysisType?, dataCharacteristics?, now? }`
  - Output: `{ dataAssessment, statisticalAnalysis, dataVisualization?, quantitativeInsights, methodologicalNotes?, metadata }`

- DAT-005: Content Editor Schemas (`src/schemas/contentEditorSchema.ts`)
  - Input: `{ content, tone? }`
  - Output: `{ edited }`

- DAT-006: Web Scraping Schemas (Flow-local mirror in `src/flows/webScrapingFlow.ts`)
  - Input: `{ operation, url?, urls?, options?, data?, flowId? }`
  - Output: `{ success, operation, result?, error?, metadata }`

## 5. Acceptance Criteria

- AC-001: Given any flow call, when the model returns output, then the flow MUST validate against the corresponding schema and throw `UserFacingError` on failure.
- AC-002: Given `webScrapingFlow` input for `scrapeUrl`, when executed, then the returned `result` MUST conform to the `ScrapedPage` schema.
- AC-003: Given `webResearchFlow` a valid `query`, when executed, then the returned object MUST include `findings[]` and `sources[]` arrays.

## 6. Test Automation Strategy

- Test Levels: Unit (schemas), Integration (flows calling prompts/tools).
- Frameworks: Vitest.
- Test Data: Mock Genkit prompt outputs and tool responses to satisfy schemas.
- CI: Execute `npm test` and `npm run typecheck` on PR.
- Coverage: Target ≥ 70% for changed flow files.

## 7. Rationale & Context

Centralized schemas reduce drift between agents, prompts, and flows, improving reliability and debugging. The web scraping flow exposes a high-value tool through consistent flow mechanics.

## 8. Dependencies & External Integrations

- External Systems
  - EXT-001: Google AI (Gemini) for model prompting.
- Third-Party Services
  - SVC-001: SerpAPI, NewsAPI (used by agents/tools).
- Infrastructure
  - INF-001: Dev-local vectorstore for embeddings.
- Technology Platform
  - PLT-001: TypeScript 5.9, Genkit ^1.20.0, ESM (NodeNext).

## 9. Examples & Edge Cases

```ts
// Example: contentEditorFlow happy path
await contentEditorFlow({ content: 'teh txt', tone: 'formal' });

// Edge case: Missing output
// Expect UserFacingError when model fails to return structured output.
```

## 10. User Stories & Use Cases

- USR-001: As a developer, I want flow schemas centralized so that changes are consistent across agents and prompts.
- USE-001: Use `webScrapingFlow` to crawl a site, then embed results in local vectorstore with a single API.

## 11. Compliance Criteria

- CPL-001: All flows import schemas from `src/schemas` (except webScrapingFlow which mirrors tool schemas locally).
- CPL-002: Type checking passes with NodeNext ESM configuration.

## 12. Related Specifications / Further Reading

- `src/prompts/*.prompt`
- `src/agents/*/index.ts`
- `src/tools/webScrapingTool.ts`

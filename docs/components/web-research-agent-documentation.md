---
title: Web Research Agent - Technical Documentation
component_path: src/agents/web-research-agent
version: 1.0
date_created: 2025-09-26
last_updated: 2025-09-26
owner: engineering
tags:
  - component
  - agent
  - web
  - research
  - documentation
  - architecture
  - synthesis
---
## Web Research Agent Documentation

The Web Research Agent performs broad web searches, news searches and scholar lookups. It aggregates results, computes credibility, and synthesizes structured ResearchResult artifacts for orchestrator consumption.

## 1. Component Overview

### Purpose/Responsibility

- Aggregate and synthesize web, news and scholar search results for a query.
- Produce ResearchResult artifacts and publish Task/TaskStatusUpdate events to the A2A ExecutionEventBus.

### Scope
The Web Research Agent performs broad web searches, news searches and scholar lookups. It aggregates results, computes credibility, and synthesizes structured ResearchResult artifacts for orchestrator consumption.

- Included: general web search, news search, scholar search (via `WebSearchUtils`), result normalization, artifact publishing.
- Excluded: own storage, downstream orchestration logic (handled by orchestrator).

### System context and relationships

- Collaborators: `WebSearchUtils` (search provider aggregator), Genkit prompt `web_research` (synthesis), A2A ExecutionEventBus.
- Consumers: Orchestrator and other agents requesting web research.

## 2. Architecture Section

### Design patterns and dependencies

- Patterns: Executor pipeline, defensive parsing, small utility helper for search providers.
- Internal dependencies: `web-search.ts` utilities.
- External dependencies: `genkit` (Gemini model), `@a2a-js/sdk`, `uuid`.

### Component structure (mermaid)

```mermaid
graph TD
  A[WebResearchAgentExecutor] --> B[WebSearchUtils]
  A --> C[Genkit Prompt: web_research]
  A --> D[A2A ExecutionEventBus]
  B --> External[Search Providers (Google, Bing, NewsAPI, Scholar)]
```

## 3. Interface Documentation

| Method/Property | Purpose | Parameters | Return Type | Usage Notes |
|---|---|---|---|---|
| WebResearchAgentExecutor.execute | Main entrypoint for A2A calls | requestContext, eventBus | Promise<void> | Publishes submitted/working/completed/failed statuses |
| WebResearchAgentExecutor.cancelTask | Cancel a running task and emit canceled status | taskId, eventBus | Promise<void> | Adds to cancelledTasks set and publishes canceled status |
| WebSearchUtils.search | Perform general web search | query, options | Promise<SearchResult> | Aggregates search results and computes credibility |

## 4. Implementation Details

### Key behaviors

- Parses message history to produce Genkit prompt messages and user query.
- Uses `WebSearchUtils` to run three searches (web, news, scholar), then synthesizes findings into ResearchResult.
- Expects the Genkit prompt `web_research` to return JSON (throws on parse errors).

### Error handling

- If Genkit returns unparsable JSON the agent throws a descriptive error and publishes a `failed` status update.

## 5. Usage Examples

```ts
const executor = new WebResearchAgentExecutor();
await executor.execute(requestContext, eventBus);
```

## 6. Quality Attributes

- Security: Relies on environment-provided `GEMINI_API_KEY` and other API keys.
- Performance: Network-bound; uses async calls to providers; synthesizing and parsing may be CPU-light but can block when large responses returned.
- Reliability: Strong error paths – publishes `failed` status when parsing fails; supports cancellation.

## 7. References

- Key files:
  - [index.ts](../../src/agents/web-research-agent/index.ts) — main executor
  - [web-search.ts](../../src/agents/web-research-agent/web-search.ts) — WebSearchUtils helper
  - [genkit.ts](../../src/agents/web-research-agent/genkit.ts) — Genkit config

## Next steps

- Add unit tests for parseResearchFindings fallback behavior and end-to-end mocked search+genkit synthesis.

---
Generated from source files in `src/agents/web-research-agent/`.

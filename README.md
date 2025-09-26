# Genkit Multi-Agent System

<!-- Primary tech -->
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue?logo=typescript)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-brightgreen?logo=node.js)](https://nodejs.org)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-API-blue?logo=google)](https://developers.generativeai.google)
[![A2A](https://img.shields.io/badge/A2A-^0.3.4-yellowgreen?logo=npm)](https://www.npmjs.com/package/@a2a-js/sdk)
[![Express](https://img.shields.io/badge/Express-^4.21.2-lightgrey?logo=express)](https://expressjs.com)
[![Genkit](https://img.shields.io/badge/Genkit-^1.19.3-orange)](https://github.com/genkit-ai)
<!-- Genkit ecosystem packages -->
[![@genkit-ai/core](https://img.shields.io/npm/v/@genkit-ai%2Fcore?label=@genkit-ai%2Fcore&logo=npm)](https://www.npmjs.com/package/@genkit-ai/core)
[![@genkit-ai/google-genai](https://img.shields.io/npm/v/@genkit-ai%2Fgoogle-genai?label=@genkit-ai%2Fgoogle-genai&logo=npm)](https://www.npmjs.com/package/@genkit-ai/google-genai)
[![@genkit-ai/express](https://img.shields.io/npm/v/@genkit-ai%2Fexpress?label=@genkit-ai%2Fexpress&logo=npm)](https://www.npmjs.com/package/@genkit-ai/express)
[![@genkit-ai/mcp](https://img.shields.io/npm/v/@genkit-ai%2Fmcp?label=@genkit-ai%2Fmcp&logo=npm)](https://www.npmjs.com/package/@genkit-ai/mcp)
<!-- Runtime & integrations -->
[![prisma](https://img.shields.io/npm/v/prisma?label=prisma&logo=npm)](https://www.npmjs.com/package/prisma)
[![firebase](https://img.shields.io/npm/v/firebase?label=firebase&logo=npm)](https://www.npmjs.com/package/firebase)
[![serpapi](https://img.shields.io/npm/v/serpapi?label=serpapi&logo=npm)](https://www.npmjs.com/package/serpapi)
[![wikipedia](https://img.shields.io/npm/v/wikipedia?label=wikipedia&logo=npm)](https://www.npmjs.com/package/wikipedia)
<!-- Dev tooling -->
[![zod](https://img.shields.io/npm/v/zod?label=zod&logo=npm)](https://www.npmjs.com/package/zod)
[![tsx](https://img.shields.io/npm/v/tsx?label=tsx&logo=npm)](https://www.npmjs.com/package/tsx)
[![vitest](https://img.shields.io/npm/v/vitest?label=vitest&logo=npm)](https://www.npmjs.com/package/vitest)
[![prettier](https://img.shields.io/npm/v/prettier?label=prettier&logo=npm)](https://www.npmjs.com/package/prettier)
[![pino-pretty](https://img.shields.io/npm/v/pino-pretty?label=pino-pretty&logo=npm)](https://www.npmjs.com/package/pino-pretty)

A production-oriented, TypeScript multi-agent AI platform built on Google Genkit. The system composes Genkit flows, reusable tools, and independent A2A agents to support complex tasks such as research orchestration, code generation, and content editing.

---

## Quick overview

- Core: Genkit flows and tools (Zod-validated inputs/outputs).
- Agents: Independent Express servers exposing A2A endpoints and an AgentCard for discovery.
- Communication: Agent-to-Agent (A2A) streaming for task delegation and progress updates.
- Runtime: Node.js (ESM) using `tsx` for direct TypeScript execution.

## Architecture (Mermaid)

```mermaid
flowchart LR
  subgraph User
    U[User / CLI / UI]
  end

  subgraph DevOps[Developer Tools]
    UI[Genkit UI]
    CLI[A2A CLI]
  end

  subgraph Flows[Genkit Flows]
    OF[Orchestrator Flow]
    RF[Recipe Generator Flow]
    WF[Weather Flow]
  end

  subgraph Agents[Agents (Express + A2A)]
    O[Orchestrator Agent]
    P[Planning Agent]
    C[Coder Agent]
    E[Content Editor]
  end

  subgraph Tools[Stateless Tools]
    Wiki[Wikipedia Tool]
    Calc[Calculator Tool]
    Weather[Weather Tool]
  end

  subgraph Cloud[External]
    Gemini[Gemini API]
  end

  U -->|interact| UI
  U -->|interact| CLI
  UI --> OF
  OF --> O
  O -->|delegate (A2A)| P
  O -->|delegate (A2A)| C
  O -->|delegate (A2A)| E
  OF --> Tools
  RF --> Wiki
  WF --> Weather
  Tools -->|call| Gemini
  O -->|aggregate| OF
  CLI --> O
```

> Note: The diagram shows high-level components. See `.github/architecture.md` for a detailed blueprint.

---

## Getting started (quick)

Prerequisites: Node.js 18+, a valid Google Gemini API key (set `GEMINI_API_KEY`).

Install dependencies:

```bash
npm install
```

Start the Genkit developer UI (hot-reloads flows):

```bash
npm run genkit:ui
```

Run the CLI to talk to a running agent (default agent base URL shown as example):

```bash
npm run a2a:cli http://localhost:41243
# Use /new to reset session, /exit to quit
```

Run a single agent (examples):

```bash
npm run agents:orchestrator-agent   # starts orchestrator on port 41243
npm run agents:planning             # starts planning agent on port 41245
npm run agents:coder                # starts coder agent on port 41241
npm run agents:content-editor       # starts content editor agent (default port 10003)
```

---

## Local Pinecone Setup

To run the local Pinecone instance, ensure you have Docker installed and run:

```bash
docker compose up -d
```

This will start two Pinecone instances: `dense-index` on port `5081` and `sparse-index` on port `5082`.

---

## How to use flows programmatically

Example: run the recipe generator flow from code (observed pattern in `src/flows/recipeGeneratorFlow.ts`):

```typescript
import { ai } from './config.js';
import { recipeGeneratorFlow } from './index.js';

const recipe = await ai.runFlow(recipeGeneratorFlow, {
  ingredient: 'chicken',
  dietaryRestrictions: 'none'
});
console.log(recipe.title);
```

The flows use Zod schemas for input/output validation—follow the existing patterns in `src/schemas` when adding new flows.

---

## Development workflow & conventions

- Coding style: TypeScript (ESM), keep functions small and single-responsibility.
- Genkit patterns: Use `ai.defineFlow` / `ai.defineTool` with `inputSchema` / `outputSchema` (Zod).
- Agents: Use Express with A2A endpoints and export a `.well-known/agent-card.json` for discovery.
- Logging: lightweight `console.log` is used across tools/agents for traceability.
- Testing: Vitest used for unit tests and mocking (`vi.mock`). See `src/agents/orchestrator-agent/__tests__` for examples.

Scripts (from package.json):

- `npm run genkit:ui` — start developer UI
- `npm run a2a:cli` — interactive A2A CLI
- `npm run agents:*` — start specific agents (see `package.json` scripts)
- `npm test` — run unit tests (Vitest)

Add new tools in `src/tools/` and flows in `src/flows/`; export new flows from `src/index.ts` so the UI can pick them up automatically.

---

## Examples & patterns to follow

- Tool example: `src/tools/wikipediaTool.ts` — shows try/catch with fallback and Zod input schema.
- Flow example: `src/flows/recipeGeneratorFlow.ts` — shows prompt templating and `ai.generate({ output: { schema } })`.
- Agent example: `src/agents/orchestrator-agent/index.ts` — Express + A2A streaming handlers.

Refer to `.github/exemplars.md` for additional high-quality code examples.

---

## Agent details

| Agent | Purpose | Default port (env var) | Start command | Key files |
|---|---|---:|---|---|
| Orchestrator | Central coordinator — delegates tasks, aggregates results, validates quality | 41243 (`ORCHESTRATOR_AGENT_PORT`) | `dotenvx run -- npx tsx src/agents/orchestrator-agent/index.ts` | [`src/agents/orchestrator-agent/index.ts`](src/agents/orchestrator-agent/index.ts), [`src/agents/orchestrator-agent/genkit.ts`](src/agents/orchestrator-agent/genkit.ts), [`src/agents/orchestrator-agent/task-delegator.ts`](src/agents/orchestrator-agent/task-delegator.ts), [`src/agents/orchestrator-agent/README.md`](src/agents/orchestrator-agent/README.md) |
| Planning | Builds research plans, decomposes steps, assesses risk & contingencies | 41245 (`PLANNING_AGENT_PORT`) | `dotenvx run -- npx tsx src/agents/planning-agent/index.ts` | [`src/agents/planning-agent/index.ts`](src/agents/planning-agent/index.ts), [`src/agents/planning-agent/genkit.ts`](src/agents/planning-agent/genkit.ts), [`src/agents/planning-agent/planning_agent.prompt`](src/agents/planning-agent/planning_agent.prompt), [`src/agents/planning-agent/README.md`](src/agents/planning-agent/README.md) |
| Coder | Produces code artifacts and formatted outputs | 41242 (`CODER_AGENT_PORT`) | `npm run agents:coder` or `dotenvx run -- npx tsx src/agents/coder/index.ts` | [`src/agents/coder/index.ts`](src/agents/coder/index.ts), [`src/agents/coder/genkit.ts`](src/agents/coder/genkit.ts), [`src/agents/coder/code-format.ts`](src/agents/coder/code-format.ts), [`src/agents/coder/README.md`](src/agents/coder/README.md) |
| Content Editor | Proofreads and polishes content | 10003 (`CONTENT_EDITOR_AGENT_PORT`) | `npm run agents:content-editor` or `dotenvx run -- npx tsx src/agents/content-editor/index.ts` | [`src/agents/content-editor/index.ts`](src/agents/content-editor/index.ts), [`src/agents/content-editor/genkit.ts`](src/agents/content-editor/genkit.ts), [`src/agents/content-editor/content_editor.prompt`](src/agents/content-editor/content_editor.prompt), [`src/agents/content-editor/README.md`](src/agents/content-editor/README.md) |
| Web Research | General web searches and scraping for evidence | 41243 (`WEB_RESEARCH_AGENT_PORT`) | `dotenvx run -- npx tsx src/agents/web-research-agent/index.ts` | [`src/agents/web-research-agent/index.ts`](src/agents/web-research-agent/index.ts), [`src/agents/web-research-agent/web_research.prompt`](src/agents/web-research-agent/web_research.prompt), [`src/agents/web-research-agent/web-search.ts`](src/agents/web-research-agent/web-search.ts) |
| News Research | Current events and news synthesis | 41246 (`NEWS_RESEARCH_AGENT_PORT`) | `dotenvx run -- npx tsx src/agents/news-research-agent/index.ts` | [`src/agents/news-research-agent/index.ts`](src/agents/news-research-agent/index.ts), [`src/agents/news-research-agent/news_research.prompt`](src/agents/news-research-agent/news_research.prompt), [`src/agents/news-research-agent/news-search.ts`](src/agents/news-research-agent/news-search.ts) |
| Academic Research | Scholarly literature search and summarization | 41245 (`ACADEMIC_RESEARCH_AGENT_PORT`) | `dotenvx run -- npx tsx src/agents/academic-research-agent/index.ts` | [`src/agents/academic-research-agent/index.ts`](src/agents/academic-research-agent/index.ts), [`src/agents/academic-research-agent/academic_research.prompt`](src/agents/academic-research-agent/academic_research.prompt), [`src/agents/academic-research-agent/academic-search.ts`](src/agents/academic-research-agent/academic-search.ts) |
| Data Analysis | Statistical analysis, charts, data synthesis | 41247 (`DATA_ANALYSIS_AGENT_PORT`) | `dotenvx run -- npx tsx src/agents/data-analysis-agent/index.ts` | [`src/agents/data-analysis-agent/index.ts`](src/agents/data-analysis-agent/index.ts), [`src/agents/data-analysis-agent/genkit.ts`](src/agents/data-analysis-agent/genkit.ts), [`src/agents/data-analysis-agent/data_analysis.prompt`](src/agents/data-analysis-agent/data_analysis.prompt) |

---

## Environment variables

List of environment variables commonly used while running agents and flows in this repo:

- `GEMINI_API_KEY` — required for Gemini / Genkit model access
- `ORCHESTRATOR_AGENT_PORT` — optional override for orchestrator agent port (default: 41243)
- `PLANNING_AGENT_PORT` — optional override for planning agent port (default: 41245)
- `CONTENT_EDITOR_AGENT_PORT` — optional for content editor agent (default: 10003)
- Any other API keys used by tools (e.g., `SERPAPI_KEY` for SerpAPI)

This project uses `dotenv` and `dotenvx` patterns in scripts — keep secrets out of version control and use a `.env` file for local development.

---

## Troubleshooting & common issues

- Missing API key (Gemini): Ensure `GEMINI_API_KEY` is set in your environment or `.env` file. Many flows/tools will fail validation without this.
- Schema validation errors (Zod): When adding or invoking flows/tools, Zod validation will throw on mismatched types — check `src/schemas` and `console` output for exact messages.
- Port conflicts: Agents default to fixed ports; if you see `EADDRINUSE` change the port env var (e.g., `ORCHESTRATOR_AGENT_PORT`) before starting.
- Streaming issues in CLI: If streaming responses hang, confirm agent supports streaming in its AgentCard and the `stream: true` setting in `src/config.ts`.

If one of the above doesn't help, run the agent with debugging enabled (set `DEBUG` or use verbose logs via `pino-pretty`) and include logs when opening an issue.

---

## Support

If you find issues or want features, open an issue or discussion in this repository:

- Issues: [GitHub Issues](https://github.com/ssdeanx/Genkit-UI/issues)
- Discussions: [GitHub Discussions](https://github.com/ssdeanx/Genkit-UI/discussions)

For coding conventions and Copilot guidance see: `.github/copilot-instructions.md`.

---

Last updated: September 25, 2025

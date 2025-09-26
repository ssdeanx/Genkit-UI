---
title: AGENTS.md - Multi-Agent Genkit Project
description: Technical instructions for AI coding agents working on this A2A-enabled Genkit multi-agent system.
---

# AGENTS.md

## Project Overview

This is a multi-agent AI system built with Google Genkit and the Agent-to-Agent (A2A) protocol. The core architecture orchestrates specialized agents (orchestrator, planning, research, coder, editor, data analysis) for complex tasks like research, code generation, and content creation. Key components:

- **Agents** ([src/agents/](src/agents/)): A2A-compliant services (Express servers) with Genkit integration for Gemini models. Examples: [orchestrator-agent](src/agents/orchestrator-agent/) coordinates tasks, [planning-agent](src/agents/planning-agent/) decomposes queries, [coder](src/agents/coder/) generates code artifacts.
- **Flows** ([src/flows/](src/flows/)): Genkit flows like [recipeGeneratorFlow](src/flows/recipeGeneratorFlow.ts) (Zod-validated recipe generation) and [weatherFlow](src/flows/weatherFlow.ts) (tool-integrated queries).
- **Tools** ([src/tools/](src/tools/)): Reusable Genkit tools (calculator, weather, Wikipedia) callable by agents/flows.
- **Shared** ([src/agents/shared/](src/agents/shared/)): Cross-agent types/interfaces.
- **Config** ([src/config.ts](src/config.ts)): Central Genkit ai instance with Gemini 2.5 Flash (temperature 0.8, tool calling AUTO).
- **MCP** ([src/mcp/](src/mcp/)): Model Context Protocol for tool/registry management.

Data flow: User queries → Orchestrator flow → Delegate via A2A to specialized agents → Tools/APIs → Aggregate results. Technologies: TypeScript ^5.9.2, Genkit ^1.19.3, @a2a-js/sdk ^0.3.4, Zod ^4.1.11, Express ^4.21.2. Environment: GEMINI_API_KEY required; others like SERPAPI_API_KEY for tools.

The original [recipeGeneratorFlow](src/index.ts) in [src/index.ts](src/index.ts) serves as a simple entrypoint; focus expansions on agents/A2A for multi-agent capabilities.

## Setup Commands

- Install dependencies: `npm install`
- Set environment variables: Copy [.env.example](.env.example) to .env and fill GEMINI_API_KEY (required for all agents). Add SERPAPI_API_KEY (web tools), NEWSAPI_API_KEY (news agent).
- For individual agents: No additional setup; env vars shared.
- Verify setup: `npm run genkit:ui` (starts dev UI for flows/tools).

## Development Workflow

- Start Genkit UI (flows/tools testing): `npm run genkit:ui` – watches [src/index.ts](src/index.ts), serves at localhost:3000.
- Run individual agents (A2A servers):
  - Orchestrator: `npm run agents:orchestrator-agent` (port 41243)
  - Planning: `npm run agents:planning-agent` (port 41244)
  - Academic Research: `npm run agents:academic-research-agent` (port 41245)
  - News Research: `npm run agents:news-research-agent` (port 41246)
  - Data Analysis: `npm run agents:data-analysis-agent` (port 41247)
  - Coder: `npm run agents:coder` (port 41242)
  - Content Editor: `npm run agents:content-editor` (port 10003)
  - Web Research: `npm run agents:web-research-agent` (port 41248)
- Interact with agents: `npm run a2a:cli [agent-url]` (e.g., `npm run a2a:cli http://localhost:41243` for orchestrator) – streams messages, handles tasks/sessions.
- Hot reload: tsx watches TS files; restart agents for prompt/config changes.
- Debug: Set thinkingConfig.showThoughts: true in [config.ts](src/config.ts) for Gemini traces; use Genkit UI for flow visualization.

For monorepo-like structure (agents as sub-servers): Run multiple terminals for concurrent agents; use A2A gateway for coordination.

## Testing Instructions

- Run all tests: `npm test` (Vitest; covers units in __tests__/, e.g., [orchestrator.spec.ts](src/agents/orchestrator-agent/__tests__/orchestrator.spec.ts)).
- Run specific agent tests: `npm test -- --testPathPattern=orchestrator` (e.g., for [orchestrator-agent/__tests__](src/agents/orchestrator-agent/__tests__/)).
- Run flow tests: `npm test -- --testPathPattern=flows` (e.g., [weatherFlow.test.ts](src/flows/weatherFlow.test.ts) mocks tools).
- Coverage: `npm test -- --coverage` – aims for 80%+; focus on executor logic, prompt parsing.
- Mock patterns: Use vi.mock for Genkit ai, A2A eventBus, external APIs (wiki, weather). Test event publishing, error paths, cancellation.
- Add tests: For new code, add to __tests__/ with describe/it/expect; mock dependencies to isolate units.

Fix lint/test errors before commits; run `npm run lint` for ESLint/Prettier.

## Code Style Guidelines

- TypeScript: Strict mode ([tsconfig.json](tsconfig.json)); use interfaces for A2A types ([shared/interfaces.ts](src/agents/shared/interfaces.ts)). Async/await over promises; type all functions.
- Genkit patterns: ai.defineFlow/Tool with Zod schemas (inputSchema/outputSchema); import ai from '../config.js'.
- A2A agents: [index.ts](src/agents/*/index.ts) sets up Express + A2AExpressApp; implement AgentExecutor with execute(requestContext, eventBus); publish Task/Status events.
- Naming: camelCase for vars/functions, PascalCase for classes/interfaces. Prompts in .prompt files next to agents.
- Imports: Relative for local (../config), absolute for node_modules. No unused imports (ESLint).
- Error handling: Try-catch in executors; throw descriptive errors in tools; publish failed status.
- Linting/Formatting: ESLint ([eslint.config.js](eslint.config.js)) for TS rules; Prettier ([prettier.config.js](prettier.config.js)) for formatting. Run `npm run lint -- --fix` before commit.

Follow patterns in existing agents (e.g., [orchestrator-agent/task-delegator.ts](src/agents/orchestrator-agent/task-delegator.ts) for delegation).

## Build and Deployment

- No build step: Direct TS execution via tsx (npm scripts use tsx src/...).
- Production: Set NODE_ENV=production; use PM2/forever for agent servers. Docker: Use [docker-compose.yaml](docker-compose.yaml) for multi-agent stack (env vars injected).
- Deployment: Deploy agents as separate services (e.g., Vercel/Netlify for flows, Heroku for agents); use A2A gateway for discovery.
- CI/CD: GitHub Actions ([.github/workflows/](.github/workflows/)); run tests/lint on PRs. For agents, test A2A endpoints with mocks.

## Security Considerations

- API Keys: Never commit keys; use .env (gitignore'd). Agents check GEMINI_API_KEY at startup.
- A2A: Localhost by default; add auth (securitySchemes in AgentCard) for production. Validate inputs to prevent injection in prompts/tools.
- Tools: Wikipedia public but rate-limit; weather mock—use secure API in prod. No user data persistence.

## Pull Request Guidelines

- Title: [agent/flow/tool] Brief description (e.g., [[orchestrator-agent](src/agents/orchestrator-agent/)] Add task delegation).
- Body: Describe changes, why, testing done. Link issues.
- Required checks: `npm test`, `npm run lint`, manual A2A cli test for agents.
- Review: Self-review for style; tag @reviewer for complex changes. Merge via squash/rebase.

## Debugging and Troubleshooting

- Agent not starting: Check GEMINI_API_KEY; port conflicts (use npm run agents:...:PORT=XXXX).
- A2A errors: Verify AgentCard at /.well-known/agent-card.json; use a2a:cli for message testing.
- Genkit issues: Enable thinkingConfig.showThoughts in [config.ts](src/config.ts); check console for prompt errors.
- Tests failing: Run with --ui for Vitest UI; mock external deps.
- Common: Import paths (use ../config.js); Zod schema mismatches—validate inputs.

For agent-specific: See [docs/components/*-documentation.md](docs/components/). Update this file as codebase evolves.

## Codebase Structure

This section provides a detailed index of the key files and directories in the codebase, organized by component. Use this for navigation when making changes.

### Agents (`src/agents/`)

| File/Folder | Type | Description |
|-------------|------|-------------|
| [academic-research-agent/](src/agents/academic-research-agent/) | Directory | Academic research agent with search utilities and Genkit integration. |
| [coder/](src/agents/coder/) | Directory | Code generation agent with artifact streaming and format parsing. |
| [content-editor/](src/agents/content-editor/) | Directory | Content editing agent for proofreading and polishing text. |
| [data-analysis-agent/](src/agents/data-analysis-agent/) | Directory | Statistical analysis agent with JSON-structured outputs and fallback simulation. |
| [news-research-agent/](src/agents/news-research-agent/) | Directory | News research agent with search tools and prompt-based analysis. |
| [orchestrator-agent/](src/agents/orchestrator-agent/) | Directory | Central orchestrator for task delegation, synthesis, and quality validation. |
| [planning-agent/](src/agents/planning-agent/) | Directory | Planning agent for query decomposition, risk assessment, and methodology selection. |
| [shared/](src/agents/shared/) | Directory | Cross-agent types, interfaces, and shared utilities. |
| [web-research-agent/](src/agents/web-research-agent/) | Directory | Web research agent with search capabilities and result aggregation. |
| [README.md](src/agents/README.md) | Markdown | Overview of agents directory and development notes. |

### Core (`src/`)

| File/Folder | Type | Description |
|-------------|------|-------------|
| [cli.ts](src/cli.ts) | TypeScript | CLI for interacting with A2A agents and flows. |
| [config.ts](src/config.ts) | TypeScript | Central Genkit ai instance configuration with Gemini model and plugins. |
| [index.ts](src/index.ts) | TypeScript | Entry point for Genkit flows (e.g., recipeGeneratorFlow). |
| [flows/](src/flows/) | Directory | Genkit flows for structured workflows (recipe generation, weather queries). |
| [mcp/](src/mcp/) | Directory | Model Context Protocol implementation for tool management. |
| [schemas/](src/schemas/) | Directory | Zod schemas for inputs/outputs (e.g., recipeSchema.ts). |
| [tools/](src/tools/) | Directory | Reusable Genkit tools (calculator, weather, Wikipedia). |

### Flows (`src/flows/`)

| File | Type | Description |
|------|------|-------------|
| [recipeGeneratorFlow.ts](src/flows/recipeGeneratorFlow.ts) | TypeScript | Flow for generating recipes with Zod schema validation. |
| [weatherFlow.ts](src/flows/weatherFlow.ts) | TypeScript | Flow for weather reports integrating weatherTool. |
| [weatherFlow.test.ts](src/flows/weatherFlow.test.ts) | TypeScript | Vitest tests for weatherFlow with tool mocking. |

### Tools (`src/tools/`)

| File | Type | Description |
|------|------|-------------|
| [calculatorTool.ts](src/tools/calculatorTool.ts) | TypeScript | Basic arithmetic tool with Zod input and error handling. |
| [weatherTool.ts](src/tools/weatherTool.ts) | TypeScript | Mock weather lookup tool for location queries. |
| [wikipediaTool.ts](src/tools/wikipediaTool.ts) | TypeScript | Wikipedia search tool using wikipedia library with fallback. |

For full file contents, use read_file tool on specific paths. Update this index as the codebase evolves.
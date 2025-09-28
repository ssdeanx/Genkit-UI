# Design — Genkit-UI

Architecture

- Flows: `ai.defineFlow` with Zod schemas for I/O; exported via `src/index.ts` for Genkit UI
- Agents: Express servers with A2A protocol and AgentExecutor; prompts alongside code
- Tools: `ai.defineTool` wrappers around external APIs (wiki, weather, calculator)
- Config: Central `ai` (`src/config.ts`) selecting Gemini 2.5 Flash, tool‑calling AUTO

Data Flow

1. User → Orchestrator Flow
2. Orchestrator → A2A agents (planning/coder/content/research) → Tools/APIs
3. Aggregate → Respond via flow (optionally streaming)

Interfaces

- A2A Tasks: typed via `src/agents/shared/interfaces.ts`
- Tools: Zod input/output schemas, descriptive errors

Error handling

- Use `UserFacingError` for expected failures
- Validate inputs with Zod in flows/tools; try/catch external calls

Testing strategy

- Unit tests around flows/tools with mocks (Vitest)
- Add integration tests for A2A message flows as agents stabilize

# System Patterns — Genkit-UI

Architecture

- Genkit flows (`src/flows`) using `ai.defineFlow` with Zod schemas
- A2A agents (`src/agents/*`) using Express servers + AgentExecutor
- Tools (`src/tools`) as `ai.defineTool` with resilient error handling
- Shared types in `src/agents/shared/`
- Prompts colocated in `src/prompts`
- Central `ai` config in `src/config.ts` (Gemini 2.5 Flash)

Design patterns

- Strong typing with Zod at flow/tool boundaries
- Streaming responses where applicable
- Clear error classes (`src/errors/UserFacingError.ts`)
- Test-first for public behavior (Vitest)

Naming & organization

- camelCase for functions/vars, PascalCase for types
- Keep agents self-contained; expose `/.well-known/agent-card.json`
- Use `@a2a-js/sdk` for A2A interaction; avoid ad‑hoc HTTP

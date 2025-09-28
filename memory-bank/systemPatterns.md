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

A2A protocol alignment (v0.3.x)

- AgentCard.protocolVersion set to `0.3.0`; capabilities.streaming true
- Prefer `A2AClient.sendMessage`/`sendMessageStream` over custom HTTP
- Task lifecycle: submitted → working → input-required | completed | canceled | failed | rejected | auth-required → final
- Map errors using `A2AError` codes (JSON-RPC -32601, -32602, -32603; A2A -32001…-32007)
- Optional push notifications supported via `pushNotificationConfig`

Event streaming and result handling

- A2AExpressApp uses a single POST route; returns SSE when handler yields an AsyncGenerator of JSON-RPC success responses
- ExecutionEventBus emits events: Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent; ExecutionEventQueue stops on final=true status or message
- ResultManager persists Task state on each event, ensures latest user message in history, merges artifacts (append aware)
- Client utilities:
  - `sendMessage` returns a non-stream result; `sendMessageStream` yields SSE events
  - `resubscribeTask` reattaches to an active task's stream after disconnect
  - `cancelTask` posts JSON-RPC "tasks/cancel"

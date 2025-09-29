# Tech Context — Genkit-UI

Versions (from `package.json` and `.nvmrc`)

- Node.js: 22.20.0
- TypeScript: ^5.9.2
- Genkit core: ^1.20.0 (plus plugins: google-genai/googleai/vertexai, express, dev-local-vectorstore, firebase)
- Express: ^4.21.2
- @a2a-js/sdk: ^0.3.4 (complete A2A protocol implementation)
- @toolbox-sdk/core: For toolbox integration
- Firebase Functions: ^6.4.0, @genkit-ai/firebase: ^1.20.0
- Zod: ^4.1.11
- Vitest: ^3.2.4

## Architecture Components

**Dual Backend Pattern**:

- **Genkit Flows**: HTTP-exposed via [flowServer.ts](../src/flowServer.ts) (port 3400) and Firebase Functions ([functions/](../functions/))
- **A2A Agents**: 8 specialized agents using @a2a-js/sdk for orchestration
- **Toolbox**: Local PostgreSQL-based tools via Docker Compose
- **CLI**: A2A client for agent interaction

**Configuration Files**:

- [src/config.ts](../src/config.ts): Main Genkit setup with Gemini 2.5 Flash, vectorstore, advanced model config
- [functions/src/config.ts](../functions/src/config.ts): Firebase-optimized Genkit with telemetry
- [src/config/toolbox.ts](../src/config/toolbox.ts): Toolbox client integration
- [src/config/tools.yaml](../src/config/tools.yaml): PostgreSQL tool definitions

A2A Protocol Implementation (@a2a-js/sdk ^0.3.4)

- **Core Components**: AgentCard, AgentExecutor, A2AClient, A2AExpressApp, DefaultRequestHandler, InMemoryTaskStore
- **Communication**: JSON-RPC 2.0 over HTTP with Server-Sent Events (SSE) for streaming
- **Task States**: submitted → working → input-required | completed | canceled | failed | rejected | auth-required
- **Methods**: tasks/send, tasks/get, tasks/cancel, tasks/pushNotification/set, tasks/resubscribe, tasks/sendSubscribe
- **Error Codes**: JSON-RPC (-32700 to -32600) and A2A-specific (-32000 to -32007)
- **Security**: API key, OAuth2, JWT, and custom authentication schemes supported
- **Streaming**: Real-time updates via SSE, push notifications for disconnected scenarios

Execution

- TS runs via `tsx`; no build step needed for local dev
- **Flows**: `npm run flow:serve` (port 3400), `npm run genkit:ui`
- **Agents**: `npm run agents:<name>` (ports 41241-41248)
- **Firebase**: `firebase deploy --only functions`, `firebase deploy --only apphosting`
- **Toolbox**: `docker-compose up` (ports 5000, 5432, 6379)

Environment

- Required: `GEMINI_API_KEY`, `GOOGLE_API_KEY` (Firebase)
- Optional: `SERPAPI_API_KEY`, `NEWSAPI_API_KEY`, `VECTORSTORE_INDEX`
- Local .env managed via dotenvx; see `.env.example`

Conventions

- ESM (`type":"module`) and strict TS
- ESLint + Prettier; run `npm run lint` and `npm run typecheck`
- Tests with Vitest; coverage with `npm run coverage`
- A2A agents expose `/.well-known/agent-card.json` endpoint
- Agent cards include capabilities, skills, security schemes, and protocol version
- Flows use Zod schemas for input/output validation
- Agents use flowlogger for structured logging

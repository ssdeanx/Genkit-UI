# System Patterns — Genkit-UI

## Architecture Overview

**Dual Backend Architecture**:

- **Genkit Flows** ([src/flows/](../src/flows/)): HTTP-exposed orchestration via [flowServer.ts](../src/flowServer.ts) and Firebase Functions for direct API calls
- **A2A Agents** ([src/agents/](../src/agents/)): Specialized agents using @a2a-js/sdk for complex multi-agent orchestration
- **Toolbox Integration** ([src/config/toolbox.ts](../src/config/toolbox.ts)): PostgreSQL-based tools running locally via Docker
- **Deployment**: Firebase App Hosting for flows, Functions for serverless execution

**Core Components**:

- [src/config.ts](../src/config.ts): Main Genkit AI instance with Gemini 2.5 Flash and advanced configuration
- [functions/src/config.ts](../functions/src/config.ts): Firebase-optimized Genkit setup with telemetry
- [src/flowServer.ts](../src/flowServer.ts): HTTP server exposing flows on port 3400
- [src/cli.ts](../src/cli.ts): A2A client for agent interaction
- 8 A2A agents with Express servers and AgentCards

Design patterns

- **Flows vs Agents**: Use flows for direct HTTP calls, agents for complex orchestration requiring state and delegation
- Strong typing with Zod at flow/tool boundaries
- Streaming responses where applicable (SSE for A2A, HTTP streaming for flows)
- Clear error classes (`src/errors/UserFacingError.ts`)
- Test-first for public behavior (Vitest)

## A2A Protocol Implementation Patterns (@a2a-js/sdk ^0.3.4)

### Agent Card Configuration

- Required: name, description, url, provider, version
- Capabilities: streaming (true), pushNotifications (false), stateTransitionHistory (true)
- Skills: id, name, description, tags, examples, input/output modes
- Security: schemes (apiKey, oauth2, jwt), security requirements
- Protocol version: "0.3.0"

### Agent Executor Interface

- execute(requestContext, eventBus): Async method handling task execution
- cancelTask(taskId, eventBus): Cancel running tasks
- Task lifecycle management with status updates and artifacts
- Event publishing: Task, TaskStatusUpdateEvent, TaskArtifactUpdateEvent

### Server Setup Pattern

- A2AExpressApp with DefaultRequestHandler
- InMemoryTaskStore or custom TaskStore implementation
- Express middleware integration (CORS, logging, authentication)
- Single POST route handling both JSON and SSE responses

### Client Communication Patterns

- A2AClient for agent interaction
- sendMessage(): Blocking requests with final result
- sendMessageStream(): Real-time SSE streaming
- cancelTask(), resubscribeTask() for task management
- Push notification configuration support

### Task Lifecycle States

- submitted → working → input-required | completed | canceled | failed | rejected | auth-required
- Status updates with messages and timestamps
- Artifact management with append/lastChunk semantics
- History preservation and context tracking

### Error Handling

- JSON-RPC error codes: -32700 (parse), -32600 (invalid request), -32601 (method not found), -32602 (invalid params), -32603 (internal)
- A2A-specific codes: -32000 (task not found), -32001 (not cancelable), -32002 (push not supported)
- A2AError class for structured error responses
- Graceful degradation and user-facing error messages

### Streaming and Real-time Updates

- Server-Sent Events (SSE) for real-time task updates
- ExecutionEventBus for internal event management
- ResultManager for state persistence and artifact merging
- Push notifications for disconnected client scenarios

### Security Implementation

- Multiple auth schemes: API key, OAuth2, JWT
- Security scheme configuration in AgentCard
- Authentication middleware integration
- Secure communication patterns

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

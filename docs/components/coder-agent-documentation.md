---
title: Coder Agent - Technical Documentation
component_path: `src/agents/coder/`
version: 1.0
date_created: 2025-09-26
last_updated: 2025-09-26
owner: AI Agents Team
tags:
  - component
  - agent
  - service
  - code-generation
  - documentation
---
## Coder Agent Documentation

The Coder Agent is an autonomous A2A agent that generates code from natural language instructions. It exposes an A2A-compatible HTTP interface and streams file artifacts as they are produced. The agent uses Genkit with Google Gemini models to produce multi-file code outputs and follows a structured "code" output format defined in `code-format.ts`.

## 1. Component Overview

### Purpose / Responsibility

- Provide high-quality code samples and multi-file code outputs in response to user instructions.
- Stream artifacts (files) and status updates via the A2A ExecutionEventBus so consumers can display partial results during generation.
- Integrate with Genkit for model orchestration and use a custom code output format to parse file boundaries and metadata.

### Scope

- Included: A2A server endpoints, task lifecycle handling (submitted → working → completed/failed/canceled), streaming artifact updates, code-format parsing and generation.
- Excluded: Long-term persistence beyond the in-memory TaskStore, external repository writes, CI/CD integrations.

### System Context

The Coder Agent runs as an Express-based A2A service. It is discoverable via `/.well-known/agent-card.json` and interacts with other agents through the A2A gateway. It depends on `genkit` for model calls and `@a2a-js/sdk` for A2A server primitives.

## 2. Architecture

- Design patterns: Adapter (wraps Genkit stream into A2A artifacts), Strategy (pluggable CodeMessage parsing/formatting), Observer (publishes status/artifact events to ExecutionEventBus).
- Internal dependencies: `genkit` (model orchestration), `code-format.ts` (message parsing), `@a2a-js/sdk` (A2A server, TaskStore, RequestHandler), `express` (HTTP server).
- External dependencies: Google Gemini models via `@genkit-ai/googleai` plugin.
- Component interactions: Incoming A2A requests are handled by `DefaultRequestHandler` which delegates to `CoderAgentExecutor.execute`. The executor calls `ai.generateStream()` to receive chunks, transforms them into `TaskArtifactUpdateEvent` and `TaskStatusUpdateEvent` messages, and publishes them on the provided `ExecutionEventBus`.

### Component Structure and Dependencies (mermaid)

```mermaid
graph TD
  subgraph "Coder Agent"
    Executor[CoderAgentExecutor]
    RequestHandler[DefaultRequestHandler]
    TaskStore[InMemoryTaskStore]
    GenkitAI[Genkit AI (ai)]
    CodeFormat[CodeMessageFormat]
  end

  subgraph "A2A / External"
    Gateway[A2A Gateway]
    OtherAgents[Other Agents]
    Gemini[Google Gemini API]
  end

  Gateway -->|HTTP A2A| RequestHandler
  RequestHandler --> Executor
  Executor --> TaskStore
  Executor --> GenkitAI
  GenkitAI --> Gemini
  Executor --> CodeFormat
  Gateway --> OtherAgents

  classDiagram
    class CoderAgentExecutor {
      - cancelledTasks: Set<string>
      + execute(requestContext, eventBus): Promise<void>
      + cancelTask(taskId, eventBus): Promise<void>
    }
    class CodeMessage {
      + files
      + content
      + preamble
      + filename
      + language
    }

    CoderAgentExecutor --> CodeMessage
    CoderAgentExecutor --> GenkitAI

```

## 3. Interface Documentation

Public interfaces are provided via the A2A endpoints served by `DefaultRequestHandler` and the agent discovery `AgentCard` at `/.well-known/agent-card.json`.

The `CoderAgentExecutor` implements `AgentExecutor` (from `@a2a-js/sdk/server`) and exposes two public methods:

- `execute(requestContext, eventBus): Promise<void>` — Core entrypoint; handles incoming tasks and streams artifact/status events.
- `cancelTask(taskId, eventBus): Promise<void>` — Cancels a running task and emits a final 'canceled' status.

| Method/Property | Purpose | Parameters | Return Type | Usage Notes |
|---|---|---|---|---|
| execute | Handle incoming A2A task/message and stream code artifacts | `requestContext: RequestContext`, `eventBus: ExecutionEventBus` | `Promise<void>` | Core entrypoint; publishes Task/Status/Artifact events to `eventBus`. |
| cancelTask | Cancel a running task and publish cancellation status | `taskId: string`, `eventBus: ExecutionEventBus` | `Promise<void>` | Adds to internal `cancelledTasks` set and emits a final 'canceled' status update. |
| coderAgentCard | Agent discovery card (AgentCard) | n/a | `AgentCard` | Located in `index.ts` and served at `/.well-known/agent-card.json`. |

Events published (via `ExecutionEventBus`):

- Task (kind: `task`) — initial task record when a request is first submitted.
- Status Update (kind: `status-update`) — task state transitions: `submitted`, `working`, `completed`, `failed`, `canceled`.
- Artifact Update (kind: `artifact-update`) — file artifact payloads, includes `artifact.parts` with text content.

## 4. Implementation Details

Main implementation pieces:

- `CoderAgentExecutor` (`src/agents/coder/index.ts`) — orchestrates task lifecycle, consumes Genkit streaming chunks, and publishes A2A events.
- `CodeMessage` & helpers (`src/agents/coder/code-format.ts`) — Zod schema and parser (`extractCode`) to parse code fences and produce structured file objects.
- `genkit` bootstrap (`src/agents/coder/genkit.ts`) — configures Genkit with the GoogleAI plugin and registers the `code` format via `defineCodeFormat`.

Initialization and configuration:

- Server bootstrap lives in `main()` (`index.ts`): constructs `InMemoryTaskStore`, `DefaultRequestHandler`, and an `A2AExpressApp`, then starts an Express server on `CODER_AGENT_PORT` (default `41242`).
- The agent requires `GEMINI_API_KEY`; the process will exit early if the key is not provided.

Key algorithms and behaviors:

- Stream-driven parsing: the executor calls `ai.generateStream()` with a system prompt and the message history; it iterates the stream and uses `CodeMessage` parsing to extract files and incremental content.
- Partial emission logic: the executor maintains `fileContents: Map<string,string>` and `fileOrder: string[]` to buffer contents and emit `artifact-update` events when files are ready or when chunks indicate completion.
- Cancellation: tasks can be cancelled by calling `cancelTask`, which adds the taskId to an internal set and causes the executor to stop processing and emit a 'canceled' status.

Performance considerations:

- Model latency is the primary bottleneck; streaming reduces perceived latency but large outputs still depend on model throughput.
- Using `InMemoryTaskStore` limits scalability — consider a persistent TaskStore (Redis, database) for production to handle larger workloads.

## 5. Usage Examples

Basic A2A usage (conceptual):

```ts
// Pseudocode: send a message via an A2A client
const result = await a2aClient.sendMessage({ agentUrl: 'http://localhost:41242', message: 'Create a TypeScript function to compute fibonacci' });
// Subscribe to task events from the gateway to receive artifact updates as they arrive
```

Cancellation example:

```ts
// Pseudocode: request task cancellation via the A2A gateway
await a2aClient.cancelTask({ agentUrl: 'http://localhost:41242', taskId: 'task-123' });
```

## 6. Quality Attributes

- Security: currently the agent exposes a local HTTP endpoint without auth. For production, add authentication, TLS, and input validation/sandboxing for generated code.
- Performance: streaming reduces wall-clock wait for large outputs. Add rate limiting and worker pools to scale.
- Reliability: executor emits `failed` statuses for exceptions; add retries/backoff and circuit-breaker patterns for Genkit calls.
- Maintainability: parsing logic is encapsulated in `code-format.ts` (add unit tests); Genkit configuration is centralized in `genkit.ts`.
- Extensibility: new output formats can be added by defining additional Genkit formats and parsers.

## 7. References

- Key files:
  - `src/agents/coder/index.ts` — main executor and server bootstrap
  - `src/agents/coder/code-format.ts` — code message schema and parser
  - `src/agents/coder/genkit.ts` — Genkit AI configuration and format registration

- Config and environment:
  - `GEMINI_API_KEY` — required environment variable for Google Gemini access
  - `CODER_AGENT_PORT` — optional port override (default `41242`)

- Testing guidance:
  - Unit test `extractCode()` with multi-file markdown and edge cases (missing filenames, malformed fences).
  - Mock `ai.generateStream()` to assert the executor emits the correct sequence of `artifact-update` and `status-update` events.

- Troubleshooting tips:
  - "No input message found to process." — ensure incoming A2A message has text parts; the executor will publish a `failed` status if there is no input.
  - "GEMINI_API_KEY not set" — set the env var before starting the service; the process exits if missing.

## Change History

- 2025-09-26 — v1.0 — Initial documentation generated from source files in `src/agents/coder/`.

// Pseudocode: request task cancellation via the A2A gateway
await a2aClient.cancelTask({ agentUrl: 'http://localhost:41242', taskId: 'task-123' });
```

## 6. Quality Attributes

- Security: currently the agent exposes a local HTTP endpoint without auth. For production, add authentication, TLS, and input validation/sandboxing for generated code.
- Performance: streaming reduces wall-clock wait for large outputs. Add rate limiting and worker pools to scale.
- Reliability: executor emits `failed` statuses for exceptions; add retries/backoff and circuit-breaker patterns for Genkit calls.
- Maintainability: parsing logic is encapsulated in `code-format.ts` (add unit tests); Genkit configuration is centralized in `genkit.ts`.
- Extensibility: new output formats can be added by defining additional Genkit formats and parsers.

## 7. References

- Key files:
  - `src/agents/coder/index.ts` — main executor and server bootstrap
  - `src/agents/coder/code-format.ts` — code message schema and parser
  - `src/agents/coder/genkit.ts` — Genkit AI configuration and format registration

- Config and environment:
  - `GEMINI_API_KEY` — required environment variable for Google Gemini access
  - `CODER_AGENT_PORT` — optional port override (default `41242`)

- Testing guidance:
  - Unit test `extractCode()` with multi-file markdown and edge cases (missing filenames, malformed fences).
  - Mock `ai.generateStream()` to assert the executor emits the correct sequence of `artifact-update` and `status-update` events.

- Troubleshooting tips:
  - "No input message found to process." — ensure incoming A2A message has text parts; the executor will publish a `failed` status if there is no input.
  - "GEMINI_API_KEY not set" — set the env var before starting the service; the process exits if missing.

## Change History

- 2025-09-26 — v1.0 — Initial documentation generated from source files in `src/agents/coder/`.

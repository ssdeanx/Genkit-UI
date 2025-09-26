---
title: "Orchestrator Agent - Technical Documentation"
component_path: "./src/agents/orchestrator-agent"
version: "1.0"
date_created: 2025-09-26
last_updated: 2025-09-26
owner: "team"
tags:
  - "agent"
  - "orchestrator"
  - "a2a"
  - "documentation"
  - "architecture"
---
## Orchestrator Agent Documentation

This document describes the Orchestrator Agent component located at `src/agents/orchestrator-agent`. The orchestrator coordinates research tasks across specialized agents (web, academic, news, data-analysis) using the A2A protocol and Genkit flows.

## 1. Component Overview

### Purpose/Responsibility

- Primary responsibility: coordinate multi-agent research tasks, manage research state, delegate steps to specialized agents, synthesize results, and validate quality.
- Scope: handles orchestration logic, state tracking, delegation, streaming progress updates, synthesis, and quality validation. It does not implement specialized research logic (those live in separate agent components).
- System context: receives user/plan requests via the A2A request handler and uses `A2ACommunicationManager` to send tasks to other agents. The component relies on `src/config.ts` for Genkit `ai` configuration and `src/agents/shared/interfaces.ts` for shared types.

## 2. Architecture Section

### High-level design patterns

- Coordinator/Orchestrator pattern: central logic for delegation and state management.
- Producer/consumer for task delegation and result collection across A2A boundaries.
- In-memory state management (map-based) with pluggable TaskStore (`InMemoryTaskStore`) for dev/test.
- Composition: small focused classes (TaskDelegator, A2ACommunicationManager, SynthesisEngine, QualityValidator, StreamingHandler) composed by `index.ts`.

### Internal and external dependencies

- Internal:
  - `TaskDelegator` — delegates research steps to agents.
  - `A2ACommunicationManager` / `MessageRouter` — handles sending tasks, timeouts, and routing messages.
  - `SynthesisEngine` — combines partial results into final syntheses.
  - `QualityValidator` — computes quality metrics and identifies issues.
  - `StreamingHandler` — manages real-time progress subscriptions and buffers.
  - `src/agents/shared/interfaces.ts` — shared types (ResearchStep, OrchestrationState, etc.).
  - `genkit` prompt (`orchestrator.prompt`) for high-level decision making.
- External:
  - `@a2a-js/sdk` — A2A protocol types and server helpers.
  - `express` — HTTP server used to expose A2A endpoints.
  - `uuid` — id generation.
  - System environment (GEMINI_API_KEY) for Genkit model access.

### Component interactions and relationships

- `index.ts` composes components and starts an Express server exposing the A2A agent card and endpoints.
- `OrchestratorAgentExecutor` (AgentExecutor) is the runtime entrypoint that receives a RequestContext and ExecutionEventBus from the A2A server and runs `execute()`.
- `execute()` uses the Genkit prompt to compute orchestration decisions, updates `OrchestrationState`, and calls into `TaskDelegator` to delegate steps which in turn uses `A2ACommunicationManager` to send tasks.
- `SynthesisEngine` and `QualityValidator` are invoked when results are returned to synthesize and validate outputs before publishing final task results.
- `StreamingHandler` provides streaming progress and subscription APIs consumed by clients.

### Component Structure and Dependencies Diagram

```mermaid
graph TD
  subgraph "Orchestrator Agent"
    O(Index) --> E(OrchestratorAgentExecutor)
    E --> TD(TaskDelegator)
    E --> SE(SynthesisEngine)
    E --> QV(QualityValidator)
    E --> SH(StreamingHandler)
    TD --> A2A(A2ACommunicationManager)
    A2A --> MR(MessageRouter)
  end

  subgraph "External"
    G[Genkit AI (Gemini)]
    AG[Web/Academic/News/Data Agents]
    TS[TaskStore / InMemoryTaskStore]
  end

  O --> TS
  E --> G
  TD --> AG
```

### Data flow and sequence

1. Client / A2A request arrives at the A2A express server.
2. `DefaultRequestHandler` invokes `OrchestratorAgentExecutor.execute()` with the request context and event bus.
3. Orchestrator publishes 'submitted' status and runs the Genkit prompt (`orchestrator.prompt`) to produce orchestration decisions.
4. `TaskDelegator` maps decisions to `TaskRequest` objects and sends them using `A2ACommunicationManager.sendTask()`.
5. Agents execute tasks, return `TaskResponse`, and `A2ACommunicationManager` notifies orchestrator (via `MessageRouter` handlers) or task callbacks.
6. `SynthesisEngine` aggregates results; `QualityValidator` assesses quality; `OrchestratorAgentExecutor` publishes final result updates.

## 3. Interface Documentation

### Public classes and key methods

| Class | Purpose | Key Methods | Notes |
|-------|---------|-------------|-------|
| `OrchestratorAgentExecutor` | Main agent executor for coordination | `execute(requestContext, eventBus)`, `cancelTask(taskId,eventBus)` | Creates/updates `OrchestrationState`, runs Genkit prompt, delegates steps. |
| `TaskDelegator` | Delegates ResearchSteps to agent tasks | `delegateResearchSteps(steps, state)`, `cancelTask(stepId)`, `getActiveTasks()` | Determines `AgentType` and maps step to `TaskRequest`;
| `A2ACommunicationManager` | Sends tasks to agents and handles timeouts | `sendTask(agentType, taskRequest)`, `sendParallelTasks(...)`, `cancelTask(taskId)` | Uses fetch to POST to agent `/execute` endpoints, manages pendingTasks/timeouts.
| `MessageRouter` | Routes incoming A2A messages | `routeMessage(message)` | Handles task-request/status-update/cancel messages.
| `SynthesisEngine` | Combines partial results into final syntheses | `synthesizeResults(results, state)` | Groups, cross-validates, generates narrative, computes confidence.
| `QualityValidator` | Computes quality metrics and flags issues | `validateResearchQuality(results, state)` | Returns overall score, breakdown, and recommendations.
| `StreamingHandler` | Manages streaming progress subscriptions | `startStream(researchId,state)`, `updateProgress(...)`, `subscribeToStream(...)`, `endStream(...)` | Buffers progress and notifies subscribers.

### Method/Property reference table (selected)

| Method | Purpose | Parameters | Return Type | Notes |
|--------|---------|------------|-------------|-------|
| `TaskDelegator.delegateResearchSteps` | Delegate multiple steps | `steps: ResearchStep[]`, `orchestrationState` | `Promise<ResearchStepExecution[]>` | Prioritizes, delegates, and returns executions.
| `A2ACommunicationManager.sendTask` | Send task to agent endpoint | `agentType`, `taskRequest` | `Promise<TaskResponse>` | Handles timeouts and pending task tracking.
| `SynthesisEngine.synthesizeResults` | Produce final synthesis | `results`, `orchestrationState` | `Promise<SynthesisResult>` | Returns narrative, findings, confidence metrics.
| `OrchestratorAgentExecutor.parseOrchestrationDecision` | Parse model response | `responseText: string` | `OrchestrationDecision` | Tries JSON parsing, falls back to default decision.

## 4. Implementation Details

### Main classes & responsibilities

- `OrchestratorAgentExecutor` (index.ts): Orchestrates the whole flow: publishes initial events, runs the Genkit orchestration prompt, updates state, delegates tasks, cycles until completion or max cycles reached, and publishes status updates.
- `TaskDelegator`: Contains step scheduling/prioritization logic and maps steps to agent-specific task requests with parameters (search queries, date ranges, etc.). It tracks active tasks and handles cancellation.
- `A2ACommunicationManager`: Responsible for HTTP interaction with agent endpoints, setting timeouts per task, tracking pending tasks, and providing convenience methods for parallel sends and cancellation.
- `SynthesisEngine`: Implements heuristics to extract findings, cross-validate, and generate human-readable synthesis narrative.
- `QualityValidator`: Computes weighted quality metrics (credibility, consistency, cross-validation, recency, completeness) and identifies issues.
- `StreamingHandler`: Provides a subscription API and buffered progress updates for clients to receive streaming progress.

### Configuration and initialization

- `index.ts` wires up `InMemoryTaskStore`, `A2ACommunicationManager`, `TaskDelegator`, and `OrchestratorAgentExecutor`. It creates a `DefaultRequestHandler` and starts an Express server using `A2AExpressApp` on port `41243` by default.
- Environment requirements: `GEMINI_API_KEY` must be set. Agent endpoints are configurable via environment variables (e.g., `WEB_RESEARCH_AGENT_URL`).

### Key algorithms and business logic

- Step prioritization: priority -> fewer dependencies -> shorter estimated duration.
- Task timeouts: derived from step estimatedDuration (minutes -> ms) with a default fallback; timeouts trigger task cleanup.
- Synthesis: grouping by dimension, extracting findings, cross-validating and calculating consensus levels.
- Quality scoring: weighted aggregation of multiple heuristics into an overallScore.

### Performance considerations

- Current implementation uses in-memory structures; concurrency limits and persistence would be required for production scale.
- `A2ACommunicationManager.sendParallelTasks` uses Promise.all — consider bounded concurrency for many parallel steps.
- Synthesis and validation logic do in-memory processing; for very large result sets, consider streaming or batching approaches.

### Error handling and resilience

- `execute()` wraps orchestration in try/catch and publishes a failure TaskStatusUpdateEvent on exceptions.
- `TaskDelegator` handles per-step delegation failures and logs errors; `handleTaskFailure` marks executions as failed and removes active tasks.
- A2A manager sets per-task timeouts and removes pending tasks on timeout or error.
- There are basic cancellation paths (OrchestratorAgentExecutor.cancelTask and A2ACommunicationManager.cancelTask) but they are best-effort; agent-side cancel endpoints are not implemented.

## 5. Usage Examples

### Start the orchestrator agent

```bash
npm run agents:orchestrator-agent
```

### Basic orchestration request (via A2A CLI)

```bash
npm run a2a:cli http://localhost:41243
# then send: "Execute this research plan and coordinate with specialized research agents"
```

### Programmatic usage (internal testing)

- Create `TaskRequest` items and call `A2ACommunicationManager.sendTask('web-research', taskRequest)` to simulate delegation.

## 6. Quality Attributes

- Security: currently minimal; no authentication on agent endpoints — add TLS and auth for production.
- Performance: In-memory state store; scale will require DB-backed TaskStore and rate limiting.
- Reliability: Timeouts, cancellation, and basic error handling exist; further work needed for idempotency and distributed consistency.
- Maintainability: Clear separation of concerns across small classes makes the component approachable.
- Extensibility: New agent types and task mappings can be added in `TaskDelegator`.

## 7. Reference Information

### Dependencies (selected)

- `@a2a-js/sdk` — A2A types and server helpers
- `genkit` — AI flows and prompts
- `express` — http server
- `uuid` — id generation

### Configuration options

- `GEMINI_API_KEY` — required
- Agent endpoint env vars: `WEB_RESEARCH_AGENT_URL`, `ACADEMIC_RESEARCH_AGENT_URL`, `NEWS_RESEARCH_AGENT_URL`, `DATA_ANALYSIS_AGENT_URL`
- `ORCHESTRATOR_AGENT_PORT` — server port

### Testing guidelines

- Unit test the `TaskDelegator` prioritization/step mapping logic with sample `ResearchStep` inputs (see `__tests__/orchestrator.spec.ts`).
- Mock `A2ACommunicationManager` when testing `TaskDelegator` to avoid network calls.
- Use deterministic `ai` instances or mocks for Genkit prompts in unit tests.

### Troubleshooting

- If agent doesn't start, ensure `GEMINI_API_KEY` is set and port is free.
- For task timeouts, increase `estimatedDuration` on the `ResearchStep` or tune default timeouts in `A2ACommunicationManager`.

### Change history

- 2025-09-26: Initial documentation generated.

---

_Last updated: 2025-09-26 by team_

---
title: "Content Editor Agent - Technical Documentation"
component_path: "src/agents/content-editor/"
version: "1.0"
date_created: "2025-09-26"
last_updated: "2025-09-26"
owner: "AI Agents Team"
tags:
  - component
  - agent
  - service
  - content-editing
  - documentation
  - architecture
  - usage
---

# Content Editor Agent Documentation

The Content Editor Agent is a specialized A2A agent designed for proof-reading and polishing textual content. It receives natural language requests for content editing and produces refined, professional-grade text outputs. The agent integrates Genkit with the Google Gemini model and follows the A2A protocol for task management and event publishing.

## 1. Component Overview

### Purpose/Responsibility

- Provide high-quality proofreading and polishing of content to improve clarity, tone, grammar, and style while preserving original meaning.
- Handle content editing requests within the A2A multi-agent ecosystem, providing structured task lifecycle management.
- Generate edited content as A2A messages, supporting streaming and cancellation for interactive workflows.

Scope:

- Included: Text-based content editing, A2A task handling (submitted, working, completed, failed, canceled), Genkit prompt execution, event publishing.
- Excluded: Multi-modal editing (images, videos), persistent storage beyond in-memory tasks, advanced formatting (HTML/CSS), collaborative editing.

System Context:

The agent operates as an Express-based A2A service, discoverable via `/.well-known/agent-card.json`. It receives editing tasks from orchestrators or other agents via the A2A gateway and depends on Genkit for AI-driven editing capabilities.

## 2. Architecture Section

- Design patterns: Adapter (Genkit response to A2A events), Observer (publishes status updates to ExecutionEventBus), Strategy (pluggable prompt-based editing).
- Internal dependencies: `genkit` (AI orchestration), local `content_editor.prompt` (editing instructions), `@a2a-js/sdk` (A2A server primitives), `express` (HTTP server). External dependencies: Google Gemini via `@genkit-ai/googleai`.
- Component interactions: Incoming A2A requests route through `DefaultRequestHandler` to `ContentEditorAgentExecutor.execute`. The executor transforms request history into Genkit messages, executes the prompt, and publishes status events on the `ExecutionEventBus`.
- Visual diagrams: See mermaid diagram below.

### Component Structure and Dependencies Diagram

```mermaid
graph TD
  subgraph "Content Editor Agent"
    Executor[ContentEditorAgentExecutor]
    RequestHandler[DefaultRequestHandler]
    TaskStore[InMemoryTaskStore]
    GenkitAI[Genkit AI (ai)]
    Prompt[content_editor.prompt]
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
  GenkitAI --> Prompt
  GenkitAI --> Gemini
  Executor -->|Events| Gateway
  Gateway --> OtherAgents

  classDiagram
    class ContentEditorAgentExecutor {
      - cancelledTasks: Set<string>
      + execute(requestContext, eventBus): Promise<void>
      + cancelTask(taskId, eventBus): Promise<void>
    }
    class GenkitAI {
      + prompt(name): Prompt
      + runPrompt(prompt, input): Promise<Response>
    }

    ContentEditorAgentExecutor --> GenkitAI
    GenkitAI ..> Prompt : uses
```

## 3. Interface Documentation

- Document all public interfaces and usage patterns: A2A endpoints (send message, task status, cancel) via `DefaultRequestHandler` and the `AgentCard` at `/.well-known/agent-card.json`.
- Create method/property reference table: See table below.
- Document events/callbacks/notification mechanisms: Events published via `ExecutionEventBus`: task creation, status updates (working, completed, failed, canceled), and agent messages with edited content.

| Method/Property | Purpose | Parameters | Return Type | Usage Notes |
|-----------------|---------|------------|-------------|-------------|
| execute | Process editing request and generate polished content | requestContext: RequestContext, eventBus: ExecutionEventBus | Promise<void> | Transforms history to Genkit messages, runs prompt, publishes events. |
| cancelTask | Cancel ongoing editing task | taskId: string, eventBus: ExecutionEventBus | Promise<void> | Adds to cancelledTasks set and emits canceled status. |
| contentEditorAgentCard | Agent discovery metadata | N/A | AgentCard | Defines skills like "editor" for content polishing. |

## 4. Implementation Details

- Document main implementation classes and responsibilities: `ContentEditorAgentExecutor` (index.ts) handles task lifecycle and Genkit integration; `ai.prompt("content_editor")` (genkit.ts) defines the editing prompt.
- Describe configuration requirements and initialization: Requires `GOOGLE_API_KEY` (checked at startup); server listens on `CONTENT_EDITOR_AGENT_PORT` (default 10003); uses InMemoryTaskStore for tasks.
- Document key algorithms and business logic: Builds MessageData from A2A history, executes `contentEditorPrompt` with messages, publishes working/completed statuses with edited text; handles empty messages with failure status.
- Note performance characteristics and bottlenecks: Single prompt call per task; low latency for text editing. Bottlenecks: Model response time; no streaming (non-streaming prompt execution).

## 5. Usage Examples

### Basic Usage

Send an editing request via A2A client:

```typescript
// Pseudocode using A2A SDK
const result = await a2aClient.sendMessage({
  agentUrl: 'http://localhost:10003',
  message: 'Edit this article for professional tone: [content]'
});
// Receive edited content in task completion event
```

### Advanced Usage

Cancel a long-running edit:

```typescript
await a2aClient.cancelTask({
  agentUrl: 'http://localhost:10003',
  taskId: 'task-uuid'
});
```

- Provide basic usage examples: Single text editing request.
- Show advanced configuration patterns: Integrate in multi-agent flow, e.g., post-research content polishing.
- Document best practices and recommended patterns: Provide clear editing instructions; handle large texts in chunks if needed.

## 6. Quality Attributes

- Security (authentication, authorization, data protection): Unauthenticated local endpoint; add auth/TLS for production. Sanitize inputs to prevent prompt injection.
- Performance (characteristics, scalability, resource usage): Fast for short texts; scale with model concurrency. Memory: InMemoryTaskStore limits to ~100 concurrent tasks.
- Reliability (error handling, fault tolerance, recovery): Try-catch wraps prompt execution; emits failed status on errors. Cancellation supported mid-execution.
- Maintainability (standards, testing, documentation): Modular (prompt separate from executor); add tests for message transformation and event publishing.
- Extensibility (extension points, customization options): Easy to swap prompts or add tools (e.g., grammar checkers); extend for multi-language editing.

## 7. Reference Information

- List dependencies with versions and purposes: genkit (beta), @genkit-ai/googleai, @a2a-js/sdk, express, dotenv, uuid.
- Complete configuration options reference: GOOGLE_API_KEY (required), CONTENT_EDITOR_AGENT_PORT (optional, default 10003).
- Testing guidelines and mock setup: Mock Genkit prompt to test executor flow; unit test message history to MessageData conversion.
- Troubleshooting (common issues, error messages): "No message found to process" — check A2A message has text parts. "GOOGLE_API_KEY not set" — set env var.
- Related documentation links: [orchestrator-agent-documentation.md](orchestrator-agent-documentation.md) (for integration), [README.md](../../src/agents/content-editor/README.md) (setup).
- Change history and migration notes: 2025-09-26 v1.0 — Initial documentation.

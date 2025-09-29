# Progress — Genkit-UI

What works

- **Coder & Content-Editor Agents**: Tests for both agents are now passing. The `coder` agent includes a new resilient fallback mechanism. The `content-editor` agent now correctly implements DotPrompt loading.
- **Dual Backend Architecture**: Genkit flows (HTTP/FlowServer + Firebase Functions) and A2A agents (8 specialized agents) both functional
- **Genkit UI**: Starts and displays flows from [src/index.ts](../src/index.ts)
- **Flow Server**: HTTP server exposing flows on port 3400 with CORS
- **Firebase Functions**: Separate Genkit setup with Firebase telemetry for serverless deployment
- **A2A Agents**: 8 agents (orchestrator, planning, coder, content-editor, data-analysis, news-research, academic-research, web-research) with Express servers
- **Toolbox Integration**: Local PostgreSQL-based toolbox running with 7 tools via Docker Compose
- **CLI Client**: A2A client for agent interaction with streaming support
- **Agent Cards**: All agents have comprehensive cards with protocol 0.3.0, security schemes, and skills
- **Task Lifecycle**: Basic task management with status updates and artifacts implemented
- **State Persistence**: Metadata-based storage methods in orchestrator executor

What's left

- **A2A Streaming**: Implement ExecutionEventBus with SSE for real-time updates across all agents
- **Error Handling**: Add comprehensive A2AError codes and structured responses
- **Security**: Implement authentication middleware (API key, OAuth2, JWT) for agents
- **Client Enhancement**: Full A2AClient API usage with cancelTask, resubscribeTask
- **CI Pipeline**: Link validation, linting, and testing gates
- **Tool Hardening**: Rate limits, retries, and fallbacks for external APIs
- **Integration Testing**: Full agent orchestration flows with toolbox integration

Known issues / risks

- **External Dependencies**: Toolbox and external APIs may be unreliable in production
- **A2A Protocol Maturity**: @a2a-js/sdk in beta - potential breaking changes
- **Deployment Complexity**: Coordinating Firebase App Hosting + Functions with A2A agents
- **State Recovery**: Orchestrator state persistence needs full integration testing

Recent updates

- 2025-09-29: Session concluded. `coder` agent tests are passing (3/3), `content-editor` agent tests completed and passing (corrected by user). `orchestrator` agent: result-aggregator.spec.ts created but deemed unusable by user. `TASK009` is 67% complete (coder + content-editor complete, orchestrator failed).
- 2025-09-28: Memory Bank updated with comprehensive project architecture understanding
- 2025-09-28: Dual backend pattern documented (flows via HTTP/Firebase + A2A agents)
- 2025-09-28: Firebase deployment strategy clarified (App Hosting + Functions)
- 2025-09-28: Toolbox integration documented (7 PostgreSQL tools running locally)
- 2025-09-28: Architecture patterns established distinguishing flows vs agents usage
- 2025-09-29: Consolidated A2A URLs to docs/a2a.md as the single source of truth; removed duplicates from Memory Bank

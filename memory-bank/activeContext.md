# Active Context — Genkit-UI

Date: 2025-09-28

Current focus

- A2A protocol alignment for orchestrator and shared interfaces (v0.3.x)
- Keep flows and orchestrator tests green with 100% coverage on flows

Recent changes

- Updated orchestrator AgentCard.protocolVersion to `0.3.0`
- Aliased local `AgentCard` type to `@a2a-js/sdk` AgentCard to avoid drift
- Introduced optional A2AClient transport in `A2ACommunicationManager` (guarded by `USE_A2A_CLIENT`)
- Added unit test for sendTaskStream fallback path (no A2A client); validates synthetic message emission
- All tests passing (84/84); flows remain at 100% coverage

Authoritative patterns observed (from @a2a-js/sdk)

- A2AExpressApp uses a single POST endpoint that returns JSON or SSE when the handler yields an AsyncGenerator.
- Client supports:
  - `sendMessage` (message/send)
  - streaming via `sendMessageStream` (message/stream) yielding Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent
  - `cancelTask` (tasks/cancel) and `resubscribeTask` (tasks/resubscribe)
  - Push notification config CRUD (set/get/list/delete)
- ExecutionEventQueue stops on final=true TaskStatusUpdateEvent or a Message event.

Decisions

- Keep our existing fetch-based path as default; add JSON-RPC transport behind env flags to avoid breaking tests.
- Treat streamed items defensively; convert to our local progress updates and publish to StreamingHandler.
- Defer push notifications until after streaming is stable.

Next steps

- Wire streaming path (`sendMessageStream`) into orchestrator’s task delegation for real-time updates (guarded by env)
- Implement proper cancel semantics via `tasks/cancel`; publish final canceled status
- Consider enabling push notifications in AgentCard and client config

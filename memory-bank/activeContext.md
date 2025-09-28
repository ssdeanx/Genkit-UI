# Active Context — Genkit-UI

Date: 2025-09-28

Current focus

- Finalize coder agent executor fix (user actively editing `src/agents/coder/executor.ts`)
- Ensure content-editor and data-analysis agents use the main logger and contain no stray `console.*`
- Keep all agent, flow, and tool test suites green

Recent changes

- Coder agent server now uses the main `flowlogger` in `src/agents/coder/index.ts` and guards GEMINI_API_KEY at runtime (skipped in tests)
- Research agents (web, news, academic) received deterministic unit tests and minor query composition fixes; suites green
- Orchestrator and planning-agent suites green; A2A communication path supports DI and streaming tests

Authoritative patterns observed (from @a2a-js/sdk)

- A2AExpressApp exposes JSON and SSE via a single handler depending on generator usage
- Client supports `sendMessage`, `sendMessageStream`, `cancelTask`, and `resubscribe`
- Streams terminate on final TaskStatusUpdateEvent or terminal Message

Decisions

- Prefer DI for transports and external services to keep tests deterministic
- Avoid direct `console.*` in agents; use shared logger (`flowlogger`) instead
- Keep JSON-RPC/streaming paths behind environment flags if needed to protect tests

Next steps

- Complete coder executor adjustments: streaming/cancel semantics and validation intact, adopt main logger
- Sweep content-editor and data-analysis agents for any `console.*` and replace with `flowlogger`
- Run full test suite after executor fix and update docs accordingly

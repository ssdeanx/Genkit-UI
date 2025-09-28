# Progress — Genkit-UI

What works

- Genkit UI starts and lists flows defined in `src/index.ts`
- Core flows and tools present (see `src/flows` and `src/tools`)
- Agents runnable via npm scripts; A2A infra present

What’s left

- Expand tests for agents and A2A interactions (ongoing but major suites added)
- Harden tools (rate limits, errors) and add real API keys where needed
- CI: ensure lint/typecheck/tests gates, add docs link validation

Known issues / risks

- External APIs may be flaky; add retries and fallbacks
- Schema drift between flows and tools possible without tests

Recent updates

- 2025-09-28: Research agents (web/news/academic) tests implemented; minor query composition fixes applied; suites green.
- 2025-09-28: Orchestrator and planning-agent suites validated green; A2A comms supports DI and streaming tests.
- 2025-09-28: Coder agent index uses main logger and runtime key guard; executor fix in progress by user.

# Progress — Genkit-UI

What works

- Genkit UI starts and lists flows defined in `src/index.ts`
- Core flows and tools present (see `src/flows` and `src/tools`)
- Agents runnable via npm scripts; A2A infra present

What’s left

- Expand tests for agents and A2A interactions
- Harden tools (rate limits, errors) and add real API keys where needed
- CI: ensure lint/typecheck/tests gates, add docs link validation

Known issues / risks

- External APIs may be flaky; add retries and fallbacks
- Schema drift between flows and tools possible without tests

Recent updates

- 2025-09-27: Initialized Memory Bank and scaffolding files

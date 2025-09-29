# Implementation Tasks — Genkit-UI

Current Status (2025-09-28)

**In Progress:**

- TASK008: Complete A2A implementation (streaming, error handling, security features)

**Pending:**

- TASK004: CI link validation setup

**Completed:**

- TASK001: Memory Bank setup
- TASK002: Expand flow & tool tests
- TASK003: A2A integration tests
- TASK005: Research agents tests
- TASK006: Remaining agents tests
- TASK007: Final executor fix

Plan (current)

- Complete TASK008 A2A implementation (streaming, error handling, security)
- Set up TASK004 CI link validation
- Integration testing for full agent orchestration with toolbox
- Tool hardening (rate limits, retries, fallbacks)
- Firebase deployment validation

Dependencies

- GEMINI_API_KEY and GOOGLE_API_KEY configured
- Local dev via Node 22.20.0 and TS 5.9.2
- Docker for toolbox development
- Firebase CLI for deployment testing

Definition of Done

- All tasks documented under `memory-bank/tasks/` with updates in `_index.md`
- Tests green; lint/typecheck clean
- Dual backend (flows + agents) functional
- Firebase deployment working
- Toolbox integration complete

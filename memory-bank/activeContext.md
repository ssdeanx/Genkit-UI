# Active Context — Genkit-UI

Date: 2025-09-30

## Current Work Focus

**Session Status**: Phase 2 (Planning-Agent) completed successfully! 🎉

**Historic Achievement**: First file in project history to achieve **PERFECT 100% coverage** on all metrics (query-analyzer.ts)!

**Completed Work**:

- **Planning-Agent Coverage (TASK010 Phase 2)**: Achieved 91.47% lines (+11.6%), 92.16% branches (+11.62%), 97 tests (+81 new tests, +506.25%). Five files significantly improved, one achieved perfect 100% coverage.
  - query-analyzer.ts: **100% lines, 100% branches, 100% functions** (PERFECT!)
  - methodology-selector.ts: 96.99% lines, 97.67% branches
  - risk-assessor.ts: 95.14% lines, 89.41% branches
  - contingency-planner.ts: 92.03% lines, 92.7% branches
  - data-source-identifier.ts: 84.5% lines, 80.7% branches

- **Orchestrator-Agent Coverage (TASK010 Phase 1b)**: Achieved 82.52% branch coverage, 330 tests (+62 new tests). All critical files now above 80% branch coverage.

- **Data-Analysis Agent (TASK010 Phase 1a)**: Achieved 91.86% coverage (up from 55.42%) with 7 comprehensive tests. Fixed critical module-level ai.prompt initialization bug.

- **Coder & Content-Editor Agents**: Tests for both agents passing with high coverage (97.51% and 100% respectively).

- **A2A Testing Architecture (`DESIGN001`, `REQ001`, `REQ002`)**: Formal design and requirements documenting resilient testing patterns for A2A agents.

**Critical Workflow Established**:

1. **ALWAYS check TypeScript errors with get_errors BEFORE running tests** - prevents wasted test runs
2. **Weakest-first strategy** - yields 20-30% coverage gains per file
3. **Multi-round approach** - Round 1 (+15-20%), Round 2 (+5-10%), Round 3 (+2-5%)
4. **Comprehensive testing** - Add 10-15 tests per file targeting all uncovered branches
5. **TypeScript patterns** - Use `Record<string, string | undefined>`, explicit type annotations, verify interface definitions
6. **Interface verification** - Read actual method signatures before writing tests
7. **Test assertion flexibility** - Match actual implementation behavior
8. **Batch operations** - Use multi_replace_string_in_file for related fixes

**Remaining Work**:

- **`TASK010`**: Continue coverage improvements for remaining agents (academic-search, news-search, web-search at 66-77%)
- **`TASK008`**: Complete A2A implementation (streaming, error handling, security) remains in progress
- **`TASK004`**: CI link validation setup is still pending

### A2A Agent URLs (source of truth)

Moved to docs/a2a.md. This Memory Bank intentionally does not duplicate URLs. See that file for the live list and documentation links.

## Architecture Overview

**Dual Backend Architecture**:

- **Genkit Flows** ([src/flows/](../src/flows/)): HTTP-exposed flows via [flowServer.ts](../src/flowServer.ts) (port 3400) and Firebase Functions ([functions/](../functions/))
- **A2A Agents** ([src/agents/](../src/agents/)): 8 specialized agents using @a2a-js/sdk for inter-agent communication
- **Toolbox Integration**: Local PostgreSQL-based toolbox with 7 tools running via Docker Compose
- **Deployment**: Firebase App Hosting for backend flows, Functions for serverless execution

**Key Components**:

- Main [src/config.ts](../src/config.ts): Genkit with Gemini 2.5 Flash, vectorstore, advanced model config
- Functions [functions/src/config.ts](../functions/src/config.ts): Firebase-optimized Genkit setup with telemetry
- CLI [src/cli.ts](../src/cli.ts): A2A client for agent interaction
- Toolbox [src/config/toolbox.ts](../src/config/toolbox.ts): Integration with local toolbox server

## Decisions

- Maintain dual architecture: flows for direct HTTP calls, agents for complex orchestration
- Use Firebase for production deployment with App Hosting + Functions
- Keep toolbox local for development with Docker Compose
- Complete A2A protocol implementation across all agents
- Focus on streaming and error handling for production readiness

## Next Steps

- Complete A2A streaming implementation
- Add comprehensive error handling with A2A error codes
- Implement security middleware for agents
- Set up CI link validation
- Test full agent orchestration flows
- Implement complete task lifecycle management with proper status updates
- Add streaming support to agent executors using ExecutionEventBus
- Enhance error handling with A2A-specific error codes and structured responses
- Update agent servers to use A2AExpressApp pattern with proper middleware

# Active Context — Genkit-UI

Date: 2025-09-29

## Current Work Focus

**Session Status**: Session concluding. All work for this session is complete. Memory Bank is being updated with the final state.

**Completed Work**:

- **Coder Agent (`TASK009`)**: The `coder` agent's executor and tests have been fully refactored and fixed. A resilient fallback mechanism was added to ensure the agent completes tasks even when AI generation fails. All tests for the `coder` agent are now passing.
- **Content-Editor Agent**: After several incorrect attempts, the user has corrected the implementation. The `content-editor` agent's executor now correctly uses DotPrompts, and its tests are passing.
- **A2A Testing Architecture (`DESIGN001`, `REQ001`, `REQ002`)**: Formal design and requirements were created to document the resilient testing patterns established for A2A agents.

**Remaining Work**:

- **`TASK008`**: Complete A2A implementation (streaming, error handling, security) remains in progress but is paused at the end of this session.
- **`TASK004`**: CI link validation setup is still pending.

## Session Update — 2025-09-29

- **Session End**: This session is now complete.
- **Test Status**: All tests for `coder` and `content-editor` agents are now passing. The `orchestrator` agent was not addressed in this session.
- **Memory Bank**: The Memory Bank has been updated to reflect the final state of this session's work. The `coder` agent fix and the user's correction of the `content-editor` agent are now documented.

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

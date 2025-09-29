# Active Context — Genkit-UI

Date: 2025-09-28

## Current Work Focus

**Session Status**: Memory Bank sync session - validating current state and ensuring consistency across all documentation.

**Completed Work**:

- Comprehensive project architecture documented including dual-backend approach (flows + A2A agents)
- Firebase deployment strategy clarified with App Hosting and Functions
- Toolbox integration documented (7 tools running locally via Docker)
- Agent vs Flow architecture patterns established
- Memory Bank consistency validated across all files

**Remaining Work**:

- Complete TASK008 A2A implementation (streaming, error handling, security)
- TASK004 CI link validation setup

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

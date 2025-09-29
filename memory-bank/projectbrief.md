# Project Brief — Genkit-UI

Purpose: Build a multi‑agent AI system using Google Genkit with dual backend architecture: HTTP-exposed flows for direct API calls and A2A agents for complex orchestration, with robust tools and clear observability.

Goals

- **Dual Backend**: Genkit flows (HTTP/FlowServer + Firebase Functions) for direct calls, A2A agents for orchestration
- Provide reusable Genkit tools with Zod validation and toolbox integration (7 PostgreSQL tools)
- Maintain high developer UX (Genkit UI, CLI, tests, docs) across both architectures
- Ensure security (keys, isolation), reliability, and maintainability
- Deploy via Firebase App Hosting + Functions for production

Non‑Goals (for now)

- Full persistence of long‑term user data beyond logs and artifacts
- Complex auth schemes between local agents (prod only)

Success Criteria

- Flows discoverable and runnable in Genkit UI and via HTTP/FlowServer
- Agents start locally via npm scripts and respond via A2A protocol
- Firebase deployment functional with App Hosting and Functions
- Toolbox tools integrated and working (7 PostgreSQL-based tools)
- Tests pass (Vitest) with coverage for key flows/tools/agents
- Memory Bank maintained and up to date across tasks

Constraints

- TypeScript ^5.9.2, Node per `.nvmrc` 22.20.0
- Genkit ecosystem ^1.20.0; Express ^4.21.2; @a2a-js/sdk ^0.3.4; Zod ^4.1.11
- Firebase Functions ^6.4.0, @genkit-ai/firebase ^1.20.0
- Require GEMINI_API_KEY and GOOGLE_API_KEY for deployment

Stakeholders

- Developers building and extending agents/tools/flows
- Users invoking flows via Genkit UI, HTTP, or Firebase Functions
- DevOps managing Firebase deployments

Scope v1

- **Flows**: 15+ Genkit flows (orchestrator, planning, coder, content, research, etc.)
- **Agents**: 8 A2A agents (orchestrator, planning, coder, news, academic, data-analysis, web-research, content-editor)
- **Tools**: Core Genkit tools + 7 PostgreSQL toolbox tools
- **Deployment**: Firebase App Hosting + Functions with proper secrets management

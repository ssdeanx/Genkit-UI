# Project Brief — Genkit-UI

Purpose: Build a multi‑agent AI system using Google Genkit and A2A for research orchestration, code generation, and content creation, with robust tools and flows and clear observability.

Goals

- Orchestrate specialized agents (planning, coder, content editor, research) via A2A
- Provide reusable Genkit tools and flows with Zod validation
- Maintain high developer UX (Genkit UI, CLI, tests, docs)
- Ensure security (keys, isolation), reliability, and maintainability

Non‑Goals (for now)

- Full persistence of long‑term user data beyond logs and artifacts
- Complex auth schemes between local agents (prod only)

Success Criteria

- Flows discoverable and runnable in Genkit UI
- Agents start locally via npm scripts and respond via A2A
- Tests pass (Vitest) with coverage for key flows/tools
- Memory Bank maintained and up to date across tasks

Constraints

- TypeScript ^5.9.2, Node per `.nvmrc` 22.20.0
- Genkit ecosystem ^1.20.0; Express ^4.21.2; @a2a-js/sdk ^0.3.4; Zod ^4.1.11
- Require GEMINI_API_KEY to run agents/flows

Stakeholders

- Developers building and extending agents/tools/flows
- Users invoking flows via Genkit UI or HTTP server

Scope v1

- Core flows (orchestrator, planning, coder, content, research)
- Core agents (orchestrator, planning, coder, news, academic, data-analysis, web-research, content-editor)
- Basic tools (wikipedia, calculator, weather)

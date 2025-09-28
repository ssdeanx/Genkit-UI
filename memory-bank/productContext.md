# Product Context — Genkit-UI

Why it exists

Genkit-UI enables fast iteration on multi‑agent AI systems by combining:

- Genkit flows (typed orchestration, tools, observability)
- A2A agents (composable services with prompts and tools)
- Developer tooling (Genkit UI, CLI, tests)

Primary users

- Repo contributors and agent developers
- Researchers and engineers experimenting with flows and tools

User experience goals

- Quick start: run flows in Genkit UI; start agents via npm scripts
- Confidence: strong typing via Zod; unit tests via Vitest
- Transparency: readable prompts, clear logs, observable flows

Key scenarios

- Generate a research plan and delegate tasks across agents
- Generate and refine code via coder agent; validate with evaluators
- Perform web/news/academic research with tools and summarize

# Requirements (EARS) — Genkit-UI

Ubiquitous

- THE SYSTEM SHALL expose Genkit flows with validated inputs/outputs via Zod.
- THE SYSTEM SHALL enable A2A communication between agents adhering to @a2a-js/sdk.

Event‑driven

- WHEN a user starts `genkit:ui`, THE SYSTEM SHALL register and display all exported flows from `src/index.ts`.
- WHEN an agent process starts, THE SYSTEM SHALL expose its AgentCard at `/.well-known/agent-card.json`.

State‑driven

- WHILE running locally, THE SYSTEM SHALL load configuration from `.env` via dotenvx.

Unwanted behavior

- IF a tool experiences a recoverable error, THEN THE SYSTEM SHALL return a descriptive error and avoid crashing the flow.

Optional

- WHERE streaming is supported, THE SYSTEM SHALL stream partial results to improve UX.

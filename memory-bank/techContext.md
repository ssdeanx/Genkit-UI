# Tech Context — Genkit-UI

Versions (from `package.json` and `.nvmrc`)

- Node.js: 22.20.0
- TypeScript: ^5.9.2
- Genkit core: ^1.20.0 (plus plugins: google-genai/googleai/vertexai, express, dev-local-vectorstore, evaluator)
- Express: ^4.21.2
- Zod: ^4.1.11
- @a2a-js/sdk: ^0.3.4
- Vitest: ^3.2.4

Execution

- TS runs via `tsx`; no build step needed for local dev
- Genkit UI: `npm run genkit:ui`
- Flow HTTP server: `npm run flow:serve` (or `flow:serve:dev` with watch)
- Agents: `npm run agents:<name>` (see `AGENTS.md` for ports)

Environment

- Required: `GEMINI_API_KEY`
- Optional: `SERPAPI_API_KEY`, `NEWSAPI_API_KEY`, `VECTORSTORE_INDEX`
- Local .env managed via dotenvx; see `.env.example`

Conventions

- ESM (`type":"module`) and strict TS
- ESLint + Prettier; run `npm run lint` and `npm run typecheck`
- Tests with Vitest; coverage with `npm run coverage`

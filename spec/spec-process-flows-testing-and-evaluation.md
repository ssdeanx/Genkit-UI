# Spec: Flows Testing and Evaluation

## Goals

- Unit-test every flow deterministically with no network calls
- Record test results as JSON at tests/test-results.json
- Keep Orchestrator agent tests fast and resilient via prompt mocking
- Enable local observability in Genkit Dev UI
- Prepare evaluation runs using Genkit Evaluator with small datasets

## Status Summary

- Unit tests: All flow suites are covered and green (see tests/test-results.json)
- Reporter: Vitest JSON reporter enabled in vitest.config.ts
- Orchestrator tests: Stable via ai.prompt module mock and event assertions
- Local observability: Ready via npm run genkit:ui
- Evaluation: Library available; wiring left for follow-up (see Plan)

## Testing Conventions

- ESM/NodeNext throughout; use .js specifiers for local imports
- Mock ai.defineFlow per test file to return a callable function; do not import a real Genkit runtime
- Provide a default context object in mocks to satisfy flow handlers that destructure context
- Tools/Vectorstore: Mock as needed (VECTORSTORE_INDEX defaults to "Based")

### Example: defineFlow mock

- Use a per-suite mock that wraps the implementation and returns a function
- Pass { context: undefined } by default so handlers can destructure safely

### Orchestrator agent test pattern

- Mock ../genkit.js to return ai.prompt bound to the orchestrator prompt name
- New executor instances should not start a server (index.ts already guards NODE_ENV=test)
- Assert on eventBus.publish calls and TaskDelegator.delegateResearchSteps invocations

## JSON Test Results

- Configured via vitest.config.ts reporters, e.g.: `['default', ['json', { outputFile: 'tests/test-results.json' }]]`
- Result file is written on every run; CI can parse it for dashboards

## Local Observability (Genkit Dev UI)

- Start the Dev UI and watch src/index.ts:
  - npm run genkit:ui
- Tips:
  - Prompts are auto-discovered from src/prompts
  - Enable thinkingConfig.showThoughts in src/config.ts for traces
  - Use the Dev UI to invoke flows, inspect traces, and verify tool calls

## Evaluation Plan (Genkit Evaluator)

- Dependencies present: @genkit-ai/evaluator, @genkit-ai/checks
- Minimal wiring steps (follow-up PR):
  1. Create datasets under datasets/ (JSONL or JSON) per flow, e.g., datasets/coder.json
  2. Add evaluator registration (e.g., toxicity, faithfulness) in a lightweight evaluator.ts, imported by src/index.ts
  3. Document and add npm scripts to run evaluations via genkit CLI (eval:flow on datasets)
- Example dataset item shape:
  - { input: { ... }, expected: { ... }, meta?: { id, notes } }
- Example checks to consider:
  - Faithfulness (RAG flows), JSON validity, Safety, Task success heuristics

## Acceptance Criteria

- All flow tests pass locally with npm run coverage
- tests/test-results.json produced and reflects suite results
- Orchestrator tests are deterministic and side-effect free
- Dev UI opens and shows registered flows
- Evaluation run instructions documented and followable

## Risks and Mitigations

- ESM import resolution: Always use explicit .js for local imports
- Process exit on missing keys: index.ts guarded for NODE_ENV=test
- Vectorstore dependencies: Use dev-local-vectorstore with default index

## Next Steps

- Wire evaluator registration and create a sample evaluation run for one flow (ragFlow)
- Add CI step to upload JSON test results artifact
- Expand datasets for broader coverage over time

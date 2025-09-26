---
title: "Coder Agent: Streaming & Format Improvements"
category: "Architecture"
status: "🔴 Not Started"
priority: "High"
timebox: "1 week"
created: 2025-09-26
updated: 2025-09-26
owner: "sam"
tags: ["technical-spike", "architecture", "research"]
---

# Coder Agent: Streaming & Format Improvements

## Summary

**Spike Objective:** Identify and validate concrete improvements to the Coder Agent to make code-generation streaming robust, strongly-typed, and production-ready. The scope covers prompt/format wiring, streaming reliability, artifact publishing semantics, and test coverage.

**Why This Matters:** The Coder Agent generates code artifacts (multiple files) via Genkit streaming. Bugs or weak handling in streaming/format parsing cause partial artifacts, misordered files, or broken CI. Improving robustness will increase developer trust, reduce flaky outputs, and enable safe automation in CI/CD.

**Timebox:** 1 week

**Decision Deadline:** 2025-10-03

## Research Question(s)

**Primary Question:** What concrete changes (code, configuration, tests) will make the Coder Agent reliably emit complete, ordered code artifacts and be safe to run in CI?

**Secondary Questions:**

- How should the agent parse and validate streamed code chunks to tolerate malformed model output?
- Should the code format be typed/registered as a Zod schema and used for runtime parsing? (Yes — evaluate tradeoffs)
- What backpressure or streaming controls (interrupts, finish_reason checks) are required to avoid partial outputs?
- Which unit/integration tests are necessary to catch regressions in streaming parsing and artifact assembly?

## Investigation Plan

### Research Tasks

- [ ] Review existing Coder Agent files: `src/agents/coder/code-format.ts`, `src/agents/coder/genkit.ts`, and `src/agents/coder/index.ts` (done: initial scan)
- [ ] Look up Genkit docs for streaming, formats, and defineSchema/defineFormat (js/models.md, js/dotprompt.md, js/api-references.md)
- [ ] Prototype safe parsing rules for the `CodeMessage` format: tolerant extraction, per-file accumulation, explicit 'done' markers
- [ ] Add interruption/finish_reason handling and a final aggregation/validation step before publishing artifacts
- [ ] Add a small integration test that mocks Genkit streaming chunks to validate ordering & finalization
- [ ] Document recommended changes and deliver a small patch set for low-risk fixes

### Success Criteria

**This spike is complete when:**

- [ ] A clear list of prioritized changes is documented and approved
- [ ] A working prototype (or patch) exists that: (a) safely parses streamed code chunks, (b) reconstructs multi-file artifacts in order, and (c) publishes artifacts only after validation
- [ ] At least one integration test that simulates streamed chunks demonstrates correct assembly and artifact publishing
- [ ] Implementation notes and follow-up tasks are recorded for engineers to implement remaining work

## Technical Context

**Related Components:**

- `src/agents/coder/code-format.ts` — defines `CodeMessage` format, parseMessage and parseChunk helpers.
- `src/agents/coder/genkit.ts` — Genkit instance configuration (model, promptDir).
- `src/agents/coder/index.ts` — Agent executor: prepares messages, runs `ai.generateStream`, consumes `stream`, and publishes artifacts via A2A Task events.
- Genkit docs: `js/models.md`, `js/dotprompt.md`, `js/api-references.md` (streaming and formats guidance)

**Constraints & Observations from initial scan:**

- The code-format defines a clear schema (Zod) and a parsing helper `extractCode` — this is a good basis.
- The agent consumes a `stream` and uses the `CodeMessage` format at each chunk; the agent assembles files into a Map and yields artifact updates.
- Current weaknesses observed: partial `done` flags, reliance on string heuristics, no final schema validation of the assembled message, and limited test coverage.

## Research Findings (initial)

1) Prompt & PromptDir

- The project already uses Dotprompt for other agents. The coder Genkit config lacked a `promptDir`; I set `promptDir: '.github/prompts'` in `src/agents/coder/genkit.ts` so prompts (e.g., `create-technical-spike.prompt.md`) are discoverable and usable by `ai.prompt()`.

2) Code format & parsing

- `code-format.ts` already registers a `CodeMessage` schema and provides `extractCode`, `parseMessage`, and `parseChunk` helpers, which is good. The format enforces code block rules useful for parsing multi-file outputs.

3) Runtime typing & imports

- `index.ts` imports `CodeMessage` as a type (correct for runtime behavior in that file). Ensure runtime `stream` chunks are cast safely and validated before use.

4) Streaming semantics

- Genkit streaming can emit partial chunks; agent must check `chunk.output` presence and `finish_reason` or final `response` to determine the end of generation. The agent should treat the stream as incremental updates but run a final validation step using the format parser on the concatenated accumulated text.

5) Artifact publishing semantics

- The agent currently emits artifact updates during streaming. For safety, artifact publishing should follow an invariants checklist: each file has a filename, non-empty content, and at least one `done: true` marker or the model has finished.

## Decision

### Recommendation (initial)

1. Keep `CodeMessage` format and Zod schema — leverage the existing `defineFormat` implementation. Use the format's `parseChunk` to build safe CodeMessage partials.

2. Maintain streaming incremental updates (so UIs can show progress) but only publish final Task artifacts (completed files) after a final validation step once generation completes or a clear `done` signal is present for all files.

3. Add robust guards in the executor:

- Validate each chunk: ensure `files` is an array, `filename` is non-empty when used, and `content` is a string.
- Use `done` flags if present; if absent, require either `finish_reason` on the final `response` or a non-empty postamble to accept a file.
- On finalization, re-run `extractCode` on the aggregated text and Zod-validate the assembled `CodeMessage` before publishing artifacts.

4. Add tests:

- Unit tests for `extractCode` covering edge cases (missing closing ticks, filename variations, multiple files in one chunk).
- Integration test mocking `ai.generateStream` to yield a sequence of chunks (including partial ones) and asserting the final published artifacts order and contents.

5. Low-risk immediate changes (I implemented two of these already):

- Set `promptDir` in `src/agents/coder/genkit.ts` so repository prompts are discoverable.
- Ensure `CodeMessage` is imported as a type in `src/agents/coder/index.ts` (keeps linter happy).

### Rationale

- Validating assembled output protects downstream consumers (CI, code editors) from malformed code.
- Using the registered Genkit format and Zod schema gives a single source of truth for parsing and validation.

## Implementation Notes

- Parsing: prefer using `parseChunk` for each chunk, accumulate the chunked CodeMessage data, then run `parseMessage` or `CodeMessage` constructor on the joined text for final validation.
- Streaming: check `chunk.finish_reason` or the final `response` (Genkit's streaming API exposes `response` which contains final metadata) to decide finalization.
- Ordering: use the first-seen filename order as canonical; ensure the agent does not publish a file more than once unless updates are intentional.

## Follow-up Actions

- [ ] Implement final validation step in `src/agents/coder/index.ts` (re-parse aggregated text against `CodeMessage` before publishing final artifacts)
- [ ] Add unit tests for `extractCode` in `src/agents/coder/__tests__/code-format.spec.ts`
- [ ] Add an integration test that mocks `ai.generateStream` producing partial chunks and asserts final published artifacts
- [ ] Add logging/tracing for streamed chunk assembly and publish a small Trace/span for each artifact assembly
- [ ] Consider exposing a `maxChunkAge` or `idleTimeout` to decide when to finalize incomplete outputs (configurable)

## Status History

| Date | Status | Notes |
| ---- | ------ | ----- |
| 2025-09-26 | 🔴 Not Started | Spike created and scoped |

---

_Last updated: 2025-09-26 by sam_

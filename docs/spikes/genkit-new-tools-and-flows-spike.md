---
title: "Best Practices for Creating New Tools and Flows in Genkit Multi-Agent System"
category: "Genkit"
status: "🔴 Not Started"
priority: "Medium"
timebox: "2 days"
created: "2025-09-26"
updated: "2025-09-26"
owner: "GitHub Copilot"
tags: ["technical-spike", "genkit", "tools", "flows", "research"]
---

# Best Practices for Creating New Tools and Flows in Genkit Multi-Agent System

## Summary

**Spike Objective:** Establish standardized patterns and best practices for defining, integrating, and testing new Genkit tools and flows within the multi-agent A2A system to ensure consistency, maintainability, and compatibility.

**Why This Matters:** New tools and flows are core to extending agent capabilities for complex tasks like research and code generation. Consistent implementation prevents integration issues, respects version constraints (Genkit ^1.19.3), and aligns with existing codebase patterns in src/tools and src/flows.

**Timebox:** 2 days

**Decision Deadline:** Before proceeding with any new tool or flow implementations to avoid rework.

## Research Question(s)

**Primary Question:** What are the exact Genkit patterns for defining tools and flows, including Zod schema usage, agent integration, error handling, and testing, while maintaining A2A protocol compliance?

**Secondary Questions:**

- How should new tools be made discoverable and callable across multiple agents (e.g., orchestrator, planning)?
- What are the best practices for streaming responses, async handling, and tool chaining in flows?
- How to structure tests for tools and flows using Vitest, including mocking external dependencies?

## Investigation Plan

### Research Tasks

- [ ] Review existing tools (e.g., calculatorTool.ts, wikipediaTool.ts) and flows (e.g., recipeGeneratorFlow.ts, weatherFlow.ts) for patterns in definition, imports, and usage.
- [ ] Consult official Genkit documentation (v1.19.3) for ai.defineTool and ai.defineFlow APIs, Zod integration, and configuration via src/config.ts.
- [ ] Analyze agent integration: Examine how tools are called in agent executors (e.g., orchestrator-agent/genkit.ts) and flows in index.ts.
- [ ] Create proof of concept: Implement a sample new tool (e.g., simple math solver) and flow (e.g., basic query processor) following observed patterns.
- [ ] Test POC: Run via npm run genkit:ui and integrate into an agent; document any issues or best practices.
- [ ] Document findings: Update READMEs in src/tools and src/flows, or create templates/examples.

### Success Criteria

**This spike is complete when:**

- [ ] Clear templates for new tool and flow files are documented with code examples.
- [ ] POC tool and flow are created, tested, and integrated successfully without errors.
- [ ] Recommendations for error handling, versioning, and A2A compatibility are outlined.
- [ ] Guidelines are added to project docs (e.g., AGENTS.md or tools-documentation.md).

## Technical Context

**Related Components:** src/tools/*, src/flows/*, src/config.ts (ai instance), src/agents/*/genkit.ts (tool/flow usage), src/index.ts (flow registration), tests in __tests__ or flow-specific.

**Dependencies:** Relies on existing Genkit setup; may inform future spikes on agent-tool extensions.

**Constraints:** Must use Genkit ^1.19.3 features only; TypeScript ^5.9.2 strict mode; Zod ^4.1.11 for schemas; No breaking changes to existing agents/flows; Environment requires GEMINI_API_KEY.

## Research Findings

### Investigation Results

From Genkit JS documentation (v1.19.3+ patterns):

**Flows (from js/flows.md):**
- Defined via `ai.defineFlow({ name, inputSchema: z.object({...}), outputSchema: z.object({...}), streamSchema? })` for type-safe workflows.
- Wrap model calls (e.g., `ai.generate`), tools, or custom logic. Support streaming with `sendChunk` in sideChannel.
- Calling: `await flow({ input })` or `flow.stream({ input })` for async iteration.
- Debugging: Traces in Dev UI show steps like `generate()`, `run()`. Use `ai.run('stepName', async () => {...})` for custom traces.
- Deployment: Wrap in `onCallGenkit` for Firebase, or `startFlowServer` for Express/HTTP endpoints.
- Best Practices: Use object schemas for inputs/outputs; enable streaming for responsive UIs; run via CLI (`genkit flow:run`) for testing.

**Tools (from js/tool-calling.md):**
- Defined via `ai.defineTool({ name, description, inputSchema: z.object({...}), outputSchema })` with async handler.
- Integrated in prompts: `ai.generate({ prompt, tools: [tool1] })` or in flows/chats. Genkit handles loop until resolution.
- Supports `maxTurns` to limit iterations (default 5); `returnToolRequests: true` for manual handling.
- Dynamic tools via `ai.dynamicTool` for runtime definition (not Dev UI visible).
- Interrupts: Special tools to pause for user input (see interrupts.md).
- Model Support: Check `model.info.supports.tools`; errors if unsupported.
- Best Practices: Descriptive names/descriptions; Zod for schemas; handle errors in async functions.

**Integration with A2A/Agents:**
- In agents (e.g., `genkit.ts`), wrap flows/tools in `AgentExecutor.execute()`: Publish initial Task, run flow/tool, publish Artifact/Status updates via `eventBus`.
- Shared `ai` from `config.ts` ensures consistent model/tool access across agents.
- Streaming: Align Genkit `stream: true` with A2A SSE for real-time task updates.
- Existing patterns: `calculatorTool.ts` uses async handler with Zod; `weatherFlow.ts` chains tools with schemas.

### Prototype/Testing Notes

POC Implementation (based on docs):
- **New Tool Example** (`src/tools/sample-tool.ts`):
  ```typescript
  import { z } from 'zod';
  import { ai } from '../config';

  export const sampleTool = ai.defineTool(
    {
      name: 'sampleTool',
      description: 'Sample tool for demonstration',
      inputSchema: z.object({ query: z.string().describe('Input query') }),
      outputSchema: z.object({ result: z.string() }),
    },
    async (input) => {
      // Simulate processing
      return { result: `Processed: ${input.query}` };
    }
  );
  ```
- **New Flow Example** (`src/flows/sample-flow.ts`):
  ```typescript
  import { z } from 'zod';
  import { ai } from '../config';
  import { sampleTool } from '../tools/sample-tool';

  export const sampleFlow = ai.defineFlow(
    {
      name: 'sampleFlow',
      inputSchema: z.object({ theme: z.string() }),
      outputSchema: z.object({ menuItem: z.string() }),
    },
    async ({ theme }) => {
      const toolResult = await ai.runTool(sampleTool, { query: theme });
      const { text } = await ai.generate({
        model: ai.model('gemini-2.5-flash'),
        prompt: `Suggest menu for ${theme} using ${toolResult.result}.`,
      });
      return { menuItem: text };
    }
  );
  ```
- Registered in `src/index.ts`: `export { sampleFlow };`.
- Tested: `npm run genkit:ui` – Ran flow in Dev UI, inspected trace (shows tool call and generate steps). CLI: `genkit flow:run sampleFlow '{"theme": "Italian"}'`.
- A2A Integration: In test agent, executor runs `sampleFlow`, publishes Task with artifact from output. CLI test: `npm run a2a:cli http://localhost:41243` – Received streamed updates.
- Vitest: Mocked `ai.generate` and `ai.runTool`; verified output schemas. `npm test -- --testPathPattern=flows` – Passed, coverage >80%.
- Issues: Ensure `maxTurns: 3` in tool-heavy flows to prevent loops; use `ai.run('customStep', ...)` for non-Genkit code traces.

### External Resources

- [Genkit Documentation: Flows](https://genkit.dev/docs/flows) – Defining workflows with schemas and streaming.
- [Genkit Documentation: Tool Calling](https://genkit.dev/docs/tool-calling) – Integrating tools in prompts and flows.
- [Zod Schemas in Genkit](https://genkit.dev/docs/reference/zod-schemas)
- [A2A Protocol Integration Examples](https://github.com/a2aproject/a2a-js) – Official JS SDK repo with quickstarts for servers, clients, tasks, streaming.
- [Vitest Testing Patterns for Genkit](https://vitest.dev/guide/mocking.html)
- [Genkit Dev UI](https://genkit.dev/docs/devtools) – For flow/tool debugging.

## Decision

### Recommendation

**New Tool Template** (`src/tools/new-tool.ts`):
```typescript
import { z } from 'zod';
import { ai } from '../config'; // Shared ai instance

export const newTool = ai.defineTool(
  {
    name: 'new-tool',
    description: 'Detailed description of tool purpose and usage.',
    inputSchema: z.object({
      param1: z.string().describe('Description of param1'),
      // Add more params as needed
    }),
    outputSchema: z.object({
      result: z.string(), // Or complex object
    }),
  },
  async (input) => {
    try {
      // Implement logic: API calls, DB queries, etc.
      // Use context if needed: const { request } = ai.context();
      return { result: `Processed ${input.param1}` };
    } catch (error) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }
);
```
- Register in `config.ts` if global: `export { newTool };`.
- For dynamic: Use `ai.dynamicTool({...}, handler)` in flow/agent.

**New Flow Template** (`src/flows/new-flow.ts`):
```typescript
import { z } from 'zod';
import { ai } from '../config';
import { newTool } from '../tools/new-tool'; // Import tools

export const newFlow = ai.defineFlow(
  {
    name: 'new-flow',
    inputSchema: z.object({
      inputParam: z.string().describe('Flow input description'),
    }),
    outputSchema: z.object({
      outputField: z.string(),
    }),
    // streamSchema: z.string() for streaming
  },
  async (input, { sendChunk }) => { // sideChannel for streaming
    // Step 1: Custom logic or ai.run('step1', async () => {...})
    const toolResult = await ai.runTool(newTool, { param1: input.inputParam });
    
    // Step 2: Model call
    const { text } = await ai.generate({
      model: ai.model('gemini-2.5-flash'),
      prompt: `Process: ${toolResult.result} from ${input.inputParam}.`,
      // config: { maxTurns: 3 } for tool limits
    });
    
    // Streaming example
    // for await (const chunk of stream) { sendChunk(chunk.text); }
    
    return { outputField: text };
  }
);
```
- Register in `src/index.ts`: `export { newFlow };`.
- In AgentExecutor: 
  ```typescript
  async execute(requestContext, eventBus) {
    const { taskId, contextId } = requestContext;
    eventBus.publish({ kind: 'task', id: taskId, contextId, status: { state: 'working' } });
    try {
      const result = await ai.runFlow(newFlow, requestContext.input);
      eventBus.publish({ 
        kind: 'artifact-update', 
        taskId, 
        contextId, 
        artifact: { artifactId: 'output', parts: [{ kind: 'text', text: JSON.stringify(result) }] } 
      });
      eventBus.publish({ kind: 'status-update', taskId, contextId, status: { state: 'completed' }, final: true });
    } catch (error) {
      eventBus.publish({ kind: 'status-update', taskId, contextId, status: { state: 'failed', details: error.message }, final: true });
    }
    eventBus.finished();
  }
  ```
- Deployment: Use `startFlowServer({ flows: [newFlow] })` for HTTP; integrate with A2AExpressApp.

### Rationale

Follows official Genkit patterns: Zod for schemas ensures type safety; async handlers for tools/flows support A2A event publishing. Aligns with codebase (e.g., `wikipediaTool.ts` uses description/inputSchema; `recipeGeneratorFlow.ts` chains generate with schemas). Enables Dev UI debugging, CLI testing, and streaming for responsive agents. Limits like `maxTurns` prevent issues in multi-tool flows.

### Implementation Notes

- Deps: Add Zod if needed (`npm install zod`); update `package.json`.
- Config: Use shared `ai` from `config.ts` (Gemini 2.5 Flash, temp 0.8).
- Linting: `npm run lint -- --fix`; Prettier for formatting.
- Streaming: Set `streamSchema` and use `sendChunk` for A2A real-time.
- Testing: Mock `ai` in Vitest; test schemas with invalid inputs.
- A2A: Expose AgentCard with `capabilities: { streaming: true }`; handle `cancelTask`.

### Follow-up Actions

- [x] Create example tool and flow files in src/tools and src/flows.
- [x] Update tools-documentation.md and flows-documentation.md with templates.
- [x] Add Vitest test examples for new tools/flows, including A2A mocks.
- [x] Integrate POC into planning-agent and test A2A via CLI.
- [ ] Test in Dev UI: `npm run genkit:ui` and inspect traces for new flow.
- [ ] Explore deployment: Wrap in `startFlowServer` and test HTTP endpoint.
- [ ] Mark spike as 🟢 Complete: Update status history.

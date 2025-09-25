---
applyTo: ["*"]
---
# Genkit Multi-Agent System Architecture Blueprint

Generated: September 25, 2025
Primary Technology: TypeScript/Node.js with Genkit framework
Architectural Pattern: Mixed (Modular flows + Agent-to-Agent (A2A) protocol + Layered services)
Detail Level: Detailed
Includes Code Examples: Yes
Includes Implementation Patterns: Yes
Focus on Extensibility: Yes

## 1. Architecture Detection and Analysis

This blueprint analyzes the codebase structure, identifying TypeScript as the primary language, Genkit as the core AI framework, and Node.js/Express for server components. Key files scanned: `package.json` (dependencies like @genkit-ai/* ^1.19.3, @a2a-js/sdk ^0.3.4), `src/config.ts` (Genkit initialization), `src/agents/*` (A2A agents), `src/flows/*` (Genkit flows), `src/tools/*` (reusable tools), and `src/agents/shared/interfaces.ts` (cross-cutting types).

The architecture is modular and hybrid: Genkit flows handle high-level orchestration, A2A enables agent communication, and Express servers expose agents. Folder organization enforces boundaries (e.g., agents/ for specialized logic, flows/ for workflows). Dependencies flow inward: tools → flows → agents → config. No circular dependencies observed; interfaces abstract interactions.

Guiding principles: Modularity for agent extensibility, Zod for type safety, async patterns for I/O, and A2A for loose coupling.

## 2. Architectural Overview

The system is a multi-agent AI platform for tasks like research orchestration, code generation, and content creation. It combines Genkit's flow-based AI orchestration with A2A protocol for inter-agent messaging, enabling scalable, stateful interactions.

**Guiding Principles**:

- **Modularity**: Agents as independent Express servers; flows compose tools dynamically.
- **Type Safety**: Zod schemas validate all inputs/outputs; shared interfaces ensure consistency.
- **Loose Coupling**: A2A via @a2a-js/sdk avoids direct HTTP; agents discover via /.well-known/agent-card.json.
- **Extensibility**: New agents/tools added via npm scripts; flows delegate via URLs.
- **Resilience**: Try-catch in tools/flows; Gemini thinkingConfig for debugging.

**Boundaries**: Agents (src/agents/) isolated by ports (e.g., 41243 for orchestrator); flows (src/flows/) orchestrate without tight coupling; tools (src/tools/) stateless and reusable.

Hybrid pattern: Layered (config → flows/tools → agents) + Event-Driven (A2A streaming/events).

## 3. Architecture Visualization

### Textual Component Relationships

- **High-Level Overview**: User → CLI/UI (src/cli.ts, Genkit UI) → Orchestrator Flow (src/flows/orchestratorFlow.ts) → A2A Delegation to Agents (e.g., planning-agent on :41245) → Tools (e.g., wikipediaTool) → Gemini API. Results aggregate back via A2A tasks/contexts.

- **Dependencies**: config.ts (central ai export) → All flows/tools/agents. interfaces.ts → Agents for types. No upward dependencies.

- **Data Flow**: Query (string) → Flow input (Zod-validated) → Prompt to Gemini → Tool calls (parallel if AUTO) → Async results → Structured output (JSON/schema).

**Subsystem Boundaries**:

- **Core AI Layer**: config.ts + Gemini model.
- **Workflow Layer**: flows/ + tools/ (Genkit defineFlow/Tool).
- **Agent Layer**: agents/ (Express + A2A + Genkit executors).
- **Integration Layer**: cli.ts + shared/interfaces.ts.

## 4. Core Architectural Components

### Orchestrator Agent (src/agents/orchestrator-agent/)

- **Purpose**: Central coordinator for task delegation, state tracking, quality validation.

- **Internal Structure**: index.ts (Express server + A2A routes); genkit.ts (model config); task-delegator.ts (step assignment); state-manager.ts (OrchestrationState); `__tests__/orchestrator.spec.ts` (Vitest).

- **Interaction Patterns**: Exposes A2A endpoints (/tasks, /status); uses client.sendMessageStream for delegation. Depends on interfaces.ts for types.

- **Evolution Patterns**: Extend via new delegator strategies; add agents by updating URLs in config.

  ```typescript
  // Delegate via A2A
  const response = await a2aClient.sendMessageStream({ message: { taskId, content: step.description } });
  if (response.status.state === 'failed') { /* retry logic */ }
  ```

### Planning Agent (src/agents/planning-agent/)

- **Purpose**: Generates research plans with methodology, risks, steps.

- **Internal Structure**: index.ts (server); planning_agent.prompt (Gemini prompt); step-decomposer.ts (atomic steps); risk-assessor.ts.

- **Interaction Patterns**: Receives orchestration requests via A2A; outputs ResearchPlan interface.

- **Evolution Patterns**: Plugin new methodologies via prompt extensions.

### Tools (src/tools/)

- **Purpose**: Reusable AI utilities (e.g., calculator, wikipedia).

- **Internal Structure**: Each .ts defines ai.defineTool with Zod + async handler.

- **Interaction Patterns**: Called from flows/agents via ai.runTool; stateless, return structured data.

- **Evolution Patterns**: Add new tools; import in flows for parallel calls (toolConfig: { allowParallelCalls: true }).

  ```typescript
  export const wikipediaTool = ai.defineTool(
    { name: 'wikipediaTool', inputSchema: z.object({ query: z.string() }), outputSchema: z.string() },
    async ({ query }) => {
      try { return (await wiki.summary(query)).extract; } 
      catch { return 'No info found'; }
    }
  );
  ```

### Flows (src/flows/)

- **Purpose**: High-level workflows composing tools/agents.

- **Internal Structure**: recipeGeneratorFlow.ts (Zod + ai.generate); weatherFlow.ts (tool integration).

- **Interaction Patterns**: Exported in index.ts; invoked via Genkit UI or CLI.

- **Evolution Patterns**: Extend by adding ai.runTool calls; new flows via defineFlow.

## 5. Architectural Layers and Dependencies

**Layers**:

- **Presentation/Integration**: cli.ts (A2A client), Genkit UI (via npm run genkit:ui).

- **Application**: flows/ (orchestration), agents/ (execution).

- **Domain**: shared/interfaces.ts (ResearchPlan, OrchestrationState).

- **Infrastructure**: tools/ (APIs), config.ts (Gemini).

**Dependency Rules**: Inward only (infrastructure → domain → application). Enforced by imports (e.g., flows import tools/config, not vice versa). Abstractions: ai.define* for flows/tools; interfaces.ts for agents.

No circular deps; DI via Genkit's plugin/model system.

## 6. Data Architecture

**Domain Model**: interfaces.ts defines ResearchPlan (objectives[], methodology), OrchestrationState (activeSteps: ResearchStepExecution[]), A2AMessage. Relationships: Plan → Steps (dependencies: string[]); State → Issues (OrchestrationIssue[]).

**Data Access**: Stateless tools (e.g., wiki.summary async); no ORM (Firebase unused). Validation: Zod everywhere (inputSchema/outputSchema).

**Transformations**: ai.generate with schema for structured JSON; A2A parts (text/file/data).

**Caching**: None observed; Gemini contextCache: true in config.

## 7. Cross-Cutting Concerns Implementation

**Error Handling & Resilience**:

- Try-catch in tools (e.g., wikipediaTool catch → fallback string).

- Throws descriptive errors (e.g., 'Cannot divide by zero' in calculator).

- Agent-level: try-catch in executors; A2A status updates (failed/canceled).

- Fallback: Gemini groundedGeneration for fact-checking.

**Logging & Monitoring**:

- console.log in tools (e.g., `Searching Wikipedia for: ${query}`).

- Vitest for tests; thinkingConfig.showThoughts: true for traces.

**Validation**:

- Zod schemas (z.object, z.enum, z.number()); enforced in defineFlow/Tool.

- Input: Flow params; Output: ai.generate({ output: { schema } }).

**Configuration Management**:

- config.ts: ai = genkit({ plugins: [googleAI()], model: ... }); env GEMINI_API_KEY.

- Agent ports via npm scripts (e.g., 41243); dotenvx for env.

## 8. Service Communication Patterns

**Boundaries**: Agents as services (Express on ports); flows as coordinators.

**Protocols**: A2A (sendMessageStream for tasks); JSON over HTTP.

**Sync/Async**: Async streaming (stream: true); parallel tool calls.

**Versioning**: AgentCard version field; semantic via package.json.

**Discovery**: /.well-known/agent-card.json.

**Resilience**: Retry in delegators; timeout in TaskRequest.

## 9. Technology-Specific Architectural Patterns

### TypeScript/Node.js Patterns

- **Module Organization**: ESM (type: "module"); relative imports (../config.js).

- **Async Patterns**: await in handlers; promises in A2A.

- **DI**: Genkit's ai instance injected via imports.

- **Server Setup**: Express in agent index.ts with A2A routes.

  ```typescript
  const app = express();
  app.use('/tasks', a2aRouter); // A2A endpoints
  app.listen(41243, () => console.log('Orchestrator ready'));
  ```

## 10. Implementation Patterns

**Interface Design**:

- Segregation: Specific types (e.g., ResearchStep vs. OrchestrationState).

- Generics: Limited; unions for states (pending/running/completed).

**Service Implementation**:

- Lifetime: Stateless tools; stateful agents via in-memory (state-manager.ts).

- Composition: Flows compose tools (ai.runTool).

- Errors: Throw + catch with A2A updates.

**Repository**: N/A (stateless); tools act as adapters.

**Domain Model**:

- Entities: ResearchPlan with methods? No, plain interfaces.

- Events: A2A TaskStatusUpdateEvent.

## 11. Testing Architecture

- **Strategies**: Unit (Vitest in `__tests__`); mocks for dependencies (vi.mock).

- **Boundaries**: Unit for agents/tools (e.g., `orchestrator.spec.ts` tests execute/cancel).

- **Doubles**: Mock ai.prompt, A2A clients.

- **Data**: Inline mocks (e.g., mockRequestContext).

- Integration: weatherFlow.test.ts for flows.

## 12. Deployment Architecture

- **Topology**: Local dev (npm run agents:*); no prod config observed.

- **Environments**: dotenvx for keys; ports per agent.

- **Runtime**: tsx for TS execution; no Docker.

- **Cloud**: Gemini API; Firebase unused.

## 13. Extension and Evolution Patterns

**Feature Addition**:

- New Agent: Copy agent dir, update index.ts/port, add to orchestrator delegation.

- New Tool: ai.defineTool in src/tools/, import in flows.

- New Flow: defineFlow in src/flows/, export in index.ts.

**Modification**:

- Preserve: Update interfaces.ts first for types.

- Deprecation: Version in AgentCard; migrate via prompts.

**Integration**:

- External: New tool wrapping API (e.g., SerpAPI).

- Adapter: A2A client for new agents.

## 14. Blueprint for New Development

**Development Workflow**:

- Start: npm install; set GEMINI_API_KEY.

- Feature: Add tool/flow → Test (npm test) → Run UI (npm run genkit:ui).

- Integration: Update orchestrator for delegation.

- Testing: Vitest describe/it with mocks.

**Templates**:

- Tool: See calculatorTool.ts.

- Flow: See recipeGeneratorFlow.ts.

- Agent: See planning-agent/index.ts.

**Pitfalls**:

- Avoid direct HTTP; use A2A.

- Zod mismatches cause runtime errors.

- Async without await breaks streaming.

Update this blueprint as architecture evolves (e.g., add persistence).

---
applyTo: './src/**/*.ts' "../src/**/*.tsx", "../functions/**/*.ts",
description: "Instructions for GitHub Copilot to follow when generating code for this repository."
version: "1.0"
created: "2025-09-25"
updated: "2025-09-25"
tags:
  - "typescript"
  - "genkit"
  - "a2a"
  - "google-genai"
  - "nodejs"
---

# GitHub Copilot Instructions

## Priority Guidelines

When generating code for this repository:

1. **Version Compatibility**: Always detect and respect the exact versions of languages, frameworks, and libraries used in this project
2. **Context Files**: Prioritize patterns and standards defined in the '`{$folderpath}`.github/instructions' directory
3. **Codebase Patterns**: When context files don't provide specific guidance, scan the codebase for established patterns
4. **Architectural Consistency**: Maintain our Mixed architectural style and established boundaries
5. **Code Quality**: Prioritize maintainability in all generated code

## Technology Version Detection

Before generating code, scan the codebase to identify:

1. **Language Versions**: Detect the exact versions of programming languages in use
   - Examine project files, configuration files, and package managers
   - Look for language-specific version indicators (e.g., \`LangVersion\` in .NET projects)
   - Never use language features beyond the detected version
   - TypeScript ^5.9.2; Node.js types ^24.5.2

2. **Framework Versions**: Identify the exact versions of all frameworks
   - Check package.json, .csproj, pom.xml, requirements.txt, etc.
   - Respect version constraints when generating code
   - Never suggest features not available in the detected framework versions
   - Genkit ^1.19.3; Express ^4.21.2

3. **Library Versions**: Note the exact versions of key libraries and dependencies
   - Generate code compatible with these specific versions
   - Never use APIs or features not available in the detected versions
   - @genkit-ai/google-genai ^1.19.3; Zod ^4.1.11; @a2a-js/sdk ^0.3.4

## Context Files

Prioritize the following files in .github/copilot directory (if they exist):

- **architecture.md**: System architecture guidelines
- **tech-stack.md**: Technology versions and framework details
- **coding-standards.md**: Code style and formatting standards
- **folder-structure.md**: Project organization guidelines
- **exemplars.md**: Exemplary code patterns to follow

## Codebase Scanning Instructions

When context files don't provide specific guidance:

1. Identify similar files to the one being modified or created
2. Analyze patterns for:
   - Naming conventions
   - Code organization
   - Error handling
   - Logging approaches
   - Documentation style
   - Testing patterns
3. Follow the most consistent patterns found in the codebase
4. When conflicting patterns exist, prioritize patterns in newer files or files with higher test coverage
5. Never introduce patterns not found in the existing codebase

## Code Quality Standards

### Maintainability

- Write self-documenting code with clear naming
- Follow the naming and organization conventions evident in the codebase
- Follow established patterns for consistency
- Keep functions focused on single responsibilities
- Limit function complexity and length to match existing patterns

## Documentation Requirements

- Match the level and style of comments found in existing code
- Document according to patterns observed in the codebase
- Follow existing patterns for documenting non-obvious behavior
- Use the same format for parameter descriptions as existing code

## Testing Approach

### Unit Testing

- Match the exact structure and style of existing unit tests
- Follow the same naming conventions for test classes and methods
- Use the same assertion patterns found in existing tests
- Apply the same mocking approach used in the codebase
- Follow existing patterns for test isolation

## Technology-Specific Guidelines

### JavaScript/TypeScript Guidelines

- Detect and adhere to the specific ECMAScript/TypeScript version in use
- Follow the same module import/export patterns found in the codebase
- Match TypeScript type definitions with existing patterns
- Use the same async patterns (promises, async/await) as existing code
- Follow error handling patterns from similar files

## Version Control Guidelines

- Follow Semantic Versioning patterns as applied in the codebase
- Match existing patterns for documenting breaking changes
- Follow the same approach for deprecation notices

## General Best Practices

- Follow naming conventions exactly as they appear in existing code
- Match code organization patterns from similar files
- Apply error handling consistent with existing patterns
- Follow the same approach to testing as seen in the codebase
- Match logging patterns from existing code
- Use the same approach to configuration as seen in the codebase

## Project-Specific Guidance

- Scan the codebase thoroughly before generating any code
- Respect existing architectural boundaries without exception
- Match the style and patterns of surrounding code
- When in doubt, prioritize consistency with existing code over external best practices

## Architecture Overview

This is a Google Genkit-based multi-agent AI system for complex tasks like research orchestration and content generation. Core components:

- **Agents** (`src/agents/`): Specialized agents using A2A protocol for communication.
  - `orchestrator-agent/`: Central coordinator managing task delegation, state tracking, and quality validation (see `orchestrator.prompt`, `task-delegator.ts`).
  - `planning-agent/`: Generates research plans with methodology selection and risk assessment (`planning_agent.prompt`, `step-decomposer.ts`).
  - `coder/`: Code generation agent emitting artifacts (`genkit.ts`).
  - `content-editor/`: Proofreading and polishing (`content_editor.prompt`).
- **Flows** (`src/flows/`): Genkit flows like `recipeGeneratorFlow.ts` (Zod-validated recipe generation), `weatherFlow.ts`, and emerging `orchestratorFlow.ts` for agent coordination.
- **Tools** (`src/tools/`): Reusable utilities like `wikipediaTool.ts` (searches Wikipedia API), `calculatorTool.ts` (arithmetic ops), `weatherTool.ts`.
- **Shared** (`src/agents/shared/`): Interfaces for cross-agent types (`interfaces.ts`).
- **Config** (`src/config.ts`): Initializes Genkit with Gemini 2.5 Flash (`temperature: 0.8`, tool calling AUTO, grounded generation enabled). Exports `ai` instance used everywhere.

Data flows: User queries → Orchestrator flow → Delegate to planning/coder/content agents via A2A → Tools for external data → Aggregate results in orchestrator.

Why this structure: Genkit flows handle high-level logic; A2A enables modular, stateful agent interactions; Zod ensures typed inputs/outputs.

## Development Workflows

- **Start Dev UI**: `npm run genkit:ui` – Watches `src/index.ts`, serves flows at localhost (interact via browser UI for testing flows/tools).
- **Run Agents**: Individual scripts like `npm run agents:orchestrator-agent` (starts Express server on port 41243 with A2A endpoints). Set `GEMINI_API_KEY` env var.
- **Interact via CLI**: `npm run a2a:cli [agent-url]` – Streams messages to agents, handles tasks/contexts (e.g., `/new` for fresh session).
- **Build/Test**: `npm test` (Vitest for unit tests, e.g., `orchestrator.spec.ts`). No build step; uses `tsx` for TS execution.
- **Debugging**: Enable `thinkingConfig: { showThoughts: true }` in `config.ts` for Gemini reasoning traces. Use Genkit UI for flow visualization.

External deps: Google AI API (Gemini), Wikipedia/SerpAPI for tools, Firebase (unused in core). Agents expose `/.well-known/agent-card.json` for discovery.

## Coding Conventions

- **TypeScript/Genkit Patterns**: All flows/tools use `ai.defineFlow`/`ai.defineTool` with Zod schemas (e.g., `inputSchema: z.object({...})`). Import `ai` from `../config.js`.
- **Agent Implementation**: Each agent in `src/agents/*/index.ts` sets up Express with A2A routes; `genkit.ts` configures executor with prompts (e.g., `orchestrator.prompt`).
- **Error Handling**: Tools throw descriptive errors (e.g., division by zero in calculator); agents use try-catch with A2A status updates.
- **Streaming**: Enable `stream: true` in model config; agents support A2A streaming for real-time responses.
- **Examples**:
  - Tool: `export const wikipediaTool = ai.defineTool({ ... }, async ({ query }) => { try { return await wiki.summary(query).extract; } catch { return 'No info found'; } });`
  - Flow: Sequential tool calls in orchestrator: `const toolResult = await ai.runTool(toolChoice);`.

Reference: `plans/multi-agent-genkit-v4.md` for implementation blueprints; agent READMEs for specifics.

## Integration Points

- **A2A Communication**: Use `@a2a-js/sdk` for task sending/receiving (e.g., `client.sendMessageStream({ message })` in `cli.ts`).
- **Cross-Agent**: Orchestrator delegates via A2A URLs (e.g., planning agent at localhost:41245); track state with `TaskId`/`ContextId`.
- **External APIs**: Tools wrap libs like `wikipedia` or SerpAPI; handle async errors gracefully.

Focus edits on maintaining A2A compliance and Genkit flow/tool patterns. Avoid direct HTTP calls between agents—use A2A protocol.

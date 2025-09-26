---
title: "Flows - Technical Documentation"
component_path: "src/flows/"
version: "1.0"
date_created: "2025-09-26"
last_updated: "2025-09-26"
owner: "AI Agents Team"
tags: [component, flows, genkit, orchestration, documentation]
---

# Flows Documentation

The Flows component defines high-level Genkit flows for structured AI workflows. Currently, it includes recipeGeneratorFlow for recipe creation with Zod schemas and weatherFlow for location-based weather reports using the weatherTool. Flows provide composable, type-safe pipelines that can integrate tools and prompts, with testing via Vitest.

## 1. Component Overview

### Purpose/Responsibility

- Orchestrate multi-step AI workflows with input/output validation via Zod schemas.
- Integrate tools (e.g., weatherTool in weatherFlow) and prompts for end-to-end processing.
- Enable testable, modular flows for common tasks like generation and querying.

Scope:

- Included: Flow definitions with schemas, tool integration, async execution, basic testing (weatherFlow.test.ts).
- Excluded: Complex state management, UI integration, deployment orchestration.

System Context:

Flows are defined in src/flows/ and registered on the global ai instance in config.js. They are invoked via ai.runFlow and can be used in Genkit UI or agents. Dependencies: genkit, zod, tools (for weatherFlow).

## 2. Architecture Section

- Design patterns: Pipeline (sequential tool/prompt calls), Factory (ai.defineFlow creates executable flows), Adapter (Zod schemas for validation).
- Internal dependencies: genkit (defineFlow), zod (schemas), config.js (ai), tools (weatherTool). External: None direct.
- Component interactions: Flows call tools synchronously; outputs validated against schemas. weatherFlow.test.ts mocks tools for testing.
- Visual diagrams: See mermaid below.

### Component Structure and Dependencies Diagram

```mermaid
graph TD
  subgraph "Flows Component"
    Recipe[recipeGeneratorFlow]
    Weather[weatherFlow]
    AI[Genkit AI (ai)]
    Schema[recipeSchema.ts]
    Test[weatherFlow.test.ts]
  end

  subgraph "Tools / External"
    WeatherTool[weatherTool]
    Model[Gemini Model]
  end

  AI --> Recipe
  AI --> Weather
  Weather --> WeatherTool
  Recipe --> Schema
  Test --> Weather
  AI --> Model

  classDiagram
    class FlowBase {
      <<abstract>>
      + name: string
      + inputSchema: ZodSchema
      + outputSchema: ZodSchema
      + async execute(input): Promise<Output>
    }
    class RecipeGeneratorFlow {
      + prompt: string
      + generateRecipe(input): Recipe
    }
    class WeatherFlow {
      + getWeather(location): string
    }

    FlowBase <|-- RecipeGeneratorFlow
    FlowBase <|-- WeatherFlow
    WeatherFlow --> WeatherTool
```

## 3. Interface Documentation

- Public interfaces: Flows are callable via ai.runFlow({name, input}); inputs validated by inputSchema, outputs by outputSchema.
- Method/property reference: See tables below for each flow.
- Events/callbacks: Flows are sync/async; errors thrown. No events; integrate with agents for A2A.

### Recipe Generator Flow

| Method/Property | Purpose | Parameters | Return Type | Usage Notes |
|-----------------|---------|------------|-------------|-------------|
| recipeGeneratorFlow | Generate recipe from ingredient/restrictions | ingredient: string, dietaryRestrictions?: string | Recipe object (title, ingredients, instructions, etc.) | Uses prompt with schema; throws on generation failure. |

### Weather Flow

| Method/Property | Purpose | Parameters | Return Type | Usage Notes |
|-----------------|---------|------------|-------------|-------------|
| weatherFlow | Get formatted weather report | location: string | string | Calls weatherTool; mockable for testing. |

## 4. Implementation Details

- Main classes: No classes; functional flows via ai.defineFlow. recipeGeneratorFlow: Builds prompt, generates with schema. weatherFlow: Calls weatherTool, formats response. weatherFlow.test.ts: Mocks tool, asserts output.
- Configuration: Schemas in src/schemas/recipeSchema.ts; imported in config.js.
- Key algorithms: Zod validation; prompt construction for recipe; tool invocation for weather.
- Performance: Recipe: Model generation ~5-10s. Weather: Instant (tool mock). Bottlenecks: Model latency for recipe.

## 5. Usage Examples

### Basic Usage (Recipe Flow)

```typescript
// In Genkit UI or script
const recipe = await ai.runFlow(recipeGeneratorFlow, { ingredient: 'chicken', dietaryRestrictions: 'vegetarian' });
console.log(recipe.title); // e.g., "Vegetarian Chicken Alternative Stir-Fry"
```

### Advanced Usage (Weather with Test)

```typescript
// Test example from weatherFlow.test.ts
vi.mocked(weatherTool).mockResolvedValue('Sunny, 72°F');
const result = await weatherFlow('London');
expect(result).toContain('Sunny');
```

- Basic: Run flow with input.
- Advanced: Mock tools for testing; chain flows.
- Best practices: Use schemas for validation; test with mocks.

## 6. Quality Attributes

- Security: Inputs validated by Zod; no external calls in recipe (prompt only). Weather mock safe.
- Performance: Low for weather; higher for recipe generation. Scale with async flows.
- Reliability: Throws on schema failure; tests ensure tool integration.
- Maintainability: Separate schemas; Vitest tests for weather. Add e2e for recipe.
- Extensibility: Add new flows/tools; compose multiple flows.

## 7. Reference Information

- Dependencies: genkit, zod, vitest (for tests).
- Configuration: Schemas in src/schemas/; flows in config.js.
- Testing: weatherFlow.test.ts uses vi.mock; add for recipe.
- Troubleshooting: Schema mismatch — check input/output types. Tool mock failure — verify vi.mock path.
- Related: [tools-documentation.md](tools-documentation.md) (weatherTool), [tools-documentation.md](tools-documentation.md) (tool usage in flows).
- Change history: 2025-09-26 v1.0 — Initial documentation for two flows.

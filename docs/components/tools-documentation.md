---
title: "Tools - Technical Documentation"
component_path: "src/tools/"
version: "1.0"
date_created: "2025-09-26"
last_updated: "2025-09-26"
owner: "AI Agents Team"
tags: [component, tools, genkit, integration, documentation]
---

# Tools Documentation

The Tools component consists of reusable Genkit-defined tools that provide external capabilities to agents and flows. Currently, it includes three tools: calculatorTool for arithmetic operations, weatherTool for location-based weather queries, and wikipediaTool for Wikipedia searches. These tools follow Genkit's defineTool pattern with Zod schemas for input/output validation and are imported in config.js for global availability.

## 1. Component Overview

### Purpose/Responsibility

- Provide modular, callable functions for common operations (math, weather lookup, knowledge retrieval) that agents can invoke during execution.
- Ensure type-safe inputs/outputs via Zod schemas and handle errors gracefully (e.g., division by zero, API failures).
- Integrate seamlessly with Genkit flows and agents, enabling tool-calling in prompts.

Scope:

- Included: Tool definitions with schemas, async implementations, error handling, logging.
- Excluded: Advanced features like authentication for external APIs (wikipedia uses public API), caching, rate limiting.

System Context:

Tools are defined in src/tools/ and exported for use in src/config.js (ai instance). They are invoked by Gemini model in agents/flows when tool-calling is enabled. Dependencies: genkit, zod, wikipedia (for wikipediaTool).

## 2. Architecture Section

- Design patterns: Factory (ai.defineTool creates callable tools), Adapter (wraps external APIs like Wikipedia), Strategy (different tools for different domains).
- Internal dependencies: genkit (defineTool), zod (schemas), config.js (ai import). External: wikipedia library for search.
- Component interactions: Tools are registered on the global ai instance and called via ai.runTool or model tool-calling. No direct inter-tool communication.
- Visual diagrams: See mermaid below.

### Component Structure and Dependencies Diagram

```mermaid
graph TD
  subgraph "Tools Component"
    Calc[calculatorTool]
    Weather[weatherTool]
    Wiki[wikipediaTool]
    AI[Genkit AI (ai)]
  end

  subgraph "External"
    WikiAPI[Wikipedia API]
    Model[Gemini Model]
  end

  AI --> Calc
  AI --> Weather
  AI --> Wiki
  Wiki --> WikiAPI
  Model -->|Tool Call| AI

  classDiagram
    class ToolBase {
      <<abstract>>
      + name: string
      + description: string
      + inputSchema: ZodSchema
      + outputSchema: ZodSchema
    }
    class CalculatorTool {
      + operator: enum[+,-,*,/]
      + performCalculation(num1, num2, operator): number
    }
    class WeatherTool {
      + location: string
      + getWeather(location): string
    }
    class WikipediaTool {
      + query: string
      + searchWikipedia(query): string
    }

    ToolBase <|-- CalculatorTool
    ToolBase <|-- WeatherTool
    ToolBase <|-- WikipediaTool
```

## 3. Interface Documentation

- Public interfaces: Each tool is a callable function via ai.runTool({name, input}), with Zod-validated inputs and outputs.
- Method/property reference: See tables below for each tool.
- Events/callbacks: Tools are synchronous in execution but async; errors thrown and caught by caller (agent/flow).

### Calculator Tool

| Method/Property | Purpose | Parameters | Return Type | Usage Notes |
|-----------------|---------|------------|-------------|-------------|
| calculatorTool | Perform basic arithmetic | num1: number, num2: number, operator: '+'|'-'|'*'|'/' | number | Throws on divide by zero; logs calculation. |

### Weather Tool

| Method/Property | Purpose | Parameters | Return Type | Usage Notes |
|-----------------|---------|------------|-------------|-------------|
| weatherTool | Get weather for location | location: string | string | Mock response; replace with real API for production. |

### Wikipedia Tool

| Method/Property | Purpose | Parameters | Return Type | Usage Notes |
|-----------------|---------|------------|-------------|-------------|
| wikipediaTool | Search Wikipedia summary | query: string | string | Uses wikipedia library; returns extract or error message on failure. Logs search. |

## 4. Implementation Details

- Main classes: No classes; functional tools via ai.defineTool. calculatorTool: switch on operator with error for /0. weatherTool: static mock string. wikipediaTool: async wiki.summary with try-catch.
- Configuration: Imported in config.js; no additional setup. wikipediaTool requires internet.
- Key algorithms: Zod validation on input; simple logic for calc/weather, async API call for wiki with fallback text.
- Performance: Calc/weather instant; wiki ~1-2s API call. Bottlenecks: External API latency/reliability for wiki.

## 5. Usage Examples

### Basic Usage (in Flow/Agent)

```typescript
// In a Genkit flow or agent prompt
const result = await ai.runTool(calculatorTool, { num1: 5, num2: 3, operator: '+' });
console.log(result); // 8
```

### Advanced Usage (Wikipedia with Error Handling)

```typescript
try {
  const summary = await ai.runTool(wikipediaTool, { query: 'TypeScript' });
  // Use summary in response
} catch (error) {
  // Handle "Could not find" message
}
```

- Basic: Simple math in calculator.
- Advanced: Chain tools, e.g., wiki search then calc on extracted numbers.
- Best practices: Validate inputs client-side; handle wiki errors gracefully.

## 6. Quality Attributes

- Security: No auth in tools; wiki public but rate-limit in production. Validate inputs to prevent injection.
- Performance: Low overhead; wiki API calls need caching/rate-limiting for scale.
- Reliability: Calc throws on invalid; wiki catches API errors with fallback. Mock weather always succeeds.
- Maintainability: Simple functions; easy to add schemas/tests. Central in config.js.
- Extensibility: Add new tools via defineTool; integrate more APIs (e.g., real weather).

## 7. Reference Information

- Dependencies: genkit, zod, wikipedia (for wikiTool).
- Configuration: None beyond ai instance in config.js.
- Testing: Unit test each tool with Vitest; mock wiki API.
- Troubleshooting: Divide by zero in calc — catch error. Wiki "no info" — check query spelling.
- Related: [config.ts](../../src/config.ts) (ai import), [flows-documentation.md](flows-documentation.md) (tool usage in flows).
- Change history: 2025-09-26 v1.0 — Initial documentation for three tools.


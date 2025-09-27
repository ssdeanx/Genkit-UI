---
title: Tools Component - Technical Documentation
component_path: src/tools
version: 1.0
date_created: 2025-09-27
last_updated: 2025-09-27
owner: Genkit-UI Team
tags:
  - component
  - tools
  - genkit
  - ai
  - utilities
  - interrupts
  - documentation
  - architecture
---

# Tools Component Documentation

The Tools Component provides a collection of reusable utility functions and interactive patterns for Genkit AI agents and flows, enabling external API integration, user interaction, and computational capabilities. It serves as the external interface layer for AI-driven functionality in the Genkit-UI system.

## 1. Component Overview

### Purpose/Responsibility

- OVR-001: Provide utility tools for common computational and data retrieval tasks
- OVR-002: Enable user interaction patterns through interrupt-based workflows
- OVR-003: Support external API integrations for web services and knowledge bases
- OVR-004: Implement schema-validated tool interfaces with error handling
- OVR-005: Enable advanced tool calling patterns including streaming, multi-agent delegation, and context propagation

## 2. Architecture Section

The Tools Component follows a modular architecture with two main categories: utility tools for data processing and APIs, and interrupt tools for user interaction. Tools are registered with the Genkit framework and can be invoked by agents and flows through advanced patterns including streaming tool calls, multi-agent delegation, and context propagation.

- ARC-001: Design patterns: Tool Registry (Genkit framework), Strategy (different tool implementations), Template Method (interrupt patterns), Observer (streaming callbacks), Chain of Responsibility (multi-agent delegation)
- ARC-002: Internal dependencies: Genkit ai instance, Zod for schema validation, Express for agent servers
- ARC-003: External dependencies: Wikipedia API, SERPAPI (used in agents), external services; MCP for tool extension
- ARC-004: Component interactions: Tools invoked by prompts via tool calling, interrupt tools pause execution for user input, context propagation through tool chains
- ARC-005: Advanced features: Streaming tool calls, maxTurns limiting, dynamic tool definition, MCP integration
- ARC-006: Visual diagrams below

### Component Structure and Dependencies Diagram

```mermaid
graph TD
    subgraph "Utility Tools"
        CALC[calculatorTool] --> MATH[Math Operations]
        WEATHER[weatherTool] --> MOCK[Mock Data]
        WIKI[wikipediaTool] --> API[Wikipedia API]
    end

    subgraph "Interrupt Tools"
        CONFIRM[confirmActionTool] --> INTERRUPT[User Confirmation]
        ASK[askClarifyingQuestion] --> INTERRUPT
        OVERWRITE[confirmOverwriteTool] --> INTERRUPT
    end

    subgraph "Advanced Patterns"
        STREAM[Streaming Tool Calls] --> CALLBACK[Chunk Callbacks]
        MULTI[Multi-Agent Tools] --> DELEGATE[Agent Delegation]
        CONTEXT[Context Propagation] --> AUTH[Auth Context]
        MCP[MCP Integration] --> EXTEND[External Tools]
    end

    subgraph "External Dependencies"
        GENKIT[Genkit Framework]
        ZOD[Zod Validation]
        WIKIPEDIA[Wikipedia Library]
        SERPAPI[SerpAPI - Used in Agents]
        A2A[A2A Protocol]
        MCP_SERVER[MCP Servers]
    end

    CALC --> GENKIT
    WEATHER --> GENKIT
    WIKI --> GENKIT
    CONFIRM --> GENKIT
    ASK --> GENKIT
    OVERWRITE --> GENKIT
    STREAM --> GENKIT
    MULTI --> A2A
    CONTEXT --> GENKIT
    MCP --> MCP_SERVER

    WIKI --> WIKIPEDIA
    GENKIT --> ZOD

    classDiagram
        class Tool {
            +name: string
            +description: string
            +inputSchema: ZodSchema
            +outputSchema: ZodSchema
            +handler(input, context?): Promise~any~
        }

        class UtilityTool {
            +externalAPIs: boolean
            +streamingSupport: boolean
        }

        class InterruptTool {
            +interrupt(metadata): any
            +resumed: any
            +restartable: boolean
        }

        class StreamingTool {
            +streamCallback: Function
            +chunkSchema: ZodSchema
        }

        class ContextAwareTool {
            +contextPropagation: boolean
            +authRequired: boolean
        }

        Tool <|-- UtilityTool
        Tool <|-- InterruptTool
        Tool <|-- StreamingTool
        Tool <|-- ContextAwareTool
        UtilityTool <|-- CalculatorTool
        UtilityTool <|-- WeatherTool
        UtilityTool <|-- WikipediaTool
        InterruptTool <|-- ConfirmActionTool
        InterruptTool <|-- AskQuestionTool
        InterruptTool <|-- ConfirmOverwriteTool
        StreamingTool <|-- StreamingSearchTool
        ContextAwareTool <|-- SecureDataTool
```

## 3. Interface Documentation

### Tool Categories and Interfaces

| Category | Purpose | Tools | Key Features |
|----------|---------|-------|--------------|
| **Utility Tools** | Data processing and external APIs | calculatorTool, weatherTool, wikipediaTool | Synchronous execution, external data sources, streaming support |
| **Interrupt Tools** | User interaction patterns | confirmActionTool, askClarifyingQuestion, confirmOverwriteTool | Asynchronous interrupts, user input collection, restartable workflows |
| **Streaming Tools** | Real-time data processing | streamingSearchTool, realTimeDataTool | Chunk-based responses, progressive output, callback patterns |
| **Context-Aware Tools** | Security and personalization | secureDataTool, userScopedTool | Auth context propagation, user isolation, secure API access |
| **Multi-Agent Tools** | Agent delegation | agentDelegationTool, specializedAgentTool | A2A protocol integration, task distribution, orchestration |

### Tool Reference Table

| Tool Name | Purpose | Input Schema | Output Schema | External APIs | Advanced Features |
|-----------|---------|--------------|---------------|---------------|-------------------|
| calculatorTool | Basic arithmetic operations | `{num1: number, num2: number, operator: enum['+','-','*','/']}` | `number` | None | Synchronous, error handling |
| weatherTool | Weather information retrieval | `{location: string}` | `string` | Mock (can integrate real API) | Context propagation, streaming |
| wikipediaTool | Wikipedia knowledge retrieval | `{query: string}` | `string` | Wikipedia API | Rate limiting, fallback handling |
| confirmActionTool | Generic action confirmation | `{actionName: string, target: string, reason?: string, risk: enum['low','medium','high']}` | `{status: string, message?: string}` | None (user interaction) | Interrupt patterns, restartable |
| askClarifyingQuestion | Question user for clarification | `{question: string, choices?: array[string], allowWriteIn?: boolean}` | `{answer: string}` | None (user interaction) | Manual response, multiple choice |
| confirmOverwriteTool | File/directory overwrite confirmation | `{filePath: string, summary?: string, risk: enum['low','medium','high']}` | `{confirmed: boolean}` | None (user interaction) | Risk assessment, context aware |
| streamingSearchTool | Real-time search with streaming | `{query: string, maxResults?: number}` | `stream<string>` | SERPAPI | Streaming chunks, progressive results |
| agentDelegationTool | Delegate to specialized agents | `{task: string, agentType: string, context?: object}` | `object` | A2A Protocol | Multi-agent orchestration, context passing |

## 4. Implementation Details

- IMP-001: All tools use `ai.defineTool()` with Zod schemas for type safety
- IMP-002: Utility tools return results synchronously or via async API calls
- IMP-003: Interrupt tools use Genkit's interrupt mechanism to pause execution
- IMP-004: Error handling includes input validation and API error management
- IMP-005: Tools are registered globally and available to all agents/flows
- IMP-006: External APIs require proper API keys (environment variables)
- IMP-007: Advanced tools support streaming with `toolRequest`/`toolResponse` chunks
- IMP-008: Context propagation enables secure, user-scoped tool execution
- IMP-009: Multi-agent tools integrate with A2A protocol for agent delegation
- IMP-010: Dynamic tool definition allows runtime tool creation for specialized tasks

### Tool Implementation Patterns

#### Utility Tool Pattern

```typescript
export const exampleTool = ai.defineTool(
  {
    name: 'exampleTool',
    description: 'Tool description for LLM understanding',
    inputSchema: z.object({
      param1: z.string().describe('Parameter description'),
      param2: z.number().optional().describe('Optional parameter')
    }),
    outputSchema: z.object({
      result: z.string(),
      metadata: z.object({ timestamp: z.string() })
    }),
  },
  async (input) => {
    // Tool logic with error handling
    try {
      const result = await processData(input);
      return { result, metadata: { timestamp: new Date().toISOString() } };
    } catch (error) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }
);
```

#### Interrupt Tool Pattern

```typescript
export const interruptTool = ai.defineTool(
  {
    name: 'interruptTool',
    description: 'Interrupt description for user interaction',
    inputSchema: z.object({
      action: z.string().describe('Action requiring confirmation'),
      risk: z.enum(['low', 'medium', 'high']).describe('Risk level')
    }),
    outputSchema: z.object({
      status: z.enum(['APPROVED', 'REJECTED', 'PENDING']),
      message: z.string().optional()
    }),
  },
  async (input, { interrupt, resumed }) => {
    // Handle resumed execution after user input
    if (resumed) {
      return {
        status: resumed.approved ? 'APPROVED' : 'REJECTED',
        message: resumed.message
      };
    }

    // Trigger interrupt for user input
    interrupt({
      message: `Confirm ${input.action}? Risk level: ${input.risk}`,
      metadata: { action: input.action, risk: input.risk }
    });

    return { status: 'PENDING' };
  }
);
```

#### Streaming Tool Pattern

```typescript
export const streamingTool = ai.defineTool(
  {
    name: 'streamingTool',
    description: 'Tool that streams results progressively',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      maxResults: z.number().optional().default(10)
    }),
    outputSchema: z.array(z.object({
      title: z.string(),
      content: z.string(),
      score: z.number()
    })),
  },
  async (input, { sendChunk }) => {
    const results = [];
    const searchStream = performStreamingSearch(input.query);

    for await (const chunk of searchStream) {
      // Send intermediate results as they arrive
      if (sendChunk) {
        sendChunk({ partial: results.length, total: input.maxResults });
      }
      results.push(chunk);
      if (results.length >= input.maxResults) break;
    }

    return results;
  }
);
```

#### Context-Aware Tool Pattern

```typescript
export const secureTool = ai.defineTool(
  {
    name: 'secureTool',
    description: 'Tool that requires user authentication',
    inputSchema: z.object({
      resourceId: z.string().describe('Resource to access')
    }),
    outputSchema: z.object({
      data: z.any(),
      accessLevel: z.string()
    }),
  },
  async (input, { context }) => {
    // Validate authentication context
    if (!context?.auth?.uid) {
      throw new Error('Authentication required');
    }

    // Check user permissions
    const permissions = await checkUserPermissions(context.auth.uid, input.resourceId);

    if (!permissions.canAccess) {
      throw new Error('Access denied');
    }

    // Fetch data with user context
    const data = await fetchSecureData(input.resourceId, context.auth.uid);

    return {
      data,
      accessLevel: permissions.level
    };
  }
);
```

#### Multi-Agent Tool Pattern

```typescript
export const agentDelegationTool = ai.defineTool(
  {
    name: 'agentDelegationTool',
    description: 'Delegate complex tasks to specialized agents',
    inputSchema: z.object({
      task: z.string().describe('Task description'),
      agentType: z.enum(['research', 'coding', 'analysis']).describe('Agent specialization'),
      context: z.record(z.any()).optional().describe('Additional context')
    }),
    outputSchema: z.object({
      result: z.any(),
      agentUsed: z.string(),
      confidence: z.number()
    }),
  },
  async (input, { context }) => {
    // Select appropriate agent based on task
    const agentUrl = getAgentUrl(input.agentType);

    // Prepare A2A message with context
    const message = {
      task: input.task,
      context: {
        ...input.context,
        auth: context?.auth,
        sessionId: context?.sessionId
      }
    };

    // Send to specialized agent via A2A
    const response = await sendA2AMessage(agentUrl, message);

    return {
      result: response.result,
      agentUsed: input.agentType,
      confidence: response.confidence || 0.8
    };
  }
);
```

## 5. Advanced Usage Patterns

### Streaming Tool Calls

Tools can stream results progressively during execution:

```typescript
const { stream } = await ai.generateStream({
  prompt: 'Search for recent AI developments',
  tools: [streamingSearchTool],
});

for await (const chunk of stream) {
  if (chunk.content) {
    for (const part of chunk.content) {
      if (part.toolRequest) {
        console.log('Tool called:', part.toolRequest.name);
      }
      if (part.toolResponse) {
        console.log('Tool response chunk:', part.toolResponse.output);
      }
    }
  }
}
```

### Limiting Tool Call Iterations

Prevent runaway tool execution with `maxTurns`:

```typescript
const response = await ai.generate({
  prompt: 'Research quantum computing breakthroughs',
  tools: [wikipediaTool, webSearchTool],
  maxTurns: 5, // Limit to 5 tool call cycles
});
```

### Dynamic Tool Definition

Create tools at runtime for specialized tasks:

```typescript
const customTool = ai.dynamicTool(
  {
    name: 'customAnalysis',
    description: 'Analyze data with custom parameters',
    inputSchema: z.object({ data: z.array(z.number()) }),
    outputSchema: z.object({ analysis: z.string() }),
  },
  async (input) => {
    // Custom analysis logic
    return { analysis: analyzeData(input.data) };
  }
);

const response = await ai.generate({
  prompt: 'Analyze this dataset',
  tools: [customTool],
});
```

### Context Propagation

Pass authentication and session context through tool chains:

```typescript
const response = await ai.generate({
  prompt: 'Access my secure documents',
  tools: [secureDataTool],
  context: {
    auth: {
      uid: 'user123',
      token: decodedToken,
      rawToken: 'jwt.token.here'
    },
    sessionId: 'session456'
  }
});
```

### Multi-Agent Tool Integration

Use tools to delegate to specialized agents:

```typescript
const orchestratorFlow = ai.defineFlow({
  name: 'orchestratorFlow',
  inputSchema: z.object({ task: z.string() }),
  outputSchema: z.object({ result: z.any() }),
}, async ({ task }, { context }) => {
  const response = await ai.generate({
    prompt: `Delegate this task: ${task}`,
    tools: [agentDelegationTool],
    context
  });

  return { result: response.text };
});
```

### Interrupt Workflows

Handle complex user interaction patterns:

```typescript
let response = await ai.generate({
  prompt: 'Process this high-risk transaction',
  tools: [confirmActionTool],
});

while (response.finishReason === 'interrupted') {
  const interrupt = response.interrupts[0];

  // Get user confirmation
  const userResponse = await getUserConfirmation(interrupt.toolRequest.input);

  // Resume with user input
  response = await ai.generate({
    messages: response.messages,
    resume: {
      respond: [confirmActionTool.respond(interrupt, userResponse)]
    },
    tools: [confirmActionTool],
  });
}
```

## 6. Quality Attributes

- QUA-001: Security: Input validation prevents injection; API keys stored securely; user input sanitized; context isolation
- QUA-002: Performance: Synchronous tools for fast operations; async for API calls; streaming for large datasets; maxTurns prevents resource exhaustion
- QUA-003: Reliability: Error handling for API failures; interrupt resumption patterns; schema validation; graceful degradation
- QUA-004: Maintainability: Modular tool structure; clear separation of concerns; comprehensive error messages; pattern consistency
- QUA-005: Extensibility: Easy to add new tools following established patterns; support for new API integrations; MCP ecosystem
- QUA-006: Scalability: Context propagation enables distributed execution; streaming supports large data processing; multi-agent delegation

## 7. Best Practices and Troubleshooting

### Best Practices

#### Tool Design

- **Descriptive Names and Descriptions**: Use clear, specific names and descriptions that help LLMs understand when to use tools
- **Minimal Input Schemas**: Only include necessary parameters to reduce complexity
- **Comprehensive Output Schemas**: Provide structured outputs that LLMs can easily parse
- **Error Handling**: Implement robust error handling with meaningful error messages
- **Context Awareness**: Design tools to leverage context when available for personalization and security

#### Performance Optimization

- **Streaming for Large Data**: Use streaming tools for operations that return large amounts of data
- **maxTurns Configuration**: Set appropriate limits based on tool complexity and expected usage patterns
- **Caching**: Implement caching for expensive operations when appropriate
- **Async Operations**: Use async/await for I/O operations to prevent blocking

#### Security Considerations

- **Input Validation**: Always validate inputs using Zod schemas
- **Context Validation**: Verify authentication context before accessing sensitive resources
- **API Key Management**: Store API keys securely in environment variables
- **Rate Limiting**: Implement rate limiting for external API calls
- **Audit Logging**: Log tool usage for security monitoring

### Troubleshooting Guide

#### Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Tool Not Called** | LLM doesn't use expected tool | Check tool description clarity, verify tool registration, test with direct tool calls |
| **Schema Validation Errors** | Tool throws validation errors | Verify input/output schemas match actual data structures, check Zod schema definitions |
| **Interrupt Not Triggering** | Tool executes without pausing | Ensure interrupt() is called in tool logic, verify interrupt handling in calling code |
| **Context Not Propagated** | Tool can't access user/session data | Pass context object in generate() calls, verify context structure in tool handlers |
| **Streaming Not Working** | No chunks received during streaming | Check if tool supports streaming, verify stream iteration in calling code |
| **API Rate Limits** | External API calls failing | Implement retry logic with backoff, check API key validity, add rate limiting |
| **Multi-Agent Delegation Failing** | A2A messages not received | Verify agent URLs, check A2A server status, validate message schemas |
| **Memory Issues** | Large tool responses causing problems | Use streaming for large data, implement pagination, check memory limits |

#### Debugging Techniques

```typescript
// Enable detailed logging
const response = await ai.generate({
  prompt: 'Debug this tool call',
  tools: [problematicTool],
  // Log all tool interactions
  onToolCall: (toolRequest) => {
    console.log('Tool called:', toolRequest);
  },
  onToolResponse: (toolResponse) => {
    console.log('Tool responded:', toolResponse);
  }
});

// Test tools in isolation
const toolResult = await ai.runTool('toolName', testInput);
console.log('Direct tool result:', toolResult);

// Check tool registration
const registeredTools = ai.listTools();
console.log('Available tools:', registeredTools.map(t => t.name));
```

#### Performance Monitoring

```typescript
// Monitor tool execution time
const startTime = Date.now();
const result = await ai.runTool('toolName', input);
const executionTime = Date.now() - startTime;

if (executionTime > 1000) { // Log slow tools
  console.warn(`Slow tool execution: ${executionTime}ms for ${toolName}`);
}
```

## 8. Reference Information

- REF-001: Dependencies: Genkit ^1.20.0, Zod ^4.1.11, wikipedia ^2.1.2, @a2a-js/sdk ^0.3.4
- REF-002: Configuration: API keys via environment variables (GEMINI_API_KEY, WIKIPEDIA_API_KEY, SERPAPI_API_KEY)
- REF-003: Testing: Unit tests for tool logic; mock external APIs; integration tests for interrupt flows; streaming tests
- REF-004: Related docs: Genkit tool calling documentation, A2A protocol docs, MCP integration guide
- REF-005: Change history: Initial utility tools; added interrupt pattern for user interactions; SERPAPI integration in agents; advanced streaming and multi-agent features
- REF-006: External Resources: Genkit Tool Calling Guide, Model Context Protocol documentation, A2A Protocol specification
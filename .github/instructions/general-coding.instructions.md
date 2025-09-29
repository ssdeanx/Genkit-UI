---
applyTo: "**"
description: "General coding standards for TypeScript"
tags: "typescript", "coding-standards", "genkit", "a2a", "multi-agent"
version: "1.0.3"
last_updated: "2025-09-28T13:00:00Z"
status: "stable"
---
# TypeScript Coding Standards

## Core

- **TypeScript First**: Use TypeScript for all new code with strict mode enabled
- **Type Safety**: Never use `any` - prefer specific types, interfaces, generics, and union types
- **Functional Approach**: Favor functional programming patterns and immutable data (`const`, `readonly`)
- **Clean Code**: Follow DRY, SOLID principles, and meaningful naming conventions
- **Agent Architecture**: Maintain clean separation between agents, flows, and shared interfaces

## Best Practices

- Use interfaces/types for data structures and function signatures
- Define Zod schemas for runtime validation (critical for A2A and Genkit flows)
- Leverage modern operators: optional chaining (`?.`), nullish coalescing (`??`), non-null assertion (`!`)
- Implement proper error handling with try/catch and typed error classes
- Use UserFacingError for user-visible errors in agents and flows
- Use async/await for asynchronous operations over Promise chains
- Handle streaming responses properly in A2A communications
- Apply type guards and discriminated unions for runtime type checking
- Validate inputs using Zod schemas before processing in agents

## Implementation Rules

- **Complete Implementation**: Never leave stubs, mocks, or unused imports - implement fully or deremove
  - Fully implement all functions and classes
  - Replace mocks with real implementations
  - Remove all unused imports and code
- **Agent Readiness**: Ensure agents are fully functional with proper A2A endpoints and error handling
  - Verify A2A endpoints are properly configured
  - Test agent communication flows
  - Implement comprehensive error handling
- **Error Handling**: No silent failures; use proper error types and logging
  - Use typed error classes consistently
  - Log all errors appropriately
  - Never suppress errors without handling
- **Agent Communication**: Handle A2A communication errors gracefully with appropriate status updates
  - Implement proper status reporting
  - Handle network failures gracefully
  - Update communication states accurately
- **Feature Flags**: Mark incomplete features with `#TODO`, `#FIXME`, or `@copilot` tags
  - **@copilot Tags**: Use for AI-assisted development tasks requiring specific implementation guidance
    - Include context in the tag: `@copilot implement user authentication with JWT tokens`
  - **#TODO Tags**: Use for planned features that need future implementation
  - **#FIXME Tags**: Use for known issues needing immediate attention
- **Validation**: Use internal tools (`get_errors`, `#problems`) for code quality checks
  - Run get_errors after changes
  - Check #problems for issues
  - Fix all validation errors
- **Testing**: Run appropriate tests for flows, tools, and agent integrations
  - Use `npx vitest run` for running unit tests
  - Test flows interactively with Genkit UI
  - Validate agent A2A integrations

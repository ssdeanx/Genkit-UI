# [DESIGN001] - A2A Agent Testing Architecture

Status: Draft
Added: 2025-09-29
Updated: 2025-09-29
Priority: High
Complexity: Moderate
Completion Percentage: 20%
Related Requirements: REQ001, REQ002
Related Tasks: TASK009

## Design Overview
Define a consistent architecture and patterns for testing Genkit-UI A2A agents. This includes:
- Deterministic unit tests for each agent executor (planning, orchestrator, coder, etc.)
- EventBus-driven verification of task/status/artifact events
- Genkit model outputs mocked at the boundary
- Schemas validated (Zod) before emitting artifacts/status
- Fallback behavior for error paths to keep flows resilient

## Requirements Analysis
- REQ001: Coder agent MUST complete with a fallback artifact on upstream generation error
- REQ002: All agent executor unit tests MUST be green on CI with deterministic mocks

## Technical Specification
- Use Vitest test runner with spies for ExecutionEventBus.publish
- Mock Genkit calls via vi.mock on ai.generateStream and ai.prompt
- Emit Task on new context; emit working, then final status
- Validate outputs with CodeMessageSchema or appropriate schema before artifacts
- Implement cancellation via canceled state and final=true

## Implementation Considerations
- Keep tests independent of network calls
- Avoid using real API keys in tests
- Ensure compatibility with @a2a-js/sdk ^0.3.4 and Genkit ^1.20.0

## Validation Criteria
- All agent executor tests pass locally and on CI
- Coder executor emits completed state even when generation fails, with fallback artifact
- No uncaught exceptions during test runs

## Progress Tracking

Overall Status: Draft - 20%

### Sub-components
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 1.1 | Coder fallback design | Complete | 2025-09-29 | Implemented in executor.ts |
| 1.2 | Test scaffolding pattern | In Progress | 2025-09-29 | Using vi.mock and publish spies |
| 1.3 | CI green gate | Not Started | 2025-09-29 | To be ensured in workflow |

## Design Log
### 2025-09-29 03:25 UTC
- Created design doc and linked requirements
- Captured coder fallback approach for resilience

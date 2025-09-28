# TASK002 - Expand flow & tool tests

Status: In Progress
Added: 2025-09-27
Updated: 2025-09-27

## Original Request
Increase unit test coverage for flows and tools; add mocks for external APIs.

## Thought Process
Focus on flows in `src/flows/` and tools in `src/tools/`. Mock `ai` and external libs with Vitest. Use existing `weatherFlow.test.ts` as a pattern.

## Implementation Plan

- Identify flows/tools lacking tests and list cases
- Create tests under `src/**/__tests__` or alongside flows
- Mock external APIs (wikipedia, weather) and `ai`

## Progress Tracking

Overall Status: In Progress - 10%

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 2.1 | Audit test gaps | In Progress | 2025-09-27 |  |
| 2.2 | Add tests for wikipediaTool | Not Started | 2025-09-27 |  |
| 2.3 | Add tests for orchestrator flows | Not Started | 2025-09-27 |  |

## Progress Log
### 2025-09-27

- Collected patterns from existing tests and planned coverage

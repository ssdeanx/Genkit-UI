# TASK006 - Remaining Agents Tests

Status: In Progress
Added: 2025-09-28
Updated: 2025-09-28
Notes: content-editor, coder, and data-analysis agents targeted for tests and logger alignment.

## Original Request
Implement deterministic unit tests for the remaining agents (content-editor, coder, data-analysis-agent) and ensure they use the main logger with no stray console statements. Keep tests green and update Memory Bank.

## Thought Process
 
- Follow the same approach used for orchestrator, planning, and research agents: deterministic tests with mocks and DI.
- Avoid network access; mock Genkit and streaming where applicable.
- Ensure agents use shared `flowlogger` and remove `console.*`.

## Implementation Plan
 
- Create or update unit tests under each agent's `__tests__` directory (mock Genkit/A2A where necessary).
- Sweep agents for `console.*` usage and replace with `flowlogger`.
- Run full test suite and iterate to green.

## Progress Tracking

Overall Status: In Progress — pending scheduling

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 1.1 | Add content-editor tests | Not Started | 2025-09-28 | Will use deterministic mocks |
| 1.2 | Add coder agent tests | Not Started | 2025-09-28 | Streaming + validation |
| 1.3 | Add data-analysis tests | Not Started | 2025-09-28 | JSON outputs validation |
| 1.4 | Replace console with logger | Not Started | 2025-09-28 | Use `flowlogger` |

## Progress Log
### 2025-09-28

- Task created to scope remaining agents tests and logger alignment. Pending execution.

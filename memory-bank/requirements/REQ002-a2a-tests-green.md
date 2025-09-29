# [REQ002] - A2A Agent Tests Green in CI

Status: Proposed
Added: 2025-09-29
Updated: 2025-09-29
Priority: High
Type: Technical
Completion Percentage: 10%
Related Designs: DESIGN001
Related Tasks: TASK009

## User Story
As a maintainer, I want all agent unit tests to pass consistently in CI so that regressions are caught early and confidence remains high.

## Requirement Statement
THE SYSTEM SHALL execute all agent executor unit tests deterministically with mocks and pass with zero failures on each CI run.

## Acceptance Criteria
Crit-001
1. All tests in src/agents/*/__tests__/*.spec.ts pass in CI
2. No network calls are made during tests
3. Genkit and SerpAPI dependencies are mocked

## Business Value
Stable CI builds, faster feedback loops, and reliable development velocity.

## Technical Constraints
- Use Vitest and project’s ESLint/TS configs
- Ensure Node types ^24.5.2 compatibility

## Dependencies
- DESIGN001 A2A Agent Testing Architecture

## Validation Approach
- Run CI job executing vitest; ensure exit code 0 and coverage thresholds (if applied)

## Progress Tracking

Overall Status: Proposed - 10%

### Validation Steps
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 1.1 | Local run all tests | Not Started | 2025-09-29 | |
| 1.2 | CI pipeline config check | Not Started | 2025-09-29 | |

## Requirement Log
### 2025-09-29 03:28 UTC
- Drafted requirement mirroring current test suite and tooling

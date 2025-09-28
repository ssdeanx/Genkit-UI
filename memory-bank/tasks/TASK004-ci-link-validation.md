# TASK004 - CI: link validation

Status: Pending
Added: 2025-09-27
Updated: 2025-09-27

## Original Request
Add link validation to CI for docs and Markdown files.

## Thought Process
Use a lightweight link checker in GitHub Actions with caching. Scope to `docs/` and `memory-bank/` initially; fail PRs on broken links.

## Implementation Plan

- Select tool (e.g., lychee-action) and configure
- Add `.lycheeignore` for false positives
- Wire workflow and badges

## Progress Tracking

Overall Status: Not Started - 0%

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 4.1 | Evaluate link checker | Not Started | 2025-09-27 |  |
| 4.2 | Add workflow file | Not Started | 2025-09-27 |  |
| 4.3 | Tweak ignores and thresholds | Not Started | 2025-09-27 |  |

## Progress Log
### 2025-09-27

- Created task and outlined plan

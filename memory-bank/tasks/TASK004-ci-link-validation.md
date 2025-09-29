# TASK004 - CI: link validation

Status: Pending
Added: 2025-09-28
Updated: 2025-09-28

## Original Request
Set up CI to validate documentation links across the repository.

## Thought Process
Use a docs link checker action in GitHub Actions; include markdown and MDX; ignore local anchors as configured.

## Implementation Plan

- Evaluate link-checking actions (lychee, markdown-link-check)
- Add workflow under .github/workflows/link-check.yml
- Configure allowlist/ignore rules for external sites prone to rate-limits
- Run on PRs and nightly on default branch

## Progress Tracking

Overall Status: Pending - 0%

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 4.1 | Select link checker | Not Started | 2025-09-28 |  |
| 4.2 | Author workflow | Not Started | 2025-09-28 |  |
| 4.3 | Configure ignores | Not Started | 2025-09-28 |  |
| 4.4 | Add status badge | Not Started | 2025-09-28 |  |

## Progress Log

- 2025-09-28: Created task placeholder referenced from index
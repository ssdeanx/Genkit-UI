# TASK005 - Add tests for research agents

**Status:** Completed
**Added:** 2025-09-28
**Updated:** 2025-09-28
**Notes:** tags: testing, agents, research, serpapi

## Original Request
Add deterministic unit tests for web-research-agent, news-research-agent, and academic-research-agent. Ensure no network calls, mock external APIs, and verify key behaviors (query composition, parsing, deduplication, scoring).

## Thought Process

- Inventory agent utilities and identify pure functions vs. network surfaces.
- Prefer unit tests on *-search.ts utilities with SerpAPI/newsAPI/arXiv/SemanticScholar mocked.
- Fix minor query composition bug where base query could be overridden when appending filters.

## Implementation Plan

- Web: tests for query composition, answer box/knowledge graph parsing, scholar author filter, credibility scoring.
- News: tests for Google News parsing, NewsAPI no-key fallback, comprehensiveSearch dedup, trending topics parsing.
- Academic: tests for scholar query composition (author/venue), arXiv XML parsing, Semantic Scholar no-key fallback, comprehensiveSearch dedup/sources.
- Update utilities to correctly compose query params.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 1.1 | Add web-search tests | Complete | 2025-09-28 | Validates query composition and parsing |
| 1.2 | Add news-search tests | Complete | 2025-09-28 | Covers NewsAPI fallback and trending |
| 1.3 | Add academic-search tests | Complete | 2025-09-28 | Covers arXiv XML and dedup |
| 1.4 | Fix query composition bugs | Complete | 2025-09-28 | Avoids overriding base query |
| 1.5 | Run full test suite | Complete | 2025-09-28 | All green |

## Progress Log
### 2025-09-28 04:22

- Implemented tests for web/news/academic search utilities.
- Fixed query composition in web-search.ts and academic-search.ts to append filters without overriding base query.
- Mocked serpapi.getJson and global fetch; ensured no network calls.
- Ran full suite: 29 files, 78 tests, all passed.

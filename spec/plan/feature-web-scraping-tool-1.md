---
goal: Implement Web Scraping Tool with RAG Integration
version: 1.0
date_created: 2025-09-27
last_updated: 2025-09-27
owner: ssdeanx
status: 'Planned'
tags: [`feature`, `web-scraping`, `rag`, `tool`]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This implementation plan outlines the step-by-step development of a comprehensive web scraping tool that integrates with the Genkit ecosystem. The tool will support single URL scraping, multi-page crawling, sitemap processing, batch operations, and RAG data embedding using Crawlee, Cheerio, JSDOM, and Marked libraries.

## 1. Requirements & Constraints

- **REQ-001**: Tool must accept any valid HTTP/HTTPS URL for scraping
- **REQ-002**: Support crawling multiple pages with configurable depth limits
- **REQ-003**: Extract structured data including text content, links, images, and metadata
- **REQ-004**: Handle XML and HTML sitemaps for site-wide crawling
- **REQ-005**: Implement batch processing for multiple URLs
- **REQ-006**: Integrate with existing RAG flow for data embedding
- **REQ-007**: Provide formatted output to users with markdown support
- **REQ-008**: Respect robots.txt and implement rate limiting
- **REQ-009**: Handle various content types (HTML, XML, JSON)
- **REQ-010**: Support content conversion to markdown using Marked
- **FUN-001**: Implement single URL scraping with Crawlee and Cheerio
- **FUN-002**: Add multi-page crawling capabilities
- **FUN-003**: Process XML/HTML sitemaps
- **FUN-004**: Enable batch URL processing with concurrency control
- **FUN-005**: Integrate RAG embedding using existing indexer
- **FUN-006**: Convert HTML to markdown with Marked
- **PER-001**: Achieve <5s response time for single page scraping
- **PER-002**: Support concurrent processing of up to 10 URLs
- **SEC-001**: Implement proper error handling for failed requests
- **SEC-002**: Validate URLs to prevent malicious input
- **SEC-003**: Respect robots.txt directives
- **TST-001**: Achieve minimum 80% code coverage
- **OPS-001**: Follow established Genkit tool patterns
- **CON-001**: Must use Crawlee as primary scraping framework
- **CON-002**: Must use Cheerio for DOM manipulation
- **CON-003**: Must use JSDOM for JavaScript-rendered content
- **CON-004**: Must use Marked for markdown conversion
- **CON-005**: Must integrate with existing RAG infrastructure
- **GUD-001**: Follow existing TypeScript and Genkit patterns
- **PAT-001**: Use async/await patterns consistently
- **STD-001**: Adhere to project's coding standards
- **COM-001**: Respect website terms of service
- **DEP-001**: Depends on Crawlee, Cheerio, JSDOM, Marked libraries
- **RSL-001**: Handle network failures gracefully with retries
- **SCAL-001**: Support processing of large sitemaps
- **MON-001**: Provide progress updates for long operations
- **LOG-001**: Include comprehensive error logging

## 2. Implementation Steps

### Implementation Phase 1: Core Scraping Infrastructure

- GOAL-001: Implement basic single URL scraping with content extraction
- USR-001: As a Developer, I want to scrape content from a single URL so that I can extract structured data for further processing
- ACR-001: WHEN a valid HTTP/HTTPS URL is provided THEN the system SHALL fetch the page content using Crawlee

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create webScrapingTool.ts in src/tools/ with basic tool structure using ai.defineTool |  |  |
| TASK-002 | Implement URL validation function in webScrapingTool.ts using Zod schema |  |  |
| TASK-003 | Add Crawlee-based URL fetching function with timeout and retry logic |  |  |
| TASK-004 | Implement Cheerio-based HTML parsing for content extraction |  |  |
| TASK-005 | Add metadata extraction (title, description, meta tags) using Cheerio |  |  |
| TASK-006 | Implement link and image URL collection from parsed HTML |  |  |
| TASK-007 | Add JSDOM integration for JavaScript-rendered content processing |  |  |
| TASK-008 | Create ScrapedData interface and output schema validation |  |  |
| TASK-009 | Add error handling for invalid URLs and network failures |  |  |
| TASK-010 | Export tool in src/tools/index.ts for Genkit integration |  |  |

### Implementation Phase 2: Advanced Scraping Features

- GOAL-002: Add crawling and sitemap processing capabilities
- USR-002: As a Content Analyst, I want to crawl multiple pages from a website so that I can gather comprehensive site data
- ACR-002: WHEN a base URL and crawl options are provided THEN the system SHALL initiate a crawling process using Crawlee

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Implement crawlSite function with Crawlee crawler configuration |  |  |
| TASK-012 | Add crawl depth limiting and same-domain filtering |  |  |
| TASK-013 | Implement robots.txt checking and respect using Crawlee |  |  |
| TASK-014 | Add rate limiting configuration for crawl operations |  |  |
| TASK-015 | Create processSitemap function for XML sitemap parsing |  |  |
| TASK-016 | Implement recursive sitemap processing for nested sitemaps |  |  |
| TASK-017 | Add URL validation and filtering for sitemap entries |  |  |
| TASK-018 | Create CrawlResult and SitemapData output schemas |  |  |
| TASK-019 | Add circular link detection to prevent infinite crawling |  |  |
| TASK-020 | Implement crawl progress tracking and error aggregation |  |  |

### Implementation Phase 3: Batch Processing and RAG Integration

- GOAL-003: Enable batch operations and RAG data embedding
- USR-003: As a Data Scientist, I want to scrape multiple URLs concurrently so that I can efficiently process large datasets
- ACR-003: WHEN an array of URLs is provided THEN the system SHALL initiate concurrent scraping using configured concurrency limits

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | Implement batchScrape function with concurrency control |  |  |
| TASK-022 | Add duplicate URL detection and deduplication |  |  |
| TASK-023 | Implement partial result handling for interrupted batches |  |  |
| TASK-024 | Create BatchResult schema with success/failure tracking |  |  |
| TASK-025 | Add embedInRag function using devLocalIndexerRef |  |  |
| TASK-026 | Implement content chunking using llm-chunk library |  |  |
| TASK-027 | Create Document objects from scraped data with metadata |  |  |
| TASK-028 | Add RAG indexing with error handling and progress updates |  |  |
| TASK-029 | Implement source ID generation and deduplication logic |  |  |
| TASK-030 | Create EmbeddingResult schema and validation |  |  |

### Implementation Phase 4: Content Formatting and Final Integration

- GOAL-004: Complete content formatting and tool integration
- USR-004: As a Content Creator, I want to extract and format web content so that it can be easily consumed and processed
- ACR-004: WHEN HTML content is extracted THEN the system SHALL convert it to clean markdown using Marked

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-031 | Implement HTML to markdown conversion using Marked |  |  |
| TASK-032 | Add markdown formatting preservation (headers, lists, links) |  |  |
| TASK-033 | Implement table conversion to markdown format |  |  |
| TASK-034 | Add code block and syntax highlighting preservation |  |  |
| TASK-035 | Implement content truncation and chunking options |  |  |
| TASK-036 | Add fallback to plain text extraction on markdown failure |  |  |
| TASK-037 | Enhance error handling with compliance checking |  |  |
| TASK-038 | Add comprehensive logging and monitoring |  |  |
| TASK-039 | Update tool input/output schemas for all operations |  |  |
| TASK-040 | Add tool to src/index.ts for Genkit UI integration |  |  |

## 3. Alternatives

- **ALT-001**: Use Puppeteer instead of Crawlee for scraping
  - **USR-ALT-001**: As a developer, I want simpler browser automation
  - **ACR-ALT-001**: WHEN browser automation is needed THEN use Puppeteer API
- **ALT-002**: Implement separate tools for each scraping operation
  - **USR-ALT-002**: As an architect, I want modular tool design
  - **ACR-ALT-002**: WHEN operations are distinct THEN create separate Genkit tools
- **ALT-003**: Use different markdown converter library
  - **USR-ALT-003**: As a developer, I want alternative markdown processing
  - **ACR-ALT-003**: WHEN Marked has limitations THEN use alternative library

## 4. Dependencies

- **DEP-001**: Crawlee library for web scraping infrastructure
- **DEP-002**: Cheerio library for DOM manipulation
- **DEP-003**: JSDOM library for JavaScript execution
- **DEP-004**: Marked library for markdown conversion
- **DEP-005**: Existing Genkit RAG infrastructure (devLocalIndexerRef)
- **DEP-006**: llm-chunk library for content chunking
- **DEP-007**: Node.js runtime with ES modules support

## 5. Files

- **FILE-001**: Main web scraping tool implementation
  - **PATH-001**: `src/tools/webScrapingTool.ts`
  - **FUNC-001**: `scrapeUrl()`, `crawlSite()`, `processSitemap()`, `batchScrape()`, `embedInRag()`
  - **LINE-001**: 1-500 (estimated)
  - **CHANGE-001**: Create new file with complete tool implementation
- **FILE-002**: Tool exports and integration
  - **PATH-002**: `src/tools/index.ts`
  - **FUNC-002**: Export webScrapingTool
  - **LINE-002**: Add export statement
  - **CHANGE-002**: Add webScrapingTool to exports
- **FILE-003**: Genkit flows integration
  - **PATH-003**: `src/index.ts`
  - **FUNC-003**: Export webScrapingTool for UI
  - **LINE-003**: Add to exports object
  - **CHANGE-003**: Include tool in Genkit UI exports
- **FILE-004**: Type definitions
  - **PATH-004**: `src/tools/webScrapingTool.ts`
  - **FUNC-004**: ScrapedData, CrawlOptions, etc.
  - **LINE-004**: Type definitions section
  - **CHANGE-004**: Add comprehensive TypeScript interfaces

## 6. Testing

- **TEST-001**: Unit tests for URL validation and scraping functions
- **TEST-002**: Integration tests for full scraping workflows
- **TEST-003**: Mock HTTP server tests for external dependencies
- **TEST-004**: RAG embedding integration tests
- **TEST-005**: Error handling and edge case tests
- **TEST-006**: Performance tests for batch operations

## 7. Risks & Assumptions

- **RISK-001**: Target websites may block scraping attempts
- **ASSUMPTION-001**: Libraries are compatible with current Node.js version
- **GAP-001**: Limited knowledge of Crawlee advanced features
- **ISSUE-001**: Potential memory issues with large sitemaps
- **MIT-001**: Implement streaming processing for large datasets
- **CONT-001**: Fallback to simpler scraping methods if advanced features fail

## 8. Related Specifications / Further Reading

- [Web Scraping Tool Specification](../spec-tool-web-scraping.md)
- [Web Scraping Tool Design](../design/design-web-scraping-tool.md)
- [Crawlee Documentation](https://crawlee.dev/)
- [Genkit Tool Patterns](../../src/tools/)
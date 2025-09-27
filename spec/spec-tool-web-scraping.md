---
title: Web Scraping Tool Specification
version: 1.0
date_created: 2025-09-27
last_updated: 2025-09-27
owner: ssdeanx
tags: tool, web-scraping, crawlee, cheerio, jsdom, marked, rag
---

# Introduction

This specification defines the requirements, constraints, and interfaces for a comprehensive web scraping tool that leverages Crawlee, Cheerio, JSDOM, Marked, and optionally Cheerio-select to search, scrape, crawl, extract data from any URL, handle sitemaps, batch process information, embed it in the RAG flow, and output results to the user.

## 1. Purpose & Scope

The purpose of this specification is to create a robust web scraping tool that can efficiently gather and process web data for integration into AI systems, specifically for embedding in Retrieval-Augmented Generation (RAG) flows. The tool will support single URL scraping, multi-page crawling, sitemap processing, and batch operations.

Scope includes: URL validation, content extraction, data structuring, batch processing, RAG embedding integration, and user output formatting. The tool will be implemented as a Genkit tool following the project's established patterns.

Intended audience: AI agents, developers, and automated systems requiring web data extraction. Assumptions: Target websites allow scraping per robots.txt, and necessary API keys are configured.

## 2. Definitions

- **Crawlee**: A web scraping and browser automation library for Node.js
- **Cheerio**: A fast, flexible, and lean implementation of core jQuery designed specifically for the server
- **JSDOM**: A JavaScript implementation of the WHATWG DOM and HTML standards
- **Marked**: A markdown parser and compiler built for speed
- **Cheerio-select**: Optional CSS selector engine for Cheerio
- **RAG**: Retrieval-Augmented Generation, a technique for improving AI responses with external knowledge
- **Sitemap**: An XML file that lists the URLs for a site, typically for search engines
- **Batch Processing**: Processing multiple URLs or data items in a single operation
- **Embedding**: Converting text data into vector representations for semantic search

## 3. Requirements, Constraints & Guidelines

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
- **SEC-001**: Implement proper error handling for failed requests
- **SEC-002**: Validate URLs to prevent malicious input
- **CON-001**: Must use Crawlee as the primary scraping framework
- **CON-002**: Must use Cheerio for DOM manipulation and parsing
- **CON-003**: Must use JSDOM for JavaScript-rendered content
- **CON-004**: Must use Marked for markdown conversion
- **CON-005**: Optional use of Cheerio-select for advanced selectors
- **GUD-001**: Follow existing Genkit tool patterns and Zod schemas
- **GUD-002**: Implement proper TypeScript typing
- **GUD-003**: Include comprehensive error handling and logging
- **PAT-001**: Use async/await patterns consistent with codebase
- **PAT-002**: Follow established import/export patterns

## 4. Interfaces & Data Contracts

- **INT-001**: scrapeUrl(url: string, options?: ScrapeOptions) -> ScrapedData
  - Description: Scrape a single URL
  - Parameters: url (string, required), options (object, optional)
  - Return: ScrapedData object

- **INT-002**: crawlSite(baseUrl: string, options?: CrawlOptions) -> CrawlResult
  - Description: Crawl multiple pages from a base URL
  - Parameters: baseUrl (string, required), options (object, optional)
  - Return: CrawlResult object

- **INT-003**: processSitemap(sitemapUrl: string) -> SitemapData
  - Description: Process and extract URLs from a sitemap
  - Parameters: sitemapUrl (string, required)
  - Return: SitemapData object

- **INT-004**: batchScrape(urls: string[], options?: BatchOptions) -> BatchResult
  - Description: Scrape multiple URLs in batch
  - Parameters: urls (array of strings, required), options (object, optional)
  - Return: BatchResult object

- **INT-005**: embedInRag(data: ScrapedData[], flowId: string) -> EmbeddingResult
  - Description: Embed scraped data in RAG flow
  - Parameters: data (array of ScrapedData, required), flowId (string, required)
  - Return: EmbeddingResult object

- **DAT-001**: ScrapeOptions - { depth?: number, selectors?: string[], includeImages?: boolean, timeout?: number }
- **DAT-002**: ScrapedData - { url: string, title?: string, text: string, links: string[], images: string[], metadata: object, markdown?: string }
- **DAT-003**: CrawlOptions - { maxPages?: number, depth?: number, sameDomain?: boolean, selectors?: string[] }
- **DAT-004**: CrawlResult - { pages: ScrapedData[], totalPages: number, errors: string[] }
- **DAT-005**: SitemapData - { urls: string[], lastModified?: Date, changeFrequency?: string }
- **DAT-006**: BatchOptions - { concurrency?: number, timeout?: number, retryCount?: number }
- **DAT-007**: BatchResult - { results: ScrapedData[], failed: string[], summary: object }
- **DAT-008**: EmbeddingResult - { success: boolean, embeddedCount: number, flowId: string, errors?: string[] }

## 5. Acceptance Criteria

- **AC-001**: Given a valid URL, when scrapeUrl is called, then returns ScrapedData with extracted content
- **AC-002**: Given a base URL, when crawlSite is called with depth=2, then crawls up to 2 levels deep
- **AC-003**: Given a sitemap URL, when processSitemap is called, then extracts all listed URLs
- **AC-004**: Given multiple URLs, when batchScrape is called, then processes all URLs concurrently
- **AC-005**: Given scraped data, when embedInRag is called, then data is embedded in specified RAG flow
- **AC-006**: The tool shall handle invalid URLs gracefully with appropriate error messages
- **AC-007**: The tool shall respect rate limits and implement backoff strategies
- **AC-008**: The tool shall convert HTML content to markdown using Marked library

## 6. Test Automation Strategy

- **Test Levels**: Unit tests for individual functions, integration tests for full workflows
- **Frameworks**: Vitest for unit testing, following existing patterns in the codebase
- **Test Data Management**: Mock HTTP responses for external URLs, use local test servers
- **CI/CD Integration**: Automated testing in GitHub Actions pipelines
- **Coverage Requirements**: Minimum 80% code coverage
- **Performance Testing**: Load testing for batch operations with multiple concurrent requests

## 7. Rationale & Context

Web scraping is essential for gathering diverse data sources to enhance AI model knowledge and improve RAG system effectiveness. The specified libraries (Crawlee, Cheerio, JSDOM, Marked) provide robust, battle-tested solutions for different aspects of web scraping. Crawlee handles the crawling infrastructure, Cheerio provides fast DOM manipulation, JSDOM enables JavaScript execution, and Marked ensures clean markdown output. This combination allows for comprehensive web data extraction while maintaining performance and reliability.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: Target websites - HTTP/HTTPS web servers providing content to scrape

### Third-Party Services

- **SVC-001**: None required beyond the specified libraries

### Infrastructure Dependencies

- **INF-001**: Internet connectivity for accessing target URLs
- **INF-002**: Sufficient memory and processing power for batch operations

### Data Dependencies

- **DAT-001**: Web content in HTML/XML/JSON formats from target URLs

### Technology Platform Dependencies

- **PLT-001**: Node.js runtime environment compatible with specified library versions

### Compliance Dependencies

- **COM-001**: Respect website terms of service and robots.txt directives

## 9. Examples & Edge Cases

```typescript
// Example usage
const result = await scrapeUrl('https://example.com', {
  selectors: ['h1', '.content'],
  includeImages: true
});

// Edge case: Invalid URL
try {
  await scrapeUrl('invalid-url');
} catch (error) {
  console.log('Handled invalid URL:', error.message);
}

// Edge case: JavaScript-heavy site
const jsResult = await scrapeUrl('https://spa-site.com', {
  useJSDOM: true  // Hypothetical option for JS rendering
});
```

## 10. User Stories & Use Cases

- **USR-001**: As a researcher, I want to scrape academic papers from a journal website so that I can build a knowledge base for my AI assistant.
- **USR-002**: As a content creator, I want to crawl a blog site and extract articles so that I can analyze writing patterns.
- **USR-003**: As an AI agent, I want to batch scrape multiple documentation sites so that I can embed the information in my RAG system for better responses.
- **USE-001**: A user provides a sitemap URL. The tool parses the sitemap, extracts all URLs, filters by criteria, scrapes each page, converts content to markdown, batches the data, embeds it in the RAG flow, and returns a summary to the user. Edge case: Some URLs in sitemap are inaccessible - tool logs errors and continues with available pages.

## 11. Compliance Criteria

- **CPL-001**: All acceptance criteria pass successfully
- **CPL-002**: Code follows established TypeScript and Genkit patterns
- **CPL-003**: Tool integrates properly with existing RAG flow
- **CPL-004**: Performance benchmarks meet requirements (e.g., <5s for single page scrape)
- **CPL-005**: Error handling covers all documented edge cases

## 12. Related Specifications / Further Reading

- [Crawlee Documentation](https://crawlee.dev/)
- [Cheerio Documentation](https://cheerio.js.org/)
- [JSDOM Documentation](https://github.com/jsdom/jsdom)
- [Marked Documentation](https://marked.js.org/)
- Existing Genkit tool specifications in this repository
- RAG flow documentation in `src/flows/ragFlow.ts`
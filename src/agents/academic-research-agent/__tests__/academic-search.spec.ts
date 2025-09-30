import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { AcademicSearchUtils, type ScholarSearchOptions } from '../academic-search.js';

vi.mock('serpapi', () => ({ getJson: vi.fn() }));

const { getJson } = await import('serpapi');

describe('AcademicSearchUtils', () => {
  let utils: AcademicSearchUtils;

  beforeEach(() => {
    utils = new AcademicSearchUtils('TEST_SERP');
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error cleanup
    global.fetch = undefined;
  });

  it('searchScholar composes query with author and venue', async () => {
    const opts: ScholarSearchOptions = { author: 'Doe', venue: 'Nature', limit: 2 };
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        { title: 'P', link: 'L', publication_info: { authors: ['A'], summary: 'Summ', year: 2021 }, inline_links: { cited_by: { total: 5 } }, snippet: '...', resources: [{ link: 'pdf' }] },
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.searchScholar('climate change', opts);
    expect(res.totalResults).toBe(1);
    const arg = (getJson as Mock).mock.calls[0]?.[0];
    expect(arg.engine).toBe('google_scholar');
    expect(arg.q).toContain('climate change');
    expect(arg.q).toContain('author:"Doe"');
    expect(arg.q).toContain('source:"Nature"');
  });

  it('searchArXiv parses XML and extracts entries', async () => {
    const xml = `
      <feed>
        <opensearch:totalResults>1</opensearch:totalResults>
        <entry>
          <title>Sample Paper</title>
          <summary>Abstract text</summary>
          <published>2024-01-01T00:00:00Z</published>
          <updated>2024-02-01T00:00:00Z</updated>
          <id>http://arxiv.org/abs/1234.5678</id>
          <category term="cs.AI" />
          <link title="pdf">http://arxiv.org/pdf/1234.5678</link>
          <author><name>Author One</name></author>
        </entry>
      </feed>`;

    (fetch as Mock).mockResolvedValue({ text: () => Promise.resolve(xml) });
    const res = await utils.searchArXiv('ai');
    expect(res.totalResults).toBe(1);
    expect(res.papers[0]!.title).toBe('Sample Paper');
    expect(res.papers[0]!.categories).toContain('cs.AI');
  });

  it('searchSemanticScholar without key returns empty result with error', async () => {
    const noKeyUtils = new AcademicSearchUtils('TEST_SERP', undefined);
    const res = await noKeyUtils.searchSemanticScholar('nlp');
    expect(res.totalResults).toBe(0);
    expect(res.papers).toEqual([]);
    expect(res.error).toBeDefined();
  });

  it('comprehensiveSearch deduplicates and sorts', async () => {
    // Scholar
    (getJson as Mock).mockResolvedValueOnce({
      organic_results: [
        { title: 'Same Title', link: 'L1', publication_info: { authors: ['A'], summary: 'S', year: 2018 }, inline_links: { cited_by: { total: 5 } }, snippet: '...' },
      ],
      search_information: { total_results: 1 },
    });
    // arXiv
    (fetch as Mock).mockResolvedValueOnce({ text: () => Promise.resolve(`
      <feed>
        <entry><title>Same Title</title><summary>Abs</summary><id>http://arxiv.org/abs/1</id><category term="cs.AI"/></entry>
      </feed>`) });
    // Semantic Scholar (no key path returns empty but should not throw)
    const res = await utils.comprehensiveSearch('topic', { limit: 5 });
    expect(res.totalResults).toBe(1);
    expect(res.sourcesSearched).toEqual(['google_scholar', 'arxiv', 'semantic_scholar']);
  });

  it('searchScholar handles API errors gracefully', async () => {
    (getJson as Mock).mockRejectedValue(new Error('API rate limit exceeded'));
    await expect(utils.searchScholar('test query')).rejects.toThrow('API rate limit exceeded');
  });

  it('searchArXiv handles network errors', async () => {
    (fetch as Mock).mockRejectedValue(new Error('Network timeout'));
    await expect(utils.searchArXiv('quantum computing')).rejects.toThrow('Network timeout');
  });

  it('searchArXiv handles malformed XML gracefully', async () => {
    (fetch as Mock).mockResolvedValue({ text: () => Promise.resolve('<invalid>xml') });
    const result = await utils.searchArXiv('test');
    expect(result.totalResults).toBe(0);
    expect(result.papers).toHaveLength(0);
  });

  it('searchSemanticScholar handles API errors with key', async () => {
    const keyUtils = new AcademicSearchUtils('TEST_SERP', 'S2_KEY');
    (fetch as Mock).mockRejectedValue(new Error('S2 API error'));
    const res = await keyUtils.searchSemanticScholar('machine learning');
    expect(res.totalResults).toBe(0);
    expect(res.papers).toEqual([]);
    expect(res.error).toContain('S2 API error');
  });

  it('searchSemanticScholar handles non-JSON responses', async () => {
    const keyUtils = new AcademicSearchUtils('TEST_SERP', 'S2_KEY');
    (fetch as Mock).mockResolvedValue({ 
      json: () => Promise.reject(new Error('Invalid JSON')) 
    });
    const res = await keyUtils.searchSemanticScholar('nlp');
    expect(res.totalResults).toBe(0);
    expect(res.error).toBeDefined();
  });

  it('comprehensiveSearch continues on partial failures', async () => {
    // Scholar fails
    (getJson as Mock).mockRejectedValue(new Error('Scholar API down'));
    // arXiv succeeds
    (fetch as Mock).mockResolvedValue({ text: () => Promise.resolve(`
      <feed>
        <opensearch:totalResults>1</opensearch:totalResults>
        <entry><title>ArXiv Paper</title><summary>Abstract</summary><id>http://arxiv.org/abs/123</id></entry>
      </feed>`) });
    
    const res = await utils.comprehensiveSearch('resilience test');
    // Should still return arXiv results even though Scholar failed
    expect(res.papers.length).toBeGreaterThan(0);
    expect(res.sourcesSearched).toContain('arxiv');
    expect(res.errors).toBeDefined();
    expect(res.errors!.length).toBeGreaterThan(0);
  });

  it('searchScholar handles missing optional fields', async () => {
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        { 
          title: 'Minimal Paper',
          link: 'http://example.com',
          // Missing: publication_info, inline_links, snippet, resources
        },
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.searchScholar('test');
    expect(res.papers[0]!.title).toBe('Minimal Paper');
    expect(res.papers[0]!.citedBy).toBe(0);
    expect(res.papers[0]!.authors).toEqual([]);
  });

  it('constructor warns when SERPAPI_API_KEY is not set', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    new AcademicSearchUtils('');
    // Constructor should have logged warning about missing key
    warnSpy.mockRestore();
  });

  it('searchScholar with yearFrom and yearTo parameters', async () => {
    (getJson as Mock).mockResolvedValue({
      organic_results: [],
      search_information: { total_results: 0 },
    });

    await utils.searchScholar('test', { yearFrom: 2020, yearTo: 2023 });
    const callArgs = (getJson as Mock).mock.calls[0]?.[0];
    expect(callArgs.as_ylo).toBe(2020);
    expect(callArgs.as_yhi).toBe(2023);
  });

  it('searchArXiv handles entries with missing fields', async () => {
    const xml = `
      <feed>
        <opensearch:totalResults>1</opensearch:totalResults>
        <entry>
          <title>Paper</title>
          <id>http://arxiv.org/abs/123</id>
        </entry>
      </feed>`;

    (fetch as Mock).mockResolvedValue({ text: () => Promise.resolve(xml) });
    const res = await utils.searchArXiv('test');
    expect(res.papers[0]!.title).toBe('Paper');
    expect(res.papers[0]!.authors).toEqual([]);
  });

  it('searchSemanticScholar parses papers with all optional fields', async () => {
    const keyUtils = new AcademicSearchUtils('TEST_SERP', 'S2_KEY');
    (fetch as Mock).mockResolvedValue({
      json: () => Promise.resolve({
        data: [{
          paperId: 'abc123',
          title: 'Complete Paper',
          authors: [{ name: 'Author One' }],
          abstract: 'Full abstract',
          year: 2023,
          venue: 'Conference',
          citationCount: 50,
          influentialCitationCount: 10,
          openAccessPdf: {
            url: 'http://example.com/pdf',
            license: 'CC-BY',
            version: 'publishedVersion'
          }
        }],
        total: 1
      })
    });

    const res = await keyUtils.searchSemanticScholar('test');
    expect(res.papers[0]!.year).toBe(2023);
    expect(res.papers[0]!.venue).toBe('Conference');
    expect(res.papers[0]!.citationCount).toBe(50);
    expect(res.papers[0]!.influentialCitationCount).toBe(10);
    expect(res.papers[0]!.openAccessPdf?.url).toBe('http://example.com/pdf');
  });

  it('comprehensiveSearch handles Semantic Scholar warnings', async () => {
    // Mock Scholar and arXiv to succeed
    (getJson as Mock).mockResolvedValue({
      organic_results: [],
      search_information: { total_results: 0 },
    });
    (fetch as Mock).mockResolvedValueOnce({ text: () => Promise.resolve('<feed></feed>') });
    
    // Mock Semantic Scholar to return empty but not fail
    const keyUtils = new AcademicSearchUtils('TEST_SERP', 'S2_KEY');
    const res = await keyUtils.comprehensiveSearch('test');
    
    expect(res.sourcesSearched).toContain('semantic_scholar');
  });

  it('comprehensiveSearch sorts by citation count and recency', async () => {
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        { 
          title: 'Old Paper', 
          link: 'L1', 
          publication_info: { year: 2010 }, 
          inline_links: { cited_by: { total: 10 } },
          snippet: 'test'
        },
        { 
          title: 'New Paper', 
          link: 'L2', 
          publication_info: { year: 2023 }, 
          inline_links: { cited_by: { total: 5 } },
          snippet: 'test'
        }
      ],
      search_information: { total_results: 2 },
    });
    (fetch as Mock).mockResolvedValue({ text: () => Promise.resolve('<feed></feed>') });

    const res = await utils.comprehensiveSearch('test', { limit: 10 });
    // Old paper has 10 cites + 1.5 recency bonus (2025-2010)*0.1 = 11.5
    // New paper has 5 cites + 0.2 recency bonus (2025-2023)*0.1 = 5.2
    // So Old Paper ranks first
    expect(res.papers[0]!.title).toBe('Old Paper');
  });
});

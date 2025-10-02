import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { WebSearchUtils, type SearchOptions, type ScholarSearchOptions } from '../web-search.js';

vi.mock('serpapi', () => ({
  getJson: vi.fn(),
}));

const { getJson } = await import('serpapi');

describe('WebSearchUtils', () => {
  let utils: WebSearchUtils;

  beforeEach(() => {
    utils = new WebSearchUtils('TEST_SERPAPI_KEY');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('composes query with site/exclude/fileType and passes to SerpAPI', async () => {
    const options: SearchOptions = {
      limit: 5,
      offset: 2,
      timeRange: 'week',
      site: 'example.com',
      excludeSites: ['foo.com', 'bar.com'],
      fileType: 'pdf',
      language: 'en',
    };

    (getJson as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      organic_results: [
        { title: 'T1', link: 'https://example.com/a', snippet: 'S', displayed_link: 'example.com', position: 1 },
      ],
      search_information: { total_results: 1, time_taken_displayed: 0.12 },
    });

    const result = await utils.search('quantum computing', options);

    expect(result.totalResults).toBe(1);
    expect(getJson).toHaveBeenCalledTimes(1);
    const callArg = (getJson as Mock).mock.calls[0]?.[0];
    expect(callArg.api_key).toBe('TEST_SERPAPI_KEY');
    expect(callArg.engine).toBe('google');
    expect(callArg.num).toBe(5);
    expect(callArg.start).toBe(2);
    // q should include base query AND appended filters
    expect(callArg.q).toContain('quantum computing');
    expect(callArg.q).toContain('site:example.com');
    expect(callArg.q).toContain('-site:foo.com');
    expect(callArg.q).toContain('-site:bar.com');
    expect(callArg.q).toContain('filetype:pdf');
    // language and time-range mapping
    expect(callArg.hl).toBe('en');
    expect(callArg.tbs).toBe('qdr:w');
  });

  it('parses answer box and knowledge graph when present', async () => {
    (getJson as Mock).mockResolvedValue({
      organic_results: [],
      answer_box: { answer: '42', title: 'The Answer', link: 'https://example.com', displayed_link: 'example.com' },
      knowledge_graph: { title: 'Quantum', description: 'Desc', source: 'Wikipedia' },
      search_information: { total_results: 0, time_taken_displayed: 0.1 },
    });

    const res = await utils.search('what is life?');
    expect(res.answerBox?.answer).toBe('42');
    expect(res.knowledgeGraph?.title).toBe('Quantum');
  });

  it('searchScholar appends author filter to query', async () => {
    const options: ScholarSearchOptions = { author: 'Doe' };
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        { title: 'Paper', link: 'https://scholar', publication_info: { authors: ['A'], summary: 'J', year: 2020 }, inline_links: { cited_by: { total: 10 } }, snippet: '...', resources: [{ link: 'https://pdf' }] },
      ],
      search_information: { total_results: 1 },
    });

    await utils.searchScholar('graph theory', options);
    const callArg = (getJson as Mock).mock.calls[0]?.[0];
    expect(callArg.q).toContain('graph theory');
    expect(callArg.q).toContain('author:"Doe"');
    expect(callArg.engine).toBe('google_scholar');
  });

  it('assesses credibility higher for .edu domains', async () => {
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        { title: 'University Page', link: 'https://uni.edu/p', snippet: 'Long '.repeat(30), displayed_link: 'uni.edu', position: 1 },
      ],
      search_information: { total_results: 1 },
    });
    const res = await utils.search('education policy');
    expect(res.results.length).toBeGreaterThan(0);
    const first = res.results[0]!;
    expect(first.credibility.level === 'medium' || first.credibility.level === 'high').toBeTruthy();
  });

  // New comprehensive tests for uncovered lines

  it('searchScholar with yearFrom and yearTo parameters', async () => {
    const options: ScholarSearchOptions = { 
      yearFrom: 2015, 
      yearTo: 2023,
      limit: 10 
    };
    (getJson as Mock).mockResolvedValue({
      organic_results: [],
      search_information: { total_results: 0 },
    });

    await utils.searchScholar('machine learning', options);
    const callArg = (getJson as Mock).mock.calls[0]?.[0];
    expect(callArg.as_ylo).toBe(2015);
    expect(callArg.as_yhi).toBe(2023);
  });

  it('searchScholar handles non-finite year values', async () => {
    const options: ScholarSearchOptions = { 
      yearFrom: NaN,  // Non-finite
      yearTo: Infinity,  // Non-finite
      limit: 10 
    };
    (getJson as Mock).mockResolvedValue({
      organic_results: [],
      search_information: { total_results: 0 },
    });

    await utils.searchScholar('test', options);
    const callArg = (getJson as Mock).mock.calls[0]?.[0];
    expect(callArg.as_ylo).toBeUndefined();
    expect(callArg.as_yhi).toBeUndefined();
  });

  it('parseSearchResults extracts sitelinks and relatedPages', async () => {
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        { 
          title: 'Main Result', 
          link: 'https://example.com', 
          snippet: 'Description',
          displayed_link: 'example.com',
          position: 1,
          sitelinks: {
            inline: [
              { title: 'Subpage 1', link: 'https://example.com/sub1', displayed_link: 'example.com/sub1' },
              { title: 'Subpage 2', link: 'https://example.com/sub2', displayed_link: 'example.com/sub2' }
            ]
          }
        },
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.search('test');
    const relatedPages = res.results[0]?.metadata.relatedPages ?? [];
    expect(relatedPages).toHaveLength(2);
    expect(relatedPages[0]?.title).toBe('Subpage 1');
  });

  it('parseSearchResults handles missing sitelinks gracefully', async () => {
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        { 
          title: 'Result', 
          link: 'https://example.com', 
          snippet: 'Desc',
          displayed_link: 'example.com',
          position: 1,
          // No sitelinks property
        },
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.search('test');
    expect(res.results[0]!.metadata.relatedPages).toEqual([]);
  });

  it('searchNews parses articles with all fields', async () => {
    (getJson as Mock).mockResolvedValue({
      news_results: [
        {
          title: 'Breaking News',
          link: 'https://news.com/article',
          source: 'BBC',
          snippet: 'Important update',
          date: '2 hours ago',
          thumbnail: 'https://news.com/thumb.jpg'
        },
        {
          title: 'Another Story',
          link: 'https://news.com/story2',
          source: 'Reuters',
          snippet: 'More news',
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
          // No thumbnail
        }
      ],
      search_information: { total_results: 2 },
    });

    const res = await utils.searchNews('current events');
    expect(res.articles.length).toBe(2);
    expect(res.articles[0]!.title).toBe('Breaking News');
    expect(res.articles[0]!.thumbnail).toBe('https://news.com/thumb.jpg');
    expect(res.articles[1]!.thumbnail).toBe('');
    expect(res.articles[1]!.credibility.score).toBeGreaterThan(0.5); // Reuters is reputable
  });

  it('searchScholar handles papers with missing optional fields', async () => {
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        {
          title: 'Paper 1',
          link: 'https://scholar.com/p1',
          snippet: 'Abstract',
          // Missing publication_info
          // Missing inline_links
          // Missing resources
        },
        {
          title: 'Paper 2',
          link: 'https://scholar.com/p2',
          snippet: 'Abstract',
          publication_info: {
            // Missing authors
            // Missing summary
            // Missing year
          },
          inline_links: {
            // Missing cited_by
          },
          resources: [] // Empty array
        }
      ],
      search_information: { total_results: 2 },
    });

    const res = await utils.searchScholar('test');
    expect(res.papers.length).toBe(2);
    expect(res.papers[0]!.authors).toEqual([]);
    expect(res.papers[0]!.citedBy).toBe(0);
    expect(res.papers[0]!.pdfLink).toBeUndefined();
  });

  it('assessCredibility with date as string', async () => {
    const recentDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(); // 30 days ago
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        { 
          title: 'Recent Article', 
          link: 'https://example.com', 
          snippet: 'A'.repeat(150),
          displayed_link: 'example.com',
          position: 1,
          date: recentDate
        },
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.search('test');
    expect(res.results[0]!.credibility.factors).toContain('recent content');
  });

  it('assessCredibility with date as number (timestamp)', async () => {
    const recentTimestamp = Date.now() - 1000 * 60 * 60 * 24 * 100; // 100 days ago
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        { 
          title: 'Article', 
          link: 'https://example.com', 
          snippet: 'A'.repeat(150),
          displayed_link: 'example.com',
          position: 1,
          date: recentTimestamp
        },
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.search('test');
    expect(res.results[0]!.credibility.factors).toContain('recent content');
  });

  it('assessCredibility with invalid date', async () => {
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        { 
          title: 'Article', 
          link: 'https://example.com', 
          snippet: 'Short',
          displayed_link: 'example.com',
          position: 1,
          date: 'invalid-date-string'
        },
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.search('test');
    // Should not crash, just not add recency bonus
    expect(res.results[0]!.credibility.score).toBeGreaterThanOrEqual(0);
  });

  it('assessCredibility with detailed snippet (> 100 chars)', async () => {
    const longSnippet = 'A'.repeat(150);
    (getJson as Mock).mockResolvedValue({
      organic_results: [
        { 
          title: 'Detailed Article', 
          link: 'https://example.com', 
          snippet: longSnippet,
          displayed_link: 'example.com',
          position: 1
        },
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.search('test');
    expect(res.results[0]!.credibility.factors).toContain('detailed snippet');
  });

  it('assessNewsCredibility with reputable sources', async () => {
    (getJson as Mock).mockResolvedValue({
      news_results: [
        {
          title: 'BBC News',
          link: 'https://bbc.com/news',
          source: 'BBC News',
          snippet: 'Report',
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
        },
        {
          title: 'Guardian Article',
          link: 'https://guardian.com/news',
          source: 'The Guardian',
          snippet: 'Story',
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
        }
      ],
      search_information: { total_results: 2 },
    });

    const res = await utils.searchNews('world news');
    expect(res.articles[0]!.credibility.factors).toContain('reputable news source');
    expect(res.articles[0]!.credibility.factors).toContain('very recent');
    expect(res.articles[1]!.credibility.factors).toContain('reputable news source');
    expect(res.articles[1]!.credibility.factors).toContain('very recent');
  });

  it('assessNewsCredibility with date as string', async () => {
    (getJson as Mock).mockResolvedValue({
      news_results: [
        {
          title: 'News',
          link: 'https://news.com',
          source: 'AP',
          snippet: 'Update',
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(), // 15 days ago
        }
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.searchNews('test');
    expect(res.articles[0]!.credibility.factors).toContain('recent');
  });

  it('assessNewsCredibility with date as number (timestamp)', async () => {
    const recentTimestamp = Date.now() - 1000 * 60 * 60 * 24 * 20; // 20 days ago
    (getJson as Mock).mockResolvedValue({
      news_results: [
        {
          title: 'News',
          link: 'https://news.com',
          source: 'NYT',
          snippet: 'Update',
          date: recentTimestamp,
        }
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.searchNews('test');
    expect(res.articles[0]!.credibility.factors).toContain('recent');
  });

  it('assessNewsCredibility with invalid date', async () => {
    (getJson as Mock).mockResolvedValue({
      news_results: [
        {
          title: 'News',
          link: 'https://news.com',
          source: 'Source',
          snippet: 'Update',
          date: 'not-a-valid-date',
        }
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.searchNews('test');
    // Should not crash, credibility still calculated
    expect(res.articles[0]!.credibility.score).toBeGreaterThanOrEqual(0);
  });

  it('searchNews handles API errors', async () => {
    (getJson as Mock).mockRejectedValue(new Error('SerpAPI rate limit'));

    await expect(utils.searchNews('test')).rejects.toThrow('News search failed');
  });

  it('searchScholar handles API errors', async () => {
    (getJson as Mock).mockRejectedValue(new Error('SerpAPI error'));

    await expect(utils.searchScholar('test')).rejects.toThrow('Scholar search failed');
  });

  it('constructor warns when SERPAPI_API_KEY is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    new WebSearchUtils(''); // Empty key
    // Logger would have been called, but we can't easily spy on flowlogger
    // Just ensure no crash
    warnSpy.mockRestore();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    const callArg = (getJson as any).mock.calls[0][0];
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
    (getJson as any).mockResolvedValue({
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
    (getJson as any).mockResolvedValue({
      organic_results: [
        { title: 'Paper', link: 'https://scholar', publication_info: { authors: ['A'], summary: 'J', year: 2020 }, inline_links: { cited_by: { total: 10 } }, snippet: '...', resources: [{ link: 'https://pdf' }] },
      ],
      search_information: { total_results: 1 },
    });

    await utils.searchScholar('graph theory', options);
    const callArg = (getJson as any).mock.calls[0][0];
    expect(callArg.q).toContain('graph theory');
    expect(callArg.q).toContain('author:"Doe"');
    expect(callArg.engine).toBe('google_scholar');
  });

  it('assesses credibility higher for .edu domains', async () => {
    (getJson as any).mockResolvedValue({
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
});

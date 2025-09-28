import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    const opts: ScholarSearchOptions = { author: 'Doe', venue: 'Nature', limit: 2 } as any;
    (getJson as any).mockResolvedValue({
      organic_results: [
        { title: 'P', link: 'L', publication_info: { authors: ['A'], summary: 'Summ', year: 2021 }, inline_links: { cited_by: { total: 5 } }, snippet: '...', resources: [{ link: 'pdf' }] },
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.searchScholar('climate change', opts as any);
    expect(res.totalResults).toBe(1);
    const arg = (getJson as any).mock.calls[0][0];
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

    (fetch as any).mockResolvedValue({ text: () => Promise.resolve(xml) });
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
    (getJson as any).mockResolvedValueOnce({
      organic_results: [
        { title: 'Same Title', link: 'L1', publication_info: { authors: ['A'], summary: 'S', year: 2018 }, inline_links: { cited_by: { total: 5 } }, snippet: '...' },
      ],
      search_information: { total_results: 1 },
    });
    // arXiv
    (fetch as any).mockResolvedValueOnce({ text: () => Promise.resolve(`
      <feed>
        <entry><title>Same Title</title><summary>Abs</summary><id>http://arxiv.org/abs/1</id><category term="cs.AI"/></entry>
      </feed>`) });
    // Semantic Scholar (no key path returns empty but should not throw)
    const res = await utils.comprehensiveSearch('topic', { limit: 5 });
    expect(res.totalResults).toBe(1);
    expect(res.sourcesSearched).toEqual(['google_scholar', 'arxiv', 'semantic_scholar']);
  });
});

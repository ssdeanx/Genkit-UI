import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { NewsSearchUtils, type GoogleNewsOptions } from '../news-search.js';

vi.mock('serpapi', () => ({ getJson: vi.fn() }));

const { getJson } = await import('serpapi');

describe('NewsSearchUtils', () => {
  let utils: NewsSearchUtils;

  beforeEach(() => {
    utils = new NewsSearchUtils('TEST_SERP', undefined);
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error cleanup
    global.fetch = undefined;
  });

  it('searchGoogleNews composes params and parses results', async () => {
    const opts: GoogleNewsOptions = { limit: 3, timeRange: 'day', location: 'US', language: 'en' };
    (getJson as Mock).mockResolvedValue({
      news_results: [
        { title: 'A', link: 'https://a', source: 'BBC', snippet: '...', date: new Date().toISOString(), thumbnail: 't' },
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.searchGoogleNews('elections', opts);
    expect(getJson).toHaveBeenCalledTimes(1);
    const arg = (getJson as Mock).mock.calls[0]?.[0];
    expect(arg.engine).toBe('google_news');
    expect(arg.num).toBe(3);
    expect(arg.tbs).toBe('qdr:d');
    expect(arg.location).toBe('US');
    expect(arg.hl).toBe('en');
  expect(res.articles.length).toBeGreaterThan(0);
  expect(res.articles[0]!.source).toBe('BBC');
  });

  it('searchNewsAPI without key returns empty result and error', async () => {
    const noKeyUtils = new NewsSearchUtils('TEST_SERP'); // no NewsAPI key
    const res = await noKeyUtils.searchNewsAPI('topic');
    expect(res.totalResults).toBe(0);
    expect(res.articles).toEqual([]);
    expect(res.error).toBeDefined();
  });

  it('comprehensiveNewsSearch merges sources and de-duplicates', async () => {
    (getJson as Mock).mockResolvedValue({
      news_results: [
        { title: 'Same', link: 'https://x', source: 'BBC', snippet: '...', date: new Date().toISOString() },
        { title: 'Same', link: 'https://x', source: 'BBC', snippet: '...', date: new Date().toISOString() },
      ],
      search_information: { total_results: 2 },
    });

    const res = await utils.comprehensiveNewsSearch('merger', { limit: 10 });
    expect(res.totalResults).toBe(1);
    expect(res.sourcesSearched).toContain('google_news');
  });

  it('getTrendingTopics parses top stories and ranking', async () => {
    (getJson as Mock).mockResolvedValue({
      news_results: [
        { title: 'T1', stories: [{ title: 'S1', link: 'https://s1', source: 'Reuters' }] },
        { title: 'T2', stories: [] },
      ],
    });

    const trending = await utils.getTrendingTopics({ limit: 2 });
    expect(trending.topics.length).toBeGreaterThan(0);
  expect(trending.topics.length).toBeGreaterThan(0);
  expect(trending.topics[0]!.topStory?.source).toBe('Reuters');
  });

  // New comprehensive tests for uncovered lines

  it('searchNewsAPI with from and to date parameters', async () => {
    const keyUtils = new NewsSearchUtils('TEST_SERP', 'NEWS_KEY');
    (fetch as Mock).mockResolvedValue({
      json: () => Promise.resolve({
        status: 'ok',
        totalResults: 0,
        articles: []
      })
    });

    await keyUtils.searchNewsAPI('test', { 
      from: '2024-01-01', 
      to: '2024-12-31',
      limit: 5 
    });

    const callUrl = (fetch as Mock).mock.calls[0]?.[0] as string;
    expect(callUrl).toContain('from=2024-01-01');
    expect(callUrl).toContain('to=2024-12-31');
  });

  it('searchNewsAPI handles empty from and to parameters', async () => {
    const keyUtils = new NewsSearchUtils('TEST_SERP', 'NEWS_KEY');
    (fetch as Mock).mockResolvedValue({
      json: () => Promise.resolve({
        status: 'ok',
        totalResults: 0,
        articles: []
      })
    });

    await keyUtils.searchNewsAPI('test', { 
      from: '',  // Empty string
      to: '   ', // Whitespace only
      limit: 5 
    });

    const callUrl = (fetch as Mock).mock.calls[0]?.[0] as string;
    expect(callUrl).not.toContain('from=');
    expect(callUrl).not.toContain('to=');
  });

  it('searchNewsAPI parses NewsAPI results correctly', async () => {
    const keyUtils = new NewsSearchUtils('TEST_SERP', 'NEWS_KEY');
    (fetch as Mock).mockResolvedValue({
      json: () => Promise.resolve({
        status: 'ok',
        totalResults: 2,
        articles: [
          {
            title: 'Test Article',
            url: 'https://example.com/article',
            source: { name: 'Test Source' },
            description: 'Test description',
            publishedAt: new Date().toISOString(),
            urlToImage: 'https://example.com/image.jpg'
          },
          {
            title: 'Another Article',
            url: 'https://example.com/article2',
            source: { name: 'Another Source' },
            description: 'Another description',
            publishedAt: new Date().toISOString()
            // No urlToImage
          }
        ]
      })
    });

    const result = await keyUtils.searchNewsAPI('test');
    expect(result.articles.length).toBe(2);
    expect(result.articles[0]!.title).toBe('Test Article');
    expect(result.articles[0]!.source).toBe('Test Source');
    expect(result.articles[0]!.urlToImage).toBe('https://example.com/image.jpg');
    expect(result.articles[1]!.urlToImage).toBeUndefined();
  });

  it('getTrendingTopics with region and language parameters', async () => {
    (getJson as Mock).mockResolvedValue({ news_results: [] });

    await utils.getTrendingTopics({ 
      region: 'US', 
      language: 'en',
      limit: 5 
    });

    const callArgs = (getJson as Mock).mock.calls[0]?.[0];
    expect(callArgs.location).toBe('US');
    expect(callArgs.hl).toBe('en');
  });

  it('getTrendingTopics handles empty region and language', async () => {
    (getJson as Mock).mockResolvedValue({ news_results: [] });

    await utils.getTrendingTopics({ 
      region: '   ',  // Whitespace
      language: '',   // Empty
      limit: 5 
    });

    const callArgs = (getJson as Mock).mock.calls[0]?.[0];
    expect(callArgs.location).toBeUndefined();
    expect(callArgs.hl).toBeUndefined();
  });

  it('getTrendingTopics handles API errors', async () => {
    (getJson as Mock).mockRejectedValue(new Error('SerpAPI error'));

    await expect(utils.getTrendingTopics()).rejects.toThrow('Trending topics fetch failed');
  });

  it('assessNewsCredibility with very recent article (< 1 day)', () => {
    const article = {
      title: 'Breaking News',
      link: 'http://example.com',
      source: 'Reuters',
      snippet: 'Important news',
      publishedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    };

    const result = utils['assessNewsCredibility'](article);
    expect(result.score).toBeGreaterThan(0.3);
    expect(result.factors).toContain('very recent (< 1 day)');
  });

  it('assessNewsCredibility with recent article (< 3 days)', () => {
    const article = {
      title: 'News',
      link: 'http://example.com',
      source: 'BBC',
      snippet: 'Article',
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    };

    const result = utils['assessNewsCredibility'](article);
    expect(result.factors).toContain('recent (< 3 days)');
  });

  it('assessNewsCredibility with weekly article (< 7 days)', () => {
    const article = {
      title: 'News',
      link: 'http://example.com',
      source: 'CNN',
      snippet: 'Article',
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
    };

    const result = utils['assessNewsCredibility'](article);
    expect(result.factors).toContain('recent (< 1 week)');
  });

  it('assessNewsCredibility with published as Date object', () => {
    const article = {
      title: 'News',
      link: 'http://example.com',
      source: 'AP',
      snippet: 'Article',
      published: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    };

    const result = utils['assessNewsCredibility'](article);
    expect(result.score).toBeGreaterThan(0);
    expect(result.factors).toContain('very recent (< 1 day)');
  });

  it('assessNewsCredibility with publishedAt as timestamp', () => {
    const article = {
      title: 'News',
      link: 'http://example.com',
      source: 'NYT',
      snippet: 'Article',
      publishedAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago as timestamp
    };

    const result = utils['assessNewsCredibility'](article);
    expect(result.factors).toContain('recent (< 3 days)');
  });

  it('assessNewsCredibility with published as timestamp', () => {
    const article = {
      title: 'News',
      link: 'http://example.com',
      source: 'WSJ',
      snippet: 'Article',
      published: Date.now() - 1000 * 60 * 60 * 24 * 4, // 4 days ago as timestamp
    };

    const result = utils['assessNewsCredibility'](article);
    expect(result.factors).toContain('recent (< 1 week)');
  });

  it('assessNewsCredibility with detailed content (> 200 chars)', () => {
    const longSnippet = 'a'.repeat(250);
    const article = {
      title: 'Detailed Article',
      link: 'http://example.com',
      source: 'Guardian',
      snippet: longSnippet,
      publishedAt: new Date().toISOString(),
    };

    const result = utils['assessNewsCredibility'](article);
    expect(result.factors).toContain('detailed content');
  });

  it('assessNewsCredibility with invalid date strings', () => {
    const article = {
      title: 'News',
      link: 'http://example.com',
      source: 'Source',
      snippet: 'Article',
      publishedAt: 'invalid-date-string',
    };

    const result = utils['assessNewsCredibility'](article);
    // Should not crash, just not add recency bonus
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('searchNewsAPI handles API error responses', async () => {
    const keyUtils = new NewsSearchUtils('TEST_SERP', 'NEWS_KEY');
    (fetch as Mock).mockRejectedValue(new Error('Network timeout'));

    const res = await keyUtils.searchNewsAPI('test');
    expect(res.totalResults).toBe(0);
    expect(res.articles).toEqual([]);
    expect(res.error).toContain('Network timeout');
  });

  it('searchGoogleNews handles API errors', async () => {
    (getJson as Mock).mockRejectedValue(new Error('SerpAPI rate limit'));

    await expect(utils.searchGoogleNews('test')).rejects.toThrow('Google News search failed');
  });

  it('comprehensiveNewsSearch handles partial source failures', async () => {
    // Google News fails
    (getJson as Mock).mockRejectedValue(new Error('SerpAPI error'));
    
    // NewsAPI not configured (no key), so it returns empty
    const res = await utils.comprehensiveNewsSearch('resilience test');
    
    // Should handle gracefully and return what's available
    expect(res.sourcesSearched).toBeDefined();
    expect(res.errors).toBeDefined();
  });
});

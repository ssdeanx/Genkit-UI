import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NewsSearchUtils, type GoogleNewsOptions } from '../news-search.js';

vi.mock('serpapi', () => ({ getJson: vi.fn() }));

const { getJson } = await import('serpapi');

describe('NewsSearchUtils', () => {
  let utils: NewsSearchUtils;

  beforeEach(() => {
    utils = new NewsSearchUtils('TEST_SERP', undefined);
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it('searchGoogleNews composes params and parses results', async () => {
    const opts: GoogleNewsOptions = { limit: 3, timeRange: 'day', location: 'US', language: 'en' };
    (getJson as any).mockResolvedValue({
      news_results: [
        { title: 'A', link: 'https://a', source: 'BBC', snippet: '...', date: new Date().toISOString(), thumbnail: 't' },
      ],
      search_information: { total_results: 1 },
    });

    const res = await utils.searchGoogleNews('elections', opts);
    expect(getJson).toHaveBeenCalledTimes(1);
    const arg = (getJson as any).mock.calls[0][0];
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
    (getJson as any).mockResolvedValue({
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
    (getJson as any).mockResolvedValue({
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
});

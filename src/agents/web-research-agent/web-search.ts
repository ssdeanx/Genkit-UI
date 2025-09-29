import { getJson } from 'serpapi';
import { flowlogger } from '../../logger.js';

/**
 * Web Search Utilities for the Web Research Agent
 * Provides search capabilities using SerpAPI for comprehensive web research
 */
export class WebSearchUtils {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.SERPAPI_API_KEY ?? '';
    if (!this.apiKey) {
      flowlogger.warn('SERPAPI_API_KEY not set. Web search functionality will be limited.');
    }
  }

  // Helper: safely convert unknown to string
  private asString(val: unknown): string {
    return val === undefined || val === null ? '' : String(val);
  }

  // Helper: safely convert unknown to number with fallback
  private asNumber(val: unknown, fallback = 0): number {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  /**
   * Perform a comprehensive web search
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    try {
      const searchParams = {
        q: query,
        api_key: this.apiKey,
        engine: 'google',
        num: options.limit ?? 10,
        start: options.offset ?? 0,
        ...this.buildAdvancedParams(options, query)
      };

      flowlogger.info(`Performing web search for: "${query}"`);
      const results = await getJson(searchParams);

      return this.parseSearchResults(results, query);
    } catch (error) {
      flowlogger.error({ error }, 'Web search failed');
      throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for news articles
   */
  async searchNews(query: string, options: NewsSearchOptions = {}): Promise<NewsSearchResult> {
    try {
      const searchParams = {
        q: query,
        api_key: this.apiKey,
        engine: 'google_news',
        num: options.limit ?? 10,
        ...this.buildNewsParams(options)
      };

      flowlogger.info(`Performing news search for: "${query}"`);
      const results = await getJson(searchParams);

      return this.parseNewsResults(results, query);
    } catch (error) {
      flowlogger.error({ error }, 'News search failed');
      throw new Error(`News search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search academic/scholarly content
   */
  async searchScholar(query: string, options: ScholarSearchOptions = {}): Promise<ScholarSearchResult> {
    try {
      const searchParams = {
        q: query,
        api_key: this.apiKey,
        engine: 'google_scholar',
        num: options.limit ?? 10,
        ...this.buildScholarParams(options, query)
      };

      flowlogger.info(`Performing scholar search for: "${query}"`);
      const results = await getJson(searchParams);

      return this.parseScholarResults(results, query);
    } catch (error) {
      flowlogger.error({ error }, 'Scholar search failed');
      throw new Error(`Scholar search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build advanced search parameters
   */
  private buildAdvancedParams(options: SearchOptions, baseQuery: string): SerpApiParams {
    const params: SerpApiParams = {};
    let q = baseQuery;

    if (options.timeRange) {
      // Convert time range to SerpAPI format
      switch (options.timeRange) {
        case 'day': params.tbs = 'qdr:d'; break;
        case 'week': params.tbs = 'qdr:w'; break;
        case 'month': params.tbs = 'qdr:m'; break;
        case 'year': params.tbs = 'qdr:y'; break;
      }
    }

    // Only append site when it's a non-empty string
    if (typeof options.site === 'string' && options.site.trim() !== '') {
      q += ` site:${options.site.trim()}`;
    }

    // Exclude sites when provided as a non-empty array of strings
    if (Array.isArray(options.excludeSites) && options.excludeSites.length > 0) {
      options.excludeSites.forEach(site => {
        if (typeof site === 'string' && site.trim() !== '') {
          q += ` -site:${site.trim()}`;
        }
      });
    }

    if (typeof options.fileType === 'string' && options.fileType.trim() !== '') {
      q += ` filetype:${options.fileType.trim()}`;
    }

    if (typeof options.language === 'string' && options.language.trim() !== '') {
      params.hl = options.language.trim();
    }

    return { ...params, q };
  }

  /**
   * Build news search parameters
   */
  private buildNewsParams(options: NewsSearchOptions): SerpApiParams {
    const params: SerpApiParams = {};

    if (options.timeRange) {
      switch (options.timeRange) {
        case 'day': params.tbs = 'qdr:d'; break;
        case 'week': params.tbs = 'qdr:w'; break;
        case 'month': params.tbs = 'qdr:m'; break;
        case 'year': params.tbs = 'qdr:y'; break;
      }
    }

    if (typeof options.location === 'string' && options.location.trim() !== '') {
      params.location = options.location.trim();
    }

    return params;
  }

  /**
   * Build scholar search parameters
   */
  private buildScholarParams(options: ScholarSearchOptions, baseQuery: string): SerpApiParams {
    const params: SerpApiParams = {};
    let q = baseQuery;

    // Explicitly handle nullish/NaN/zero cases for numeric year filters.
    // Accept only finite numbers (including 0 if meaningful) and coerce to integers.
    if (options.yearFrom !== undefined && options.yearFrom !== null && Number.isFinite(options.yearFrom)) {
      params.as_ylo = Math.trunc(options.yearFrom);
    }

    if (options.yearTo !== undefined && options.yearTo !== null && Number.isFinite(options.yearTo)) {
      params.as_yhi = Math.trunc(options.yearTo);
    }

    if (typeof options.author === 'string' && options.author.trim() !== '') {
      q += ` author:"${options.author.trim()}"`;
    }

    return { ...params, q };
  }

  /**
   * Parse general search results
   */
  private parseSearchResults(results: SerpApiRawResults, query: string): SearchResult {
    const organicResults = results.organic_results ?? [];
    const answerBox = results.answer_box;
    const knowledgeGraph = results.knowledge_graph;

    const searchResults: WebResult[] = organicResults.map((result) => {
      const sitelinks = ((Boolean(result['sitelinks'])) && typeof result['sitelinks'] === 'object')
        ? ((result['sitelinks'] as Record<string, unknown>)['inline'] ?? [])
        : [];

      const relatedPages: RelatedPage[] = Array.isArray(sitelinks)
        ? (sitelinks as unknown[]).map(item => ({
            title: this.asString((item as Record<string, unknown>)['title']),
            link: this.asString((item as Record<string, unknown>)['link']),
            displayedLink: this.asString((item as Record<string, unknown>)['displayed_link'])
          }))
        : [];

      return {
        title: this.asString(result['title']),
        link: this.asString(result['link']),
        snippet: this.asString(result['snippet']),
        displayLink: this.asString(result['displayed_link']),
        rank: this.asNumber(result['position'], 0),
        credibility: this.assessCredibility(result),
        metadata: {
          cachedUrl: this.asString(result['cached_page_link']),
          relatedPages
        }
      };
    });

    const baseResult = {
      query,
      totalResults: this.asNumber(results.search_information?.total_results ?? searchResults.length),
      searchTime: this.asNumber(results.search_information?.time_taken_displayed ?? 0),
      results: searchResults,
    };

    const result: SearchResult = baseResult;

    if (answerBox) {
      result.answerBox = {
        answer: this.asString(answerBox['answer']),
        title: this.asString(answerBox['title']),
        link: this.asString(answerBox['link']),
        source: this.asString(answerBox['displayed_link'])
      };
    }

    if (knowledgeGraph) {
      result.knowledgeGraph = {
        title: this.asString(knowledgeGraph['title']),
        description: this.asString(knowledgeGraph['description']),
        source: this.asString(knowledgeGraph['source'])
      };
    }

    return result;
  }

  /**
   * Parse news search results
   */
  private parseNewsResults(results: SerpApiRawResults, query: string): NewsSearchResult {
    const newsResults = results.news_results ?? [];

    const articles: NewsArticle[] = (Array.isArray(newsResults) ? newsResults : []).map((article: NewsResult) => ({
      title: this.asString(article.title),
      link: this.asString(article.link),
      source: this.asString(article.source),
      snippet: this.asString(article.snippet),
      published: this.asString(article.date),
      thumbnail: this.asString(article.thumbnail),
      credibility: this.assessNewsCredibility(article)
    }));

    return {
      query,
      totalResults: this.asNumber(results.search_information?.total_results ?? articles.length),
      articles
    };
  }

  /**
   * Parse scholar search results
   */
  private parseScholarResults(results: SerpApiRawResults, query: string): ScholarSearchResult {
    // use ScholarRawPaper here so the ScholarRawPaper interface is actually referenced/checked by TS
    const scholarResults = (results.organic_results ?? []) as ScholarRawPaper[];

    const papers: ScholarPaper[] = (Array.isArray(scholarResults) ? scholarResults : []).map((paper) => {
      const pubInfo = ((Boolean(paper['publication_info'])) && typeof paper['publication_info'] === 'object')
        ? (paper['publication_info'] as Record<string, unknown>)
        : {};

      const inlineLinks = ((Boolean(paper['inline_links'])) && typeof paper['inline_links'] === 'object')
        ? (paper['inline_links'] as Record<string, unknown>)
        : {};

      const authors = Array.isArray(pubInfo['authors']) ? (pubInfo['authors'] as string[]) : [];
      const publication = this.asString(pubInfo['summary']);

      // Safely extract cited_by.total with explicit runtime checks to avoid using unknown in conditionals
      const citedByTotalRaw = (() => {
        const cb = inlineLinks['cited_by'];
        if ((Boolean(cb)) && typeof cb === 'object' && !Array.isArray(cb)) {
          const total = (cb as Record<string, unknown>)['total'];
          // accept numbers or numeric strings
          if (typeof total === 'number' || typeof total === 'string') {
            return total;
          }
        }
        return undefined;
      })();

      const citedBy = this.asNumber(citedByTotalRaw, 0);
      const yearVal = typeof pubInfo['year'] === 'number' ? (pubInfo['year']) : undefined;

      // safe extraction of first resource link (if present)
      let pdfLinkVal: string | undefined;
      if (Array.isArray(paper['resources']) && (paper['resources'] as unknown[]).length > 0) {
        const first = (paper['resources'] as unknown[])[0] as Record<string, unknown> | undefined;
        pdfLinkVal = first ? this.asString(first['link']) || undefined : undefined;
      }

      return {
        title: this.asString(paper['title']),
        link: this.asString(paper['link']),
        authors,
        publication,
        citedBy,
        snippet: this.asString(paper['snippet']),
        // only include optional props when defined to satisfy exactOptionalPropertyTypes
        ...(yearVal !== undefined ? { year: yearVal } : {}),
        ...(pdfLinkVal !== undefined ? { pdfLink: pdfLinkVal } : {})
      };
    });

    return {
      query,
      totalResults: this.asNumber(results.search_information?.total_results ?? papers.length),
      papers
    };
  }

  /**
   * Assess credibility of a web result
   */
  private assessCredibility(result: OrganicResult): CredibilityScore {
    let score = 0.5; // Base score
    const factors: string[] = [];

    const domain = this.asString(result.displayed_link).split('/')[0] ?? '';
    if (domain.includes('.edu') || domain.includes('.gov') || domain.includes('.org')) {
      score += 0.2;
      factors.push('educational/government domain');
    }

    // Type-guards for date to avoid using unknown in conditional
    const dateRaw = result.date;
    let dateVal: Date | undefined;
    if (typeof dateRaw === 'string' && dateRaw.trim() !== '') {
      dateVal = new Date(dateRaw);
    } else if (typeof dateRaw === 'number' && Number.isFinite(dateRaw)) {
      dateVal = new Date(dateRaw);
    }

    if (dateVal && !Number.isNaN(dateVal.getTime())) {
      const daysSincePublished = (Date.now() - dateVal.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublished < 365) {
        score += 0.1;
        factors.push('recent content');
      }
    }

    if (this.asString(result.snippet).length > 100) {
      score += 0.1;
      factors.push('detailed snippet');
    }

    const finalScore = Math.min(1.0, Math.max(0.0, score));
    return {
      score: finalScore,
      factors,
      level: finalScore > 0.8 ? 'high' : finalScore > 0.6 ? 'medium' : 'low'
    };
  }

  /**
   * Assess credibility of a news article
   */
  private assessNewsCredibility(article: NewsResult): CredibilityScore {
    let score = 0.5;
    const factors: string[] = [];

    const reputableSources = ['bbc', 'reuters', 'ap', 'nyt', 'washingtonpost', 'guardian'];
    const source = this.asString(article.source).toLowerCase();
    if (reputableSources.some(rep => source.includes(rep))) {
      score += 0.3;
      factors.push('reputable news source');
    }

    // Explicit runtime type-guards for article date
    const dateRaw = article.date;
    let dateVal: Date | undefined;
    if (typeof dateRaw === 'string' && dateRaw.trim() !== '') {
      dateVal = new Date(dateRaw);
    } else if (typeof dateRaw === 'number' && Number.isFinite(dateRaw)) {
      dateVal = new Date(dateRaw);
    }

    if (dateVal && !Number.isNaN(dateVal.getTime())) {
      const daysSincePublished = (Date.now() - dateVal.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublished < 7) {
        score += 0.2;
        factors.push('very recent');
      } else if (daysSincePublished < 30) {
        score += 0.1;
        factors.push('recent');
      }
    }

    const finalScore = Math.min(1.0, Math.max(0.0, score));
    return {
      score: finalScore,
      factors,
      level: finalScore > 0.8 ? 'high' : finalScore > 0.6 ? 'medium' : 'low'
    };
  }
}

/**
 * Type definitions for web search functionality
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  site?: string;
  excludeSites?: string[];
  fileType?: string;
  language?: string;
}

export interface NewsSearchOptions {
  limit?: number;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  location?: string;
}

export interface ScholarSearchOptions {
  limit?: number;
  yearFrom?: number;
  yearTo?: number;
  author?: string;
}

export interface CredibilityScore {
  score: number; // 0-1
  level: 'high' | 'medium' | 'low';
  factors: string[];
}

export interface RelatedPage {
  title: string;
  link: string;
  displayedLink?: string;
}

export interface WebResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  rank: number;
  credibility: CredibilityScore;
  metadata: {
    cachedUrl?: string;
    relatedPages?: RelatedPage[];
  };
}

export interface SearchResult {
  query: string;
  totalResults: number;
  searchTime: number;
  results: WebResult[];
  answerBox?: {
    answer: string;
    title: string;
    link: string;
    source: string;
  };
  knowledgeGraph?: {
    title: string;
    description: string;
    source: string;
  };
}

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  snippet: string;
  published: string;
  thumbnail?: string;
  credibility: CredibilityScore;
}

export interface NewsSearchResult {
  query: string;
  totalResults: number;
  articles: NewsArticle[];
}

export interface ScholarPaper {
  title: string;
  link: string;
  authors: string[];
  publication: string;
  citedBy: number;
  year?: number;
  snippet: string;
  pdfLink?: string;
}

export interface ScholarSearchResult {
  query: string;
  totalResults: number;
  papers: ScholarPaper[];
}

// Replaced: a single broad SerpApiRawResults with precise, narrow interfaces
// to avoid unsafe `unknown` usage and to reflect the fields the parser uses.

interface SitelinkInline {
  title?: string;
  link?: string;
  displayed_link?: string;
}

interface OrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  displayed_link?: string;
  position?: number | string;
  cached_page_link?: string;
  sitelinks?: { inline?: SitelinkInline[] } | SitelinkInline[] | undefined;
  date?: string | number;
  resources?: Array<{ link?: string }>;
  publication_info?: {
    authors?: string[] | Array<{ name?: string }>;
    summary?: string;
    year?: number;
  } | Record<string, unknown>;
  inline_links?: {
    cited_by?: { total?: number | string } | Record<string, unknown>;
  } | Record<string, unknown>;
}

interface NewsResult {
  title?: string;
  link?: string;
  source?: string;
  snippet?: string;
  date?: string | number;
  thumbnail?: string;
}

interface ScholarRawPaper extends OrganicResult {
  // Scholar-specific enrichments we parse from SerpAPI scholar results
  publication_info?: {
    authors?: Array<string | { name?: string }>;
    summary?: string;
    year?: number;
  } | Record<string, unknown>;
  inline_links?: {
    cited_by?: { total?: number | string } | Record<string, unknown>;
  } | Record<string, unknown>;
  resources?: Array<{ link?: string }>;
}

interface AnswerBox {
  answer?: string;
  title?: string;
  link?: string;
  displayed_link?: string;
}

interface KnowledgeGraph {
  title?: string;
  description?: string;
  source?: string;
}

interface SearchInformation {
  total_results?: number | string;
  time_taken_displayed?: number | string;
}

/**
 * Narrow Serp API raw results modeled after the fields the parser reads.
 * Keeping many fields optional mirrors the reality of SerpAPI variability.
 */
interface SerpApiRawResults {
  [key: string]: unknown;
  organic_results?: OrganicResult[];
  news_results?: NewsResult[];
  answer_box?: AnswerBox;
  knowledge_graph?: KnowledgeGraph;
  search_information?: SearchInformation;
}

// keep existing params type (flexible for callers)
type SerpApiParams = Record<string, string | number | boolean | undefined>;

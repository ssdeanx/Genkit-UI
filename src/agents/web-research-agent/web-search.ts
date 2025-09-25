import { getJson } from 'serpapi';

/**
 * Web Search Utilities for the Web Research Agent
 * Provides search capabilities using SerpAPI for comprehensive web research
 */
export class WebSearchUtils {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.SERPAPI_API_KEY ?? '';
    if (!this.apiKey) {
      console.warn('SERPAPI_API_KEY not set. Web search functionality will be limited.');
    }
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
        ...this.buildAdvancedParams(options)
      };

      console.log(`Performing web search for: "${query}"`);
      const results = await getJson(searchParams);

      return this.parseSearchResults(results, query);
    } catch (error) {
      console.error('Web search failed:', error);
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

      console.log(`Performing news search for: "${query}"`);
      const results = await getJson(searchParams);

      return this.parseNewsResults(results, query);
    } catch (error) {
      console.error('News search failed:', error);
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
        ...this.buildScholarParams(options)
      };

      console.log(`Performing scholar search for: "${query}"`);
      const results = await getJson(searchParams);

      return this.parseScholarResults(results, query);
    } catch (error) {
      console.error('Scholar search failed:', error);
      throw new Error(`Scholar search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build advanced search parameters
   */
  private buildAdvancedParams(options: SearchOptions): Record<string, any> {
    const params: Record<string, any> = {};

    if (options.timeRange) {
      // Convert time range to SerpAPI format
      switch (options.timeRange) {
        case 'day': params.tbs = 'qdr:d'; break;
        case 'week': params.tbs = 'qdr:w'; break;
        case 'month': params.tbs = 'qdr:m'; break;
        case 'year': params.tbs = 'qdr:y'; break;
      }
    }

    if (options.site) {
      params.q += ` site:${options.site}`;
    }

    if (options.excludeSites) {
      options.excludeSites.forEach(site => {
        params.q += ` -site:${site}`;
      });
    }

    if (options.fileType) {
      params.q += ` filetype:${options.fileType}`;
    }

    if (options.language) {
      params.hl = options.language;
    }

    return params;
  }

  /**
   * Build news search parameters
   */
  private buildNewsParams(options: NewsSearchOptions): Record<string, any> {
    const params: Record<string, any> = {};

    if (options.timeRange) {
      switch (options.timeRange) {
        case 'day': params.tbs = 'qdr:d'; break;
        case 'week': params.tbs = 'qdr:w'; break;
        case 'month': params.tbs = 'qdr:m'; break;
        case 'year': params.tbs = 'qdr:y'; break;
      }
    }

    if (options.location) {
      params.location = options.location;
    }

    return params;
  }

  /**
   * Build scholar search parameters
   */
  private buildScholarParams(options: ScholarSearchOptions): Record<string, any> {
    const params: Record<string, any> = {};

    if (options.yearFrom) {
      params.as_ylo = options.yearFrom;
    }

    if (options.yearTo) {
      params.as_yhi = options.yearTo;
    }

    if (options.author) {
      params.q += ` author:"${options.author}"`;
    }

    return params;
  }

  /**
   * Parse general search results
   */
  private parseSearchResults(results: any, query: string): SearchResult {
    const organicResults = results.organic_results ?? [];
    const answerBox = results.answer_box;
    const knowledgeGraph = results.knowledge_graph;

    const searchResults: WebResult[] = organicResults.map((result: any) => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
      displayLink: result.displayed_link,
      rank: result.position,
      credibility: this.assessCredibility(result),
      metadata: {
        cachedUrl: result.cached_page_link,
        relatedPages: result.sitelinks?.inline ?? []
      }
    }));

    const baseResult = {
      query,
      totalResults: Number(results.search_information?.total_results ?? searchResults.length),
      searchTime: Number(results.search_information?.time_taken_displayed ?? 0),
      results: searchResults,
    };

    const result: SearchResult = baseResult;

    if (answerBox) {
      result.answerBox = {
        answer: String(answerBox.answer),
        title: String(answerBox.title),
        link: String(answerBox.link),
        source: String(answerBox.displayed_link)
      };
    }

    if (knowledgeGraph) {
      result.knowledgeGraph = {
        title: String(knowledgeGraph.title),
        description: String(knowledgeGraph.description),
        source: String(knowledgeGraph.source)
      };
    }

    return result;
  }

  /**
   * Parse news search results
   */
  private parseNewsResults(results: any, query: string): NewsSearchResult {
    const newsResults = results.news_results ?? [];

    const articles: NewsArticle[] = newsResults.map((article: any) => ({
      title: article.title,
      link: article.link,
      source: article.source,
      snippet: article.snippet,
      published: article.date,
      thumbnail: article.thumbnail,
      credibility: this.assessNewsCredibility(article)
    }));

    return {
      query,
      totalResults: results.search_information?.total_results ?? articles.length,
      articles
    };
  }

  /**
   * Parse scholar search results
   */
  private parseScholarResults(results: any, query: string): ScholarSearchResult {
    const scholarResults = results.organic_results ?? [];

    const papers: ScholarPaper[] = scholarResults.map((paper: any) => ({
      title: paper.title,
      link: paper.link,
      authors: paper.publication_info?.authors ?? [],
      publication: paper.publication_info?.summary,
      citedBy: paper.inline_links?.cited_by?.total ?? 0,
      year: paper.publication_info?.year,
      snippet: paper.snippet,
      pdfLink: paper.resources?.[0]?.link
    }));

    return {
      query,
      totalResults: results.search_information?.total_results ?? papers.length,
      papers
    };
  }

  /**
   * Assess credibility of a web result
   */
  private assessCredibility(result: any): CredibilityScore {
    let score = 0.5; // Base score
    const factors: string[] = [];

    // Domain authority indicators
    const domain = result.displayed_link?.split('/')[0] ?? '';
    if ((Boolean(domain.includes('.edu'))) || (Boolean(domain.includes('.gov'))) || (Boolean(domain.includes('.org')))) {
      score += 0.2;
      factors.push('educational/government domain');
    }

    // Content freshness (if available)
    if (result.date) {
      const daysSincePublished = (Date.now() - new Date(result.date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublished < 365) {
        score += 0.1;
        factors.push('recent content');
      }
    }

    // Snippet quality
    if (result.snippet && result.snippet.length > 100) {
      score += 0.1;
      factors.push('detailed snippet');
    }

    return {
      score: Math.min(1.0, Math.max(0.0, score)),
      factors,
      level: score > 0.8 ? 'high' : score > 0.6 ? 'medium' : 'low'
    };
  }

  /**
   * Assess credibility of a news article
   */
  private assessNewsCredibility(article: any): CredibilityScore {
    let score = 0.5;
    const factors: string[] = [];

    // Known reputable sources
    const reputableSources = ['bbc', 'reuters', 'ap', 'nyt', 'washingtonpost', 'guardian'];
    const source = article.source?.toLowerCase() ?? '';
    if (reputableSources.some(rep => Boolean(source.includes(rep)))) {
      score += 0.3;
      factors.push('reputable news source');
    }

    // Recent publication
    if (article.date) {
      const daysSincePublished = (Date.now() - new Date(article.date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublished < 7) {
        score += 0.2;
        factors.push('very recent');
      } else if (daysSincePublished < 30) {
        score += 0.1;
        factors.push('recent');
      }
    }

    return {
      score: Math.min(1.0, Math.max(0.0, score)),
      factors,
      level: score > 0.8 ? 'high' : score > 0.6 ? 'medium' : 'low'
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

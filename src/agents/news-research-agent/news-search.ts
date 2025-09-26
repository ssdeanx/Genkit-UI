import { getJson } from 'serpapi';

/**
 * News Search Utilities for the News Research Agent
 * Provides comprehensive news search capabilities across multiple sources
 */
export class NewsSearchUtils {
  private serpApiKey: string;
  private newsApiKey: string | undefined;

  constructor(serpApiKey?: string, newsApiKey?: string) {
    this.serpApiKey = (serpApiKey ?? process.env.SERPAPI_API_KEY) ?? '';
    this.newsApiKey = newsApiKey ?? process.env.NEWSAPI_API_KEY;

    if (!this.serpApiKey) {
      console.warn('SERPAPI_API_KEY not set. Google News search functionality will be limited.');
    }
  }

  /**
   * Search Google News for current events and articles
   */
  async searchGoogleNews(query: string, options: GoogleNewsOptions = {}): Promise<GoogleNewsResult> {
    try {
      const searchParams = {
        q: query,
        api_key: this.serpApiKey,
        engine: 'google_news',
        num: options.limit ?? 10,
        ...this.buildGoogleNewsParams(options)
      };

      console.log(`Performing Google News search for: "${query}"`);
      const results = await getJson(searchParams);

      return this.parseGoogleNewsResults(results, query);
    } catch (error) {
      console.error('Google News search failed:', error);
      throw new Error(`Google News search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search NewsAPI for comprehensive news coverage
   */
  async searchNewsAPI(query: string, options: NewsAPIOptions = {}): Promise<NewsAPIResult> {
    try {
      if (!this.newsApiKey) {
        throw new Error('NewsAPI key not configured');
      }

      const searchParams = new URLSearchParams({
        q: query,
        apiKey: this.newsApiKey,
        pageSize: String(options.limit ?? 10),
        language: options.language ?? 'en',
        sortBy: options.sortBy ?? 'publishedAt'
      });

      if (options.from) {
        searchParams.append('from', options.from);
      }

      if (options.to) {
        searchParams.append('to', options.to);
      }

      if (options.sources) {
        searchParams.append('sources', options.sources.join(','));
      }

      const url = `https://newsapi.org/v2/everything?${searchParams.toString()}`;

      console.log(`Performing NewsAPI search for: "${query}"`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error from NewsAPI! status: ${response.status}`);
      }

      const results = await response.json() as RawNewsAPIResponse;

      if (results.status !== 'ok') {
        throw new Error(`NewsAPI error: ${results.message}`);
      }

      return this.parseNewsAPIResults(results, query);
    } catch (error) {
      console.error('NewsAPI search failed:', error);
      // Don't fail completely if NewsAPI is not available
      return {
        query,
        totalResults: 0,
        articles: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Perform comprehensive news search across multiple sources
   */
  async comprehensiveNewsSearch(query: string, options: ComprehensiveNewsOptions = {}): Promise<ComprehensiveNewsResult> {
    const articles: NewsArticle[] = [];
    const errors: string[] = [];

    try {
      // Search Google News
      const googleResults = await this.searchGoogleNews(query, { limit: options.limit ?? 8 });
      articles.push(...googleResults.articles.map(article => ({ ...article, source: 'google_news' as const })));
    } catch (error) {
      errors.push(`Google News: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Search NewsAPI (if available)
      const newsAPIResults = await this.searchNewsAPI(query, { limit: options.limit ?? 8 });
      if (newsAPIResults.articles.length > 0) {
        const mappedArticles: NewsArticle[] = newsAPIResults.articles.map(article => ({
          title: article.title,
          link: article.url,
          source: article.source,
          snippet: article.description ?? article.content ?? '',
          published: article.publishedAt,
          thumbnail: article.urlToImage,
          credibility: this.assessNewsCredibility({
            source: article.source,
            published: article.publishedAt
          })
        }));
        articles.push(...mappedArticles.map(article => ({ ...article, sourceType: 'newsapi' as const })));
      }
    } catch (error) {
      // NewsAPI errors are less critical
      console.warn('NewsAPI search failed:', error);
    }

    // Remove duplicates based on URL similarity
    const uniqueArticles = this.deduplicateArticles(articles);

    // Sort by recency and credibility
    uniqueArticles.sort((a, b) => {
      // Primary sort: recency
      const aTime = new Date(a.published).getTime();
      const bTime = new Date(b.published).getTime();
      if (Math.abs(aTime - bTime) > 24 * 60 * 60 * 1000) { // More than 1 day difference
        return bTime - aTime; // Newer first
      }

      // Secondary sort: credibility
      return b.credibility.score - a.credibility.score;
    });

    return {
      query,
      totalResults: uniqueArticles.length,
      articles: uniqueArticles.slice(0, options.limit ?? 20),
      sourcesSearched: ['google_news', 'newsapi'],
      timeRange: options.timeRange ?? 'week',
      ...(errors.length > 0 && { errors })
    };
  }

  /**
   * Get trending news topics
   */
  async getTrendingTopics(options: TrendingOptions = {}): Promise<TrendingResult> {
    try {
      // Use Google News trending topics
      const searchParams = {
        api_key: this.serpApiKey,
        engine: 'google_news',
        num: options.limit ?? 10,
        ...this.buildTrendingParams(options)
      };

      console.log('Fetching trending news topics');
      const results = await getJson(searchParams);

      return this.parseTrendingResults(results);
    } catch (error) {
      console.error('Trending topics fetch failed:', error);
      throw new Error(`Trending topics fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build Google News search parameters
   */
  private buildGoogleNewsParams(options: GoogleNewsOptions): Record<string, any> {
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

    if (options.language) {
      params.hl = options.language;
    }

    return params;
  }

  /**
   * Build trending search parameters
   */
  private buildTrendingParams(options: TrendingOptions): Record<string, any> {
    const params: Record<string, any> = {};

    if (options.region) {
      params.location = options.region;
    }

    if (options.language) {
      params.hl = options.language;
    }

    return params;
  }

  /**
   * Parse Google News results
   */
  private parseGoogleNewsResults(results: any, query: string): GoogleNewsResult {
    const articles: NewsArticle[] = (results.news_results ?? []).map((article: any) => ({
      title: article.title,
      link: article.link,
      source: article.source,
      snippet: article.snippet,
      published: article.date ?? new Date().toISOString(),
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
   * Parse NewsAPI results
   */
  private parseNewsAPIResults(results: RawNewsAPIResponse, query: string): NewsAPIResult {
    const articles: NewsAPIArticle[] = results.articles.map((article: any) => ({
      title: article.title,
      description: article.description,
      url: article.url,
      urlToImage: article.urlToImage,
      publishedAt: article.publishedAt,
      source: article.source.name,
      author: article.author,
      content: article.content
    }));

    return {
      query,
      totalResults: results.totalResults,
      articles
    };
  }

  /**
   * Parse trending results
   */
  private parseTrendingResults(results: any): TrendingResult {
    const topics: TrendingTopic[] = (results.news_results ?? [])
      .slice(0, 10) // Limit to top 10
      .map((topic: any, index: number) => ({
        title: topic.title,
        searchInterest: Math.max(1, 10 - index), // Simple ranking based on position
        relatedStories: topic.stories?.length ?? 0,
        topStory: (topic.stories?.[0]) ? {
          title: topic.stories[0].title,
          url: topic.stories[0].link,
          source: topic.stories[0].source
        } : undefined
      }));

    return {
      topics,
      generatedAt: new Date()
    };
  }

  /**
   * Remove duplicate articles based on URL and title similarity
   */
  private deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const unique: NewsArticle[] = [];
    const seen = new Set<string>();

    for (const article of articles) {
      const normalizedTitle = article.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const titleKey = normalizedTitle.substring(0, 50); // First 50 chars as key

      if (!seen.has(titleKey)) {
        seen.add(titleKey);
        unique.push(article);
      }
    }

    return unique;
  }

  /**
   * Assess credibility of a news article
   */
  private assessNewsCredibility(article: any): CredibilityScore {
    let score = 0.5;
    const factors: string[] = [];

    // Known reputable sources
    const reputableSources = [
      'bbc', 'reuters', 'ap', 'nyt', 'washingtonpost', 'guardian',
      'wsj', 'ft', 'economist', 'cnn', 'npr', 'pbs'
    ];
    const source = article.source?.toLowerCase() ?? '';
    if (reputableSources.some(rep => Boolean(source.includes(rep)))) {
      score += 0.3;
      factors.push('reputable news source');
    }

    // Recent publication (very important for news)
    if (article.published) {
      const daysSincePublished = (Date.now() - new Date(article.published).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublished < 1) {
        score += 0.3;
        factors.push('very recent (< 1 day)');
      } else if (daysSincePublished < 3) {
        score += 0.2;
        factors.push('recent (< 3 days)');
      } else if (daysSincePublished < 7) {
        score += 0.1;
        factors.push('recent (< 1 week)');
      }
    }

    // Content quality indicators
    if ((Boolean(article.snippet)) && article.snippet.length > 200) {
      score += 0.1;
      factors.push('detailed content');
    }

    return {
      score: Math.min(1.0, Math.max(0.0, score)),
      factors,
      level: score > 0.8 ? 'high' : score > 0.6 ? 'medium' : 'low'
    };
  }
}

/**
 * Type definitions for news search functionality
 */
export interface CredibilityScore {
  score: number; // 0-1
  level: 'high' | 'medium' | 'low';
  factors: string[];
}

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  snippet: string;
  published: string;
  thumbnail?: string | undefined;
  credibility: CredibilityScore;
  sourceType?: 'google_news' | 'newsapi';
}

export interface GoogleNewsOptions {
  limit?: number;
  timeRange?: 'day' | 'week' | 'month' | 'year';
  location?: string;
  language?: string;
}

export interface NewsAPIOptions {
  limit?: number;
  language?: string;
  sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
  from?: string;
  to?: string;
  sources?: string[];
}

export interface ComprehensiveNewsOptions {
  limit?: number;
  timeRange?: 'day' | 'week' | 'month' | 'year';
}

export interface TrendingOptions {
  limit?: number;
  region?: string;
  language?: string;
}

// Result interfaces
export interface GoogleNewsResult {
  query: string;
  totalResults: number;
  articles: NewsArticle[];
}

export interface NewsAPIArticle {
  title: string;
  description: string;
  url: string;
  urlToImage?: string;
  publishedAt: string;
  source: string;
  author?: string;
  content?: string;
}

export interface NewsAPIResult {
  query: string;
  totalResults: number;
  articles: NewsAPIArticle[];
  error?: string;
}

export interface ComprehensiveNewsResult {
  query: string;
  totalResults: number;
  articles: NewsArticle[];
  sourcesSearched: string[];
  timeRange: string;
  errors?: string[];
}

export interface TrendingTopic {
  title: string;
  searchInterest: number; // 1-10 scale
  relatedStories: number;
  topStory?: {
    title: string;
    url: string;
    source: string;
  };
}

export interface TrendingResult {
  topics: TrendingTopic[];
  generatedAt: Date;
}

export interface RawNewsAPIResponse {
  status: 'ok' | 'error';
  totalResults: number;
  articles: NewsAPIArticle[];
  message?: string;
}

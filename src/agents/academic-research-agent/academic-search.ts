/* eslint-disable no-console */
import { getJson } from 'serpapi';

/**
 * Academic Search Utilities for the Academic Research Agent
 * Provides search capabilities across academic databases and scholarly sources
 */
export class AcademicSearchUtils {
  private serpApiKey: string;
  private semanticScholarApiKey: string;

  constructor(serpApiKey?: string, semanticScholarApiKey?: string) {
    this.serpApiKey = (serpApiKey ?? process.env.SERPAPI_API_KEY) ?? '';
    this.semanticScholarApiKey = (semanticScholarApiKey ?? process.env.SEMANTIC_SCHOLAR_API_KEY) ?? '';

    if (!this.serpApiKey) {
      console.warn('SERPAPI_API_KEY not set. Google Scholar search functionality will be limited.');
    }
  }

  /**
   * Search Google Scholar for academic papers
   */
  async searchScholar(query: string, options: ScholarSearchOptions = {}): Promise<ScholarSearchResult> {
    try {
      const searchParams = {
        q: query,
        api_key: this.serpApiKey,
        engine: 'google_scholar',
        num: options.limit ?? 10,
        ...this.buildScholarParams(options, query)
      };

      console.log(`Performing Google Scholar search for: "${query}"`);
      const results = await getJson(searchParams);

      return this.parseScholarResults(results, query);
    } catch (error) {
      console.error('Google Scholar search failed:', error);
      throw new Error(`Google Scholar search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search arXiv for preprints and papers
   */
  async searchArXiv(query: string, options: ArXivSearchOptions = {}): Promise<ArXivSearchResult> {
    try {
      const searchParams = {
        search_query: query,
        start: String(options.offset ?? 0),
        max_results: String(options.limit ?? 10),
        sortBy: options.sortBy ?? 'relevance',
        sortOrder: options.sortOrder ?? 'descending'
      };

      // Build query string for arXiv API
      const queryString = new URLSearchParams(searchParams).toString();
      const url = `http://export.arxiv.org/api/query?${queryString}`;

      console.log(`Performing arXiv search for: "${query}"`);
      const response = await fetch(url);
      const xmlText = await response.text();

      return this.parseArXivResults(xmlText, query);
    } catch (error) {
      console.error('arXiv search failed:', error);
      throw new Error(`arXiv search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search Semantic Scholar (if API key available)
   */
  async searchSemanticScholar(query: string, options: SemanticScholarOptions = {}): Promise<SemanticScholarResult> {
    try {
      if (!this.semanticScholarApiKey) {
        throw new Error('Semantic Scholar API key not configured');
      }

      const searchParams = {
        query,
        limit: String(options.limit ?? 10),
        offset: String(options.offset ?? 0),
        fields: 'title,authors,abstract,year,venue,citationCount,influentialCitationCount,openAccessPdf'
      };

      const queryString = new URLSearchParams(searchParams).toString();
      const url = `https://api.semanticscholar.org/graph/v1/paper/search?${queryString}`;

      console.log(`Performing Semantic Scholar search for: "${query}"`);
      const response = await fetch(url, {
        headers: {
          'x-api-key': this.semanticScholarApiKey
        }
      });

      const results = await response.json() as SemanticScholarApiResponse;
      return this.parseSemanticScholarResults(results, query);
    } catch (error) {
      console.error('Semantic Scholar search failed:', error);
      // Don't fail completely if Semantic Scholar is not available
      return {
        query,
        totalResults: 0,
        papers: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Perform comprehensive academic search across multiple sources
   */
  async comprehensiveSearch(query: string, options: ComprehensiveSearchOptions = {}): Promise<ComprehensiveSearchResult> {
    const results: AcademicPaper[] = [];
    const errors: string[] = [];

    try {
      // Search Google Scholar
      const scholarResults = await this.searchScholar(query, { limit: options.limit ?? 5 });
      results.push(...scholarResults.papers.map(p => ({ ...p, source: 'google_scholar' as const })));
    } catch (error) {
      errors.push(`Google Scholar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Search arXiv
      const arxivResults = await this.searchArXiv(query, { limit: options.limit ?? 5 });
      results.push(...arxivResults.papers.map(p => ({ ...p, source: 'arxiv' as const })));
    } catch (error) {
      errors.push(`arXiv: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Search Semantic Scholar (if available)
      const semanticResults = await this.searchSemanticScholar(query, { limit: options.limit ?? 5 });
      if (semanticResults.papers.length > 0) {
        results.push(...semanticResults.papers.map(p => ({ ...p, source: 'semantic_scholar' as const })));
      }
    } catch (error) {
      // Semantic Scholar errors are less critical
      console.warn('Semantic Scholar search failed:', error);
    }

    // Remove duplicates based on title similarity
    const uniqueResults = this.deduplicatePapers(results);

    // Sort by relevance/citations
    uniqueResults.sort((a, b) => {
      const aScore = (a.citationCount ?? 0) + (typeof a.year === 'number' && Number.isFinite(a.year) && a.year > 0 ? Math.max(0, 2025 - a.year) * 0.1 : 0);
      const bScore = (b.citationCount ?? 0) + (typeof b.year === 'number' && Number.isFinite(b.year) && b.year > 0 ? Math.max(0, 2025 - b.year) * 0.1 : 0);
      return bScore - aScore;
    });

    const resultBase = {
      query,
      totalResults: uniqueResults.length,
      papers: uniqueResults.slice(0, options.limit ?? 20),
      sourcesSearched: ['google_scholar', 'arxiv', 'semantic_scholar']
    };

    if (errors.length > 0) {
      return { ...resultBase, errors };
    }

    return resultBase;
  }

  /**
   * Build Google Scholar search parameters
   */
  private buildScholarParams(options: ScholarSearchOptions, baseQuery: string): Record<string, string | number> {
    const params: Record<string, string | number> = {};
    let q = baseQuery;

    if (options.yearFrom) {
      params.as_ylo = options.yearFrom;
    }

    if (options.yearTo) {
      params.as_yhi = options.yearTo;
    }

    if (options.author) {
      q += ` author:"${options.author}"`;
    }

    if (options.venue) {
      q += ` source:"${options.venue}"`;
    }

    return { ...params, q };
  }

  /**
   * Parse Google Scholar results
   */
  private parseScholarResults(results: SerpApiScholarResponse, query: string): ScholarSearchResult {
    const papers: ScholarPaper[] = (results.organic_results ?? []).map((paper: SerpApiScholarPaper) => {
      const basePaper: Omit<ScholarPaper, 'year' | 'pdfLink'> = {
        title: paper.title,
        link: paper.link,
        authors: paper.publication_info?.authors ?? [],
        publication: paper.publication_info?.summary ?? '',
        citedBy: paper.inline_links?.cited_by?.total ?? 0,
        snippet: paper.snippet ?? '',
      };

      const result: Partial<ScholarPaper> = { ...basePaper };

      if (paper.publication_info?.year !== undefined) {
        result.year = paper.publication_info.year;
      }

      if (paper.resources?.[0]?.link !== undefined) {
        result.pdfLink = paper.resources[0].link;
      }

      return result as ScholarPaper;
    });

    return {
      query,
      totalResults: results.search_information?.total_results ?? papers.length,
      papers
    };
  }

  /**
   * Parse arXiv XML results into structured format
   */
  private parseArXivResults(xmlText: string, query: string): ArXivSearchResult {
    const papers: ArXivPaper[] = [];
    const entryRegex = /<entry>(.*?)<\/entry>/gs;
    let match;

    while ((match = entryRegex.exec(xmlText)) !== null) {
      const entryXml = match[1];
      if (!entryXml) {
        continue;
      } // Skip if entryXml is undefined to avoid type errors

      const title = this.extractXmlValue(entryXml, 'title') ?? '';
      const authors = this.extractXmlAuthors(entryXml);
      const abstract = this.extractXmlValue(entryXml, 'summary') ?? '';
      const publishedStr = this.extractXmlValue(entryXml, 'published');
      const updatedStr = this.extractXmlValue(entryXml, 'updated');
      const arxivId = this.extractXmlValue(entryXml, 'id')?.split('/').pop() ?? '';
      const categories = this.extractXmlCategories(entryXml);

      // Extract PDF link from links
      const pdfLink = this.extractXmlValue(entryXml, 'link', 'title', 'pdf') ??
        this.extractXmlValue(entryXml, 'link', 'rel', 'alternate')?.replace('abs', 'pdf');

      const paper: ArXivPaper = {
        title,
        authors,
        abstract,
        arxivId,
        categories,
        pdfLink
      };

      if (publishedStr) {
        paper.published = new Date(publishedStr);
      }

      if (updatedStr) {
        paper.updated = new Date(updatedStr);
      }

      papers.push(paper);
    }

    // Extract total results from XML (if available)
    const totalResultsMatch = /<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/.exec(xmlText);
    const totalResults = totalResultsMatch?.[1] ? parseInt(totalResultsMatch[1], 10) : papers.length;

    return {
      query,
      totalResults,
      papers
    };
  }

  /**
   * Parse Semantic Scholar JSON results into structured format
   */
  private parseSemanticScholarResults(results: SemanticScholarApiResponse, query: string): SemanticScholarResult {
    const papers: SemanticScholarPaper[] = (results.data ?? []).map((paper: ApiSemanticScholarPaper) => {
      const result: Partial<SemanticScholarPaper> = {
        paperId: paper.paperId ?? '',
        title: paper.title ?? '',
        authors: (paper.authors ?? []).map((author: { name?: string }) => author.name ?? ''),
        abstract: paper.abstract ?? '',
      };

      if (paper.year !== undefined) {
        result.year = paper.year;
      }

      if (paper.venue !== undefined) {
        result.venue = paper.venue;
      }

      if (paper.citationCount !== undefined) {
        result.citationCount = paper.citationCount;
      }

      if (paper.influentialCitationCount !== undefined) {
        result.influentialCitationCount = paper.influentialCitationCount;
      }

      if (paper.openAccessPdf !== undefined) {
        result.openAccessPdf = {
          url: paper.openAccessPdf.url,
          license: paper.openAccessPdf.license,
          version: paper.openAccessPdf.version,
        };
      }

      return result as SemanticScholarPaper;
    });

    return {
      query,
      totalResults: results.total ?? papers.length,
      papers
    };
  }

  /**
   * Remove duplicate papers based on title similarity
   */
  private deduplicatePapers(papers: AcademicPaper[]): AcademicPaper[] {
    const unique: AcademicPaper[] = [];
    const seen = new Set<string>();

    for (const paper of papers) {
      const normalizedTitle = paper.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const titleKey = normalizedTitle.substring(0, 50); // First 50 chars as key

      if (!seen.has(titleKey)) {
        seen.add(titleKey);
        unique.push(paper);
      }
    }

    return unique;
  }

  /**
   * Extract value from XML tag
   */
  private extractXmlValue(xml: string, tag: string, attribute?: string, attributeValue?: string): string | undefined {
    let pattern: RegExp;
    if (attribute && attributeValue) {
      pattern = new RegExp(`<${tag}[^>]*${attribute}="${attributeValue}"[^>]*>([^<]*)</${tag}>`, 'i');
    } else {
      pattern = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
    }

    const match = xml.match(pattern);
    return match ? match[1]?.trim() : undefined;
  }

  /**
   * Extract authors from arXiv XML
   */
  private extractXmlAuthors(xml: string): string[] {
    const authorMatches = xml.match(/<author><name>([^<]+)<\/name><\/author>/g) ?? [];
    return authorMatches.map(match => {
      const nameMatch = /<name>([^<]+)<\/name>/.exec(match);
      return nameMatch?.[1]?.trim() ?? '';
    }).filter(name => name);
  }

  /**
   * Extract categories from arXiv XML
   */
  private extractXmlCategories(xml: string): string[] {
    const categoryMatches = xml.match(/<category[^>]*term="([^"]+)"/g) ?? [];
    return categoryMatches.map(match => {
      const termMatch = /term="([^"]+)"/.exec(match);
      return termMatch?.[1] ?? '';
    }).filter(cat => cat);
  }
}

/**
 * Type definitions for academic search functionality
 */
export interface ScholarSearchOptions {
  limit?: number;
  yearFrom?: number;
  yearTo?: number;
  author?: string;
  venue?: string;
}

export interface ArXivSearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  sortOrder?: 'ascending' | 'descending';
}

export interface SemanticScholarOptions {
  limit?: number;
  offset?: number;
}

export interface ComprehensiveSearchOptions {
  limit?: number;
}

// Base paper interface
export interface AcademicPaper {
  title: string;
  authors: string[];
  source: 'google_scholar' | 'arxiv' | 'semantic_scholar';
  citationCount?: number;
  year?: number;
  snippet?: string;
  pdfLink?: string | undefined;
}

// Source-specific paper interfaces
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

export interface ArXivPaper {
  title: string;
  authors: string[];
  abstract: string;
  published?: Date | undefined;
  updated?: Date | undefined;
  arxivId: string;
  pdfLink?: string | undefined;
  categories: string[];
}

export interface OpenAccessPdf {
  url?: string | undefined;
  license?: string | undefined;
  version?: string | undefined;
}

export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  authors: string[];
  abstract: string;
  year?: number;
  venue?: string;
  citationCount?: number;
  influentialCitationCount?: number;
  openAccessPdf?: OpenAccessPdf;
}

// Search result interfaces
export interface ScholarSearchResult {
  query: string;
  totalResults: number;
  papers: ScholarPaper[];
}

export interface ArXivSearchResult {
  query: string;
  totalResults: number;
  papers: ArXivPaper[];
}

export interface SemanticScholarResult {
  query: string;
  totalResults: number;
  papers: SemanticScholarPaper[];
  error?: string;
}

export interface ComprehensiveSearchResult {
  query: string;
  totalResults: number;
  papers: AcademicPaper[];
  sourcesSearched: string[];
  errors?: string[];
}

// Add new interface for SerpAPI Google Scholar response
interface SerpApiScholarResponse {
  organic_results?: Array<{
    title: string;
    link: string;
    publication_info?: {
      authors?: string[];
      summary?: string;
      year?: number;
    };
    inline_links?: {
      cited_by?: {
        total?: number;
      };
    };
    snippet?: string;
    resources?: Array<{
      link?: string;
    }>;
  }>;
  search_information?: {
    total_results?: number;
  };
}

// Define a type alias for individual papers to improve reusability and type safety
type SerpApiScholarPaper = NonNullable<SerpApiScholarResponse['organic_results']>[0];

// Add interface for Semantic Scholar API response
interface SemanticScholarApiResponse {
  data?: Array<{
    paperId?: string;
    title?: string;
    authors?: Array<{
      name?: string;
    }>;
    abstract?: string;
    year?: number;
    venue?: string;
    citationCount?: number;
    influentialCitationCount?: number;
    openAccessPdf?: {
      url?: string;
      license?: string;
      version?: string;
    };
  }>;
  total?: number;
}

// Define type alias for API paper to avoid 'any'
type ApiSemanticScholarPaper = NonNullable<SemanticScholarApiResponse['data']>[0];

import type { ResearchQuery } from '../shared/interfaces.js';

/**
 * Query Analysis Engine for the Planning Agent
 * Decomposes research queries into structured analysis components
 */
export class QueryAnalyzer {
  /**
   * Analyze a research query and extract key components
   */
  analyzeQuery(query: string): {
    coreQuestion: string;
    scopeDimensions: string[];
    knowledgeGaps: string[];
    stakeholderNeeds: string[];
    researchDimensions: ResearchDimension[];
    complexity: 'simple' | 'moderate' | 'complex' | 'expert';
    estimatedScope: 'narrow' | 'medium' | 'broad' | 'comprehensive';
  } {
    return {
      coreQuestion: this.extractCoreQuestion(query),
      scopeDimensions: this.identifyScopeDimensions(query),
      knowledgeGaps: this.identifyKnowledgeGaps(query),
      stakeholderNeeds: this.identifyStakeholderNeeds(query),
      researchDimensions: this.extractResearchDimensions(query),
      complexity: this.assessComplexity(query),
      estimatedScope: this.estimateScope(query),
    };
  }

  /**
   * Extract the core question from a research query
   */
  private extractCoreQuestion(query: string): string {
    // Remove question words and normalize
    const normalized = query.toLowerCase()
      .replace(/^(what|how|why|when|where|who|which|can you|tell me|explain|describe|analyze)\s+/i, '')
      .replace(/^(is|are|do|does|did|will|would|could|should)\s+/i, '')
      .replace(/\?+$/, '')
      .trim();

    // Extract the main subject and question focus
    const words = normalized.split(/\s+/);
    if (words.length <= 3) {
      return query.replace(/\?$/, '');
    }

    // Find the main subject (usually nouns)
    const subjects = words.filter(word =>
      !this.isStopWord(word) &&
      !this.isQuestionWord(word) &&
      word.length > 2
    );

    return subjects.slice(0, 3).join(' ');
  }

  /**
   * Identify scope dimensions (historical, current, future, comparative, etc.)
   */
  private identifyScopeDimensions(query: string): string[] {
    const dimensions: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Time-based dimensions
    if (lowerQuery.includes('history') || lowerQuery.includes('historical') || lowerQuery.includes('past')) {
      dimensions.push('historical');
    }
    if (lowerQuery.includes('current') || lowerQuery.includes('now') || lowerQuery.includes('today') || lowerQuery.includes('recent')) {
      dimensions.push('current');
    }
    if (lowerQuery.includes('future') || lowerQuery.includes('trend') || lowerQuery.includes('forecast') || lowerQuery.includes('prediction')) {
      dimensions.push('future');
    }

    // Comparative dimensions
    if (lowerQuery.includes('compare') || lowerQuery.includes('versus') || lowerQuery.includes('vs') || lowerQuery.includes('difference')) {
      dimensions.push('comparative');
    }

    // Geographic dimensions
    if (lowerQuery.includes('global') || lowerQuery.includes('worldwide') || lowerQuery.includes('international')) {
      dimensions.push('global');
    }
    if (lowerQuery.includes('local') || lowerQuery.includes('regional') || lowerQuery.includes('specific location')) {
      dimensions.push('local');
    }

    // Methodological dimensions
    if (lowerQuery.includes('how') || lowerQuery.includes('process') || lowerQuery.includes('method')) {
      dimensions.push('methodological');
    }
    if (lowerQuery.includes('why') || lowerQuery.includes('cause') || lowerQuery.includes('reason')) {
      dimensions.push('causal');
    }

    return dimensions.length > 0 ? dimensions : ['general'];
  }

  /**
   * Identify knowledge gaps that need research
   */
  private identifyKnowledgeGaps(query: string): string[] {
    const gaps: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Look for uncertainty indicators
    if (lowerQuery.includes('unknown') || lowerQuery.includes('unclear') || lowerQuery.includes('not sure')) {
      gaps.push('fundamental understanding');
    }

    // Look for research indicators
    if (lowerQuery.includes('research') || lowerQuery.includes('study') || lowerQuery.includes('investigate')) {
      gaps.push('empirical evidence');
    }

    // Look for comparison needs
    if (lowerQuery.includes('better') || lowerQuery.includes('best') || lowerQuery.includes('compare')) {
      gaps.push('comparative analysis');
    }

    // Look for trend analysis needs
    if (lowerQuery.includes('trend') || lowerQuery.includes('change') || lowerQuery.includes('evolution')) {
      gaps.push('temporal analysis');
    }

    return gaps.length > 0 ? gaps : ['information gathering'];
  }

  /**
   * Identify stakeholder needs and expected outcomes
   */
  private identifyStakeholderNeeds(query: string): string[] {
    const needs: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Factual information needs
    if (lowerQuery.includes('what') || lowerQuery.includes('facts') || lowerQuery.includes('information')) {
      needs.push('factual information');
    }

    // Explanatory needs
    if (lowerQuery.includes('how') || lowerQuery.includes('why') || lowerQuery.includes('explain')) {
      needs.push('explanation');
    }

    // Decision support needs
    if (lowerQuery.includes('should') || lowerQuery.includes('recommend') || lowerQuery.includes('best') || lowerQuery.includes('choose')) {
      needs.push('decision support');
    }

    // Analysis needs
    if (lowerQuery.includes('analyze') || lowerQuery.includes('assess') || lowerQuery.includes('evaluate')) {
      needs.push('analysis');
    }

    return needs.length > 0 ? needs : ['information'];
  }

  /**
   * Extract research dimensions from the query
   */
  private extractResearchDimensions(query: string): ResearchDimension[] {
    const dimensions: ResearchDimension[] = [];
    const lowerQuery = query.toLowerCase();

    // Academic/Scholarly dimension
    if (this.containsAcademicKeywords(lowerQuery)) {
      dimensions.push({
        type: 'academic',
        relevance: this.calculateRelevance(lowerQuery, ['research', 'study', 'academic', 'scholarly', 'peer-reviewed', 'journal']),
        priority: 'high'
      });
    }

    // Web/General knowledge dimension
    if (this.containsWebKeywords(lowerQuery)) {
      dimensions.push({
        type: 'web',
        relevance: this.calculateRelevance(lowerQuery, ['general', 'overview', 'introduction', 'basic', 'definition']),
        priority: 'medium'
      });
    }

    // News/Current events dimension
    if (this.containsNewsKeywords(lowerQuery)) {
      dimensions.push({
        type: 'news',
        relevance: this.calculateRelevance(lowerQuery, ['recent', 'current', 'news', 'latest', 'update', 'today']),
        priority: 'medium'
      });
    }

    // Statistical/Data analysis dimension
    if (this.containsDataKeywords(lowerQuery)) {
      dimensions.push({
        type: 'statistical',
        relevance: this.calculateRelevance(lowerQuery, ['statistics', 'data', 'numbers', 'trends', 'analysis', 'quantitative']),
        priority: 'high'
      });
    }

    // Default to web research if no specific dimensions identified
    if (dimensions.length === 0) {
      dimensions.push({
        type: 'web',
        relevance: 0.8,
        priority: 'medium'
      });
    }

    return dimensions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Assess query complexity
   */
  private assessComplexity(query: string): 'simple' | 'moderate' | 'complex' | 'expert' {
    const wordCount = query.split(/\s+/).length;
    const lowerQuery = query.toLowerCase();

    // Expert level indicators
    if (wordCount > 20 ||
        lowerQuery.includes('meta-analysis') ||
        lowerQuery.includes('systematic review') ||
        lowerQuery.includes('methodology') ||
        lowerQuery.includes('theoretical framework')) {
      return 'expert';
    }

    // Complex level indicators
    if (wordCount > 15 ||
        lowerQuery.includes('compare') ||
        lowerQuery.includes('analyze') ||
        lowerQuery.includes('evaluate') ||
        lowerQuery.includes('impact') ||
        lowerQuery.includes('relationship')) {
      return 'complex';
    }

    // Moderate level indicators
    if (wordCount > 10 ||
        lowerQuery.includes('how') ||
        lowerQuery.includes('why') ||
        lowerQuery.includes('explain')) {
      return 'moderate';
    }

    return 'simple';
  }

  /**
   * Estimate research scope
   */
  private estimateScope(query: string): 'narrow' | 'medium' | 'broad' | 'comprehensive' {
    const lowerQuery = query.toLowerCase();

    // Comprehensive scope indicators
    if (lowerQuery.includes('comprehensive') ||
        lowerQuery.includes('complete') ||
        lowerQuery.includes('thorough') ||
        lowerQuery.includes('exhaustive')) {
      return 'comprehensive';
    }

    // Broad scope indicators
    if (lowerQuery.includes('overview') ||
        lowerQuery.includes('general') ||
        lowerQuery.includes('broad') ||
        lowerQuery.includes('wide')) {
      return 'broad';
    }

    // Medium scope (default for most queries)
    if (query.split(/\s+/).length > 8) {
      return 'medium';
    }

    return 'narrow';
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'];
    return stopWords.includes(word.toLowerCase());
  }

  private isQuestionWord(word: string): boolean {
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'whose'];
    return questionWords.includes(word.toLowerCase());
  }

  private containsAcademicKeywords(query: string): boolean {
    const academicKeywords = ['research', 'study', 'academic', 'scholarly', 'peer-reviewed', 'journal', 'paper', 'theory', 'hypothesis', 'methodology'];
    return academicKeywords.some(keyword => query.includes(keyword));
  }

  private containsWebKeywords(query: string): boolean {
    const webKeywords = ['general', 'overview', 'introduction', 'basic', 'definition', 'explain', 'describe'];
    return webKeywords.some(keyword => query.includes(keyword));
  }

  private containsNewsKeywords(query: string): boolean {
    const newsKeywords = ['recent', 'current', 'news', 'latest', 'update', 'today', 'breaking', 'happened'];
    return newsKeywords.some(keyword => query.includes(keyword));
  }

  private containsDataKeywords(query: string): boolean {
    const dataKeywords = ['statistics', 'data', 'numbers', 'trends', 'analysis', 'quantitative', 'percentage', 'rate', 'growth'];
    return dataKeywords.some(keyword => query.includes(keyword));
  }

  private calculateRelevance(query: string, keywords: string[]): number {
    const matches = keywords.filter(keyword => query.includes(keyword)).length;
    return Math.min(matches / keywords.length, 1.0);
  }
}

export interface ResearchDimension {
  type: 'academic' | 'web' | 'news' | 'statistical';
  relevance: number; // 0-1
  priority: 'high' | 'medium' | 'low';
}

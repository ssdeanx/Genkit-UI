import type { DataSource, ResearchDimension } from '../shared/interfaces.js';

/**
 * Data Source Identification Engine for the Planning Agent
 * Identifies and prioritizes appropriate data sources for research queries
 */
export class DataSourceIdentifier {
  /**
   * Identify relevant data sources based on query analysis
   */
  identifyDataSources(
    researchDimensions: ResearchDimension[],
    topic: string,
    methodology: string
  ): DataSource[] {
    const sources: DataSource[] = [];

    // Add sources based on research dimensions
    for (const dimension of researchDimensions) {
      const dimensionSources = this.getSourcesForDimension(dimension);
      sources.push(...dimensionSources);
    }

    // Add methodology-specific sources
    const methodologySources = this.getMethodologySources(methodology, topic);
    sources.push(...methodologySources);

    // Remove duplicates and prioritize
    const uniqueSources = this.deduplicateSources(sources);
    return this.prioritizeSources(uniqueSources, researchDimensions);
  }

  /**
   * Get data sources appropriate for a specific research dimension
   */
  private getSourcesForDimension(dimension: ResearchDimension): DataSource[] {
    const sources: DataSource[] = [];

    switch (dimension.type) {
      case 'academic':
        sources.push(
          {
            type: 'academic',
            priority: dimension.priority === 'high' ? 1 : 2,
            credibilityWeight: 0.9,
            estimatedVolume: 'medium',
            accessRequirements: ['API key for academic databases'],
            rateLimits: {
              requestsPerMinute: 10,
              requestsPerHour: 100
            }
          },
          {
            type: 'academic',
            priority: dimension.priority === 'high' ? 1 : 3,
            credibilityWeight: 0.85,
            estimatedVolume: 'high',
            accessRequirements: ['Google Scholar API access']
          }
        );
        break;

      case 'web':
        sources.push(
          {
            type: 'web',
            priority: dimension.priority === 'high' ? 2 : 3,
            credibilityWeight: 0.7,
            estimatedVolume: 'high',
            rateLimits: {
              requestsPerMinute: 30,
              requestsPerHour: 1000
            }
          },
          {
            type: 'web',
            priority: dimension.priority === 'high' ? 2 : 4,
            credibilityWeight: 0.6,
            estimatedVolume: 'high',
            accessRequirements: ['Search engine API access']
          }
        );
        break;

      case 'news':
        sources.push(
          {
            type: 'news',
            priority: dimension.priority === 'high' ? 2 : 3,
            credibilityWeight: 0.75,
            estimatedVolume: 'medium',
            rateLimits: {
              requestsPerMinute: 20,
              requestsPerHour: 500
            }
          },
          {
            type: 'news',
            priority: dimension.priority === 'high' ? 3 : 4,
            credibilityWeight: 0.7,
            estimatedVolume: 'high',
            accessRequirements: ['News API access']
          }
        );
        break;

      case 'statistical':
        sources.push(
          {
            type: 'statistical',
            priority: dimension.priority === 'high' ? 1 : 2,
            credibilityWeight: 0.95,
            estimatedVolume: 'low',
            accessRequirements: ['Government data portal access'],
            rateLimits: {
              requestsPerMinute: 5,
              requestsPerHour: 50
            }
          },
          {
            type: 'statistical',
            priority: dimension.priority === 'high' ? 2 : 3,
            credibilityWeight: 0.8,
            estimatedVolume: 'medium',
            accessRequirements: ['Statistical database access']
          }
        );
        break;
    }

    return sources;
  }

  /**
   * Get data sources based on research methodology
   */
  private getMethodologySources(methodology: string, topic: string): DataSource[] {
    const sources: DataSource[] = [];

    switch (methodology) {
      case 'systematic':
        // Systematic reviews need comprehensive academic sources
        sources.push({
          type: 'academic',
          priority: 1,
          credibilityWeight: 0.95,
          estimatedVolume: 'high',
          accessRequirements: ['Multiple academic database subscriptions']
        });
        break;

      case 'exploratory':
        // Exploratory research benefits from broad web sources
        sources.push({
          type: 'web',
          priority: 2,
          credibilityWeight: 0.6,
          estimatedVolume: 'high',
          accessRequirements: ['Broad search engine access']
        });
        break;

      case 'comparative':
        // Comparative studies need diverse sources
        sources.push(
          {
            type: 'web',
            priority: 2,
            credibilityWeight: 0.7,
            estimatedVolume: 'medium'
          },
          {
            type: 'academic',
            priority: 3,
            credibilityWeight: 0.85,
            estimatedVolume: 'medium'
          }
        );
        break;

      case 'case-study':
        // Case studies benefit from detailed sources
        sources.push({
          type: 'web',
          priority: 2,
          credibilityWeight: 0.75,
          estimatedVolume: 'medium',
          accessRequirements: ['Specialized database access']
        });
        break;
    }

    return sources;
  }

  /**
   * Remove duplicate data sources
   */
  private deduplicateSources(sources: DataSource[]): DataSource[] {
    const seen = new Set<string>();
    const unique: DataSource[] = [];

    for (const source of sources) {
      const key = `${source.type}-${source.priority}-${source.credibilityWeight}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(source);
      }
    }

    return unique;
  }

  /**
   * Prioritize data sources based on research dimensions and requirements
   */
  private prioritizeSources(sources: DataSource[], dimensions: ResearchDimension[]): DataSource[] {
    return sources.sort((a, b) => {
      // First priority: alignment with research dimensions
      const aDimension = dimensions.find(d => d.type === a.type);
      const bDimension = dimensions.find(d => d.type === b.type);

      if (aDimension && !bDimension) {
        return -1;
      }
      if (!aDimension && bDimension) {
        return 1;
      }

      if (aDimension && bDimension) {
        // Higher relevance first
        if (aDimension.relevance !== bDimension.relevance) {
          return bDimension.relevance - aDimension.relevance;
        }
        // Higher priority dimension first
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[bDimension.priority] - priorityOrder[aDimension.priority];
      }

      // Second priority: source priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Third priority: credibility weight
      return b.credibilityWeight - a.credibilityWeight;
    });
  }

  /**
   * Validate data source accessibility and requirements
   */
  validateDataSources(sources: DataSource[]): {
    validSources: DataSource[];
    invalidSources: DataSource[];
    accessIssues: string[];
  } {
    const validSources: DataSource[] = [];
    const invalidSources: DataSource[] = [];
    const accessIssues: string[] = [];

    for (const source of sources) {
      const issues = this.checkSourceAccessibility(source);

      if (issues.length === 0) {
        validSources.push(source);
      } else {
        invalidSources.push(source);
        accessIssues.push(...issues);
      }
    }

    return { validSources, invalidSources, accessIssues };
  }

  /**
   * Check if a data source is accessible
   */
  private checkSourceAccessibility(source: DataSource): string[] {
    const issues: string[] = [];

    // Check rate limits
    if (source.rateLimits && source.rateLimits.requestsPerMinute < 1) {
      issues.push(`Insufficient rate limit for ${source.type} source`);
    }

    // Check access requirements
    if (source.accessRequirements) {
      for (const requirement of source.accessRequirements) {
        if (requirement.includes('API key') && !this.hasApiKeyForSource(source.type)) {
          issues.push(`Missing API key for ${source.type} source`);
        }
        if (requirement.includes('subscription') && !this.hasSubscriptionForSource(source.type)) {
          issues.push(`Missing subscription for ${source.type} source`);
        }
      }
    }

    return issues;
  }

  /**
   * Check if API key is available for source type
   */
  private hasApiKeyForSource(sourceType: DataSource['type']): boolean {
    // In a real implementation, this would check environment variables
    // For now, assume academic and news sources need API keys
    switch (sourceType) {
      case 'academic':
        return !!process.env.ACADEMIC_API_KEY;
      case 'news':
        return !!process.env.NEWS_API_KEY;
      case 'statistical':
        return !!process.env.STATISTICAL_API_KEY;
      default:
        return true; // Web sources typically don't need API keys
    }
  }

  /**
   * Check if subscription is available for source type
   */
  private hasSubscriptionForSource(sourceType: DataSource['type']): boolean {
    // In a real implementation, this would check subscription status
    // For now, assume all sources have subscriptions
    return true;
  }

  /**
   * Get data source recommendations for different research scenarios
   */
  getDataSourceRecommendations(): Record<string, {
    scenario: string;
    recommendedSources: Array<DataSource['type']>;
    rationale: string;
  }> {
    return {
      'academic-research': {
        scenario: 'Peer-reviewed academic research',
        recommendedSources: ['academic'],
        rationale: 'Requires scholarly sources with high credibility and methodological rigor'
      },

      'current-events': {
        scenario: 'Recent news and current events',
        recommendedSources: ['news', 'web'],
        rationale: 'Needs timely information from news sources with web backup'
      },

      'statistical-analysis': {
        scenario: 'Quantitative data analysis',
        recommendedSources: ['statistical', 'academic'],
        rationale: 'Requires reliable statistical data with academic validation'
      },

      'general-overview': {
        scenario: 'Broad topic overview',
        recommendedSources: ['web', 'academic'],
        rationale: 'Comprehensive coverage from general and scholarly sources'
      },

      'comparative-study': {
        scenario: 'Comparing multiple options/entities',
        recommendedSources: ['web', 'academic', 'news'],
        rationale: 'Multiple perspectives needed for balanced comparison'
      }
    };
  }
}
import type { ContingencyPlan, RiskFactor, DataSource, ResearchStep } from '../shared/interfaces.js';
import { flowlogger } from '../../logger.js';

/**
 * Contingency Planning Engine for the Planning Agent
 * Creates fallback strategies and resource adjustments for research execution
 */
export class ContingencyPlanner {
  /**
   * Generate comprehensive contingency plans for a research plan
   */
  createContingencyPlans(
    risks: RiskFactor[],
    dataSources: DataSource[],
    executionSteps: ResearchStep[],
    topic: string
  ): ContingencyPlan[] {
    const plans: ContingencyPlan[] = [];

    // Generate plans for each identified risk
    for (const risk of risks) {
      const plan = this.createPlanForRisk(risk, dataSources, executionSteps, topic);
      if (plan) {
        plans.push(plan);
      }
    }

    // Add general contingency plans
    plans.push(...this.generateGeneralContingencyPlans(dataSources, executionSteps, topic));

    // Optimize and deduplicate plans
    const optimizedPlans = this.optimizeContingencyPlans(plans);

    // Get recommendations for the planning process
    const recommendations = this.getContingencyRecommendations(optimizedPlans);
    flowlogger.info(`ContingencyPlanner: Generated ${optimizedPlans.length} optimized plans with ${recommendations.length} recommendations`);

    return optimizedPlans;
  }

  /**
   * Create a contingency plan for a specific risk
   */
  private createPlanForRisk(
    risk: RiskFactor,
    dataSources: DataSource[],
    executionSteps: ResearchStep[],
    topic: string
  ): ContingencyPlan | null {
    switch (risk.type) {
      case 'data-availability':
        return this.createDataAvailabilityPlan(risk, dataSources, topic);

      case 'api-limits':
        return this.createApiLimitPlan(risk, dataSources, executionSteps);

      case 'time-constraints':
        return this.createTimeConstraintPlan(risk, executionSteps);

      case 'credibility-concerns':
        return this.createCredibilityPlan(risk, dataSources);

      case 'technical-failures':
        return this.createTechnicalFailurePlan(risk, executionSteps);

      default:
        return null;
    }
  }

  /**
   * Create contingency plan for data availability issues
   */
  private createDataAvailabilityPlan(
    risk: RiskFactor,
    dataSources: DataSource[],
    topic: string
  ): ContingencyPlan {
    const backupSources = this.identifyBackupSources(dataSources, topic);
    const scopeReduction = this.calculateScopeReduction(risk);

    return {
      triggerCondition: `Primary data sources for ${topic} research return insufficient results or become unavailable`,
      fallbackStrategy: `Activate backup sources: ${backupSources.join(', ')}; Reduce research scope by ${scopeReduction}% if needed`,
      resourceAdjustment: 'Allocate 25% additional time for alternative data collection; Enable parallel backup source execution',
      estimatedImpact: `${scopeReduction > 0 ? scopeReduction + '% reduction in scope, ' : ''}15-30% increase in execution time`
    };
  }

  /**
   * Create contingency plan for API rate limiting issues
   */
  private createApiLimitPlan(
    risk: RiskFactor,
    dataSources: DataSource[],
    executionSteps: ResearchStep[]
  ): ContingencyPlan {
    const rateLimitedSources = dataSources.filter(s =>
      s.rateLimits && s.rateLimits.requestsPerMinute < 20
    );

    const affectedSteps = executionSteps.filter(step =>
      rateLimitedSources.some(source =>
        this.sourceTypeMatchesAgent(source.type, step.agentType)
      )
    );

    return {
      triggerCondition: 'API rate limits exceeded on one or more data sources',
      fallbackStrategy: `Implement request queuing with ${this.calculateQueueDelay(rateLimitedSources)}ms delays; Distribute requests across ${rateLimitedSources.length} backup time windows`,
      resourceAdjustment: `Add ${this.calculateBufferTime(affectedSteps)} minutes buffer time; Reduce concurrent requests by 40%`,
      estimatedImpact: '20-40% increase in execution time with maintained result quality'
    };
  }

  /**
   * Create contingency plan for time constraint issues
   */
  private createTimeConstraintPlan(
    risk: RiskFactor,
    executionSteps: ResearchStep[]
  ): ContingencyPlan {
    const criticalSteps = executionSteps.filter(step => step.priority <= 2);
    const optionalSteps = executionSteps.filter(step => step.priority > 2);

    const timeSavings = optionalSteps.reduce((sum, step) => sum + step.estimatedDuration * 0.3, 0);

    return {
      triggerCondition: 'Research execution time exceeds 80% of allocated timeline',
      fallbackStrategy: `Prioritize ${criticalSteps.length} critical steps; Condense or skip ${optionalSteps.length} optional steps; Implement parallel execution for remaining steps`,
      resourceAdjustment: `Reallocate ${Math.round(timeSavings)} minutes from optional to critical steps; Add progress checkpoints every 15 minutes`,
      estimatedImpact: `${Math.round(timeSavings / executionSteps.reduce((sum, step) => sum + step.estimatedDuration, 0) * 100)}% time savings with focused scope`
    };
  }

  /**
   * Create contingency plan for credibility concerns
   */
  private createCredibilityPlan(
    risk: RiskFactor,
    dataSources: DataSource[]
  ): ContingencyPlan {
    const lowCredibilitySources = dataSources.filter(s => s.credibilityWeight < 0.7);
    const highCredibilitySources = dataSources.filter(s => s.credibilityWeight >= 0.8);

    return {
      triggerCondition: 'Source credibility scores fall below quality thresholds',
      fallbackStrategy: `Replace ${lowCredibilitySources.length} low-credibility sources with ${highCredibilitySources.length} high-credibility alternatives; Implement cross-validation across all sources`,
      resourceAdjustment: 'Add 20 minutes for additional validation steps; Enable credibility scoring for all results',
      estimatedImpact: 'Improved result quality with 15% increase in validation time'
    };
  }

  /**
   * Create contingency plan for technical failures
   */
  private createTechnicalFailurePlan(
    risk: RiskFactor,
    executionSteps: ResearchStep[]
  ): ContingencyPlan {
    const networkDependentSteps = executionSteps.filter(step =>
      ['web-research', 'academic-research', 'news-research'].includes(step.agentType)
    );

    return {
      triggerCondition: 'Agent failures or network connectivity issues detected',
      fallbackStrategy: `Retry failed operations with exponential backoff; Switch to backup agents for ${networkDependentSteps.length} network-dependent steps; Enable offline processing where possible`,
      resourceAdjustment: 'Add 10 minutes per retry attempt; Implement circuit breaker pattern with 3-minute timeout',
      estimatedImpact: '5-20% increase in execution time with improved fault tolerance'
    };
  }

  /**
   * Generate general contingency plans that apply to all research
   */
  private generateGeneralContingencyPlans(
    dataSources: DataSource[],
    executionSteps: ResearchStep[],
    topic: string
  ): ContingencyPlan[] {
    const topicSpecificPlans = this.generateTopicSpecificContingencyPlans(topic);

    return [
      {
        triggerCondition: 'Unexpected high volume of results from data sources',
        fallbackStrategy: `Implement result filtering and prioritization for ${topic}; Focus on most relevant findings`,
        resourceAdjustment: 'Add 15 minutes for result analysis and filtering',
        estimatedImpact: 'Maintained quality with focused result set'
      },
      {
        triggerCondition: 'Research findings show significant contradictions',
        fallbackStrategy: `Implement additional cross-validation steps for ${topic}; Document contradictions with source attribution`,
        resourceAdjustment: 'Add 20 minutes for contradiction analysis and resolution',
        estimatedImpact: 'Improved result reliability with documented uncertainty'
      },
      {
        triggerCondition: 'Partial research completion due to time constraints',
        fallbackStrategy: `Generate interim report with completed ${topic} findings; Prioritize most critical insights`,
        resourceAdjustment: 'Reduce final synthesis time by 30%; Focus on executive summary',
        estimatedImpact: 'Partial but valuable results delivered on time'
      },
      ...topicSpecificPlans
    ];
  }

  /**
   * Generate topic-specific contingency plans based on research topic
   */
  private generateTopicSpecificContingencyPlans(topic: string): ContingencyPlan[] {
    const topicLower = topic.toLowerCase();
    const plans: ContingencyPlan[] = [];

    // Technical topics
    if (topicLower.includes('software') || topicLower.includes('programming') || topicLower.includes('code')) {
      plans.push({
        triggerCondition: 'API documentation is outdated or incomplete',
        fallbackStrategy: 'Use source code analysis and community forums; Implement code example testing',
        resourceAdjustment: 'Add 25 minutes for alternative documentation research',
        estimatedImpact: 'Maintained implementation quality with practical examples'
      });
    }

    // Scientific topics
    if (topicLower.includes('science') || topicLower.includes('research') || topicLower.includes('study')) {
      plans.push({
        triggerCondition: 'Recent studies contradict established findings',
        fallbackStrategy: 'Focus on meta-analysis and systematic reviews; Cross-reference with multiple databases',
        resourceAdjustment: 'Add 30 minutes for comprehensive literature review',
        estimatedImpact: 'Improved scientific validity with broader evidence base'
      });
    }

    // Business topics
    if (topicLower.includes('business') || topicLower.includes('market') || topicLower.includes('industry')) {
      plans.push({
        triggerCondition: 'Market data shows unusual volatility',
        fallbackStrategy: 'Use historical trends and industry reports; Implement data smoothing techniques',
        resourceAdjustment: 'Add 20 minutes for trend analysis and validation',
        estimatedImpact: 'Stabilized market insights with historical context'
      });
    }

    return plans;
  }

  /**
   * Identify backup data sources for contingency planning
   */
  private identifyBackupSources(dataSources: DataSource[], topic: string): string[] {
    const backupSources: string[] = [];

    // Add general web search as universal backup
    if (!dataSources.some(s => s.type === 'web')) {
      backupSources.push('general web search');
    }

    // Add academic backups if not already present
    if (!dataSources.some(s => s.type === 'academic')) {
      backupSources.push('academic databases');
    }

    // Add news backups for current topics
    if (!dataSources.some(s => s.type === 'news')) {
      backupSources.push('news archives');
    }

    // Topic-specific backups
    const topicLower = topic.toLowerCase();
    if ((topicLower.includes('technical') || topicLower.includes('software')) && !dataSources.some(s => s.type === 'web')) {
          backupSources.push('GitHub repositories and technical forums');
    }

    if ((topicLower.includes('business') || topicLower.includes('market')) && !dataSources.some(s => s.type === 'government')) {
          backupSources.push('financial databases and SEC filings');
    }

    return backupSources;
  }

  /**
   * Calculate scope reduction needed for contingency
   */
  private calculateScopeReduction(risk: RiskFactor): number {
    // Base reduction on risk impact and probability
    let reduction = 0;

    if (risk.impact === 'high') {
      reduction += 15;
    } else if (risk.impact === 'medium') {
      reduction += 8;
    }

    if (risk.probability === 'high') {
      reduction += 10;
    } else if (risk.probability === 'medium') {
      reduction += 5;
    }

    return Math.min(reduction, 40); // Cap at 40% reduction
  }

  /**
   * Calculate queue delay for API rate limiting
   */
  private calculateQueueDelay(rateLimitedSources: DataSource[]): number {
    const minRequestsPerMinute = Math.min(
      ...rateLimitedSources
        .filter(s => s.rateLimits)
        .map(s => s.rateLimits?.requestsPerMinute ?? Infinity) // Use nullish coalescing to handle undefined rateLimits
    );

    // Calculate delay to stay within limits (with 20% buffer)
    const delayMs = Math.ceil((60 / minRequestsPerMinute) * 1000 * 1.2);

    return Math.max(delayMs, 1000); // Minimum 1 second delay
  }

  /**
   * Calculate buffer time needed for affected steps
   */
  private calculateBufferTime(affectedSteps: ResearchStep[]): number {
    const totalTime = affectedSteps.reduce((sum, step) => sum + step.estimatedDuration, 0);
    return Math.ceil(totalTime * 0.3); // 30% buffer
  }

  /**
   * Check if source type matches agent type
   */
  private sourceTypeMatchesAgent(sourceType: string, agentType: string): boolean {
    const mapping: Record<string, string> = {
      'web': 'web-research',
      'academic': 'academic-research',
      'news': 'news-research',
      'statistical': 'data-analysis'
    };

    return mapping[sourceType] === agentType;
  }

  /**
   * Optimize contingency plans by removing duplicates and conflicts
   */
  private optimizeContingencyPlans(plans: ContingencyPlan[]): ContingencyPlan[] {
    const optimized: ContingencyPlan[] = [];
    const seenConditions = new Set<string>();

    for (const plan of plans) {
      // Skip if we've seen a similar trigger condition
      if (seenConditions.has(plan.triggerCondition)) {
        continue;
      }

      // Check for conflicts with existing plans
      const conflicts = optimized.filter(existing =>
        this.plansConflict(existing, plan)
      );

      if (conflicts.length === 0) {
        optimized.push(plan);
        seenConditions.add(plan.triggerCondition);
      } else {
        // Merge conflicting plans
        const existing = conflicts[0]; // may be undefined by index access typing
        if (existing) {
          const merged = this.mergeContingencyPlans(existing, plan);
          const index = optimized.indexOf(existing);
          if (index >= 0) {
            optimized[index] = merged;
          } else {
            // Fallback: if the existing item isn't in optimized (unexpected), push merged
            optimized.push(merged);
          }
          // Ensure deduplication set contains the merged condition
          seenConditions.add(merged.triggerCondition);
        }
      }
    }

    return optimized;
  }

  /**
   * Check if two contingency plans conflict
   */
  private plansConflict(plan1: ContingencyPlan, plan2: ContingencyPlan): boolean {
    // Plans conflict if they have similar trigger conditions but different strategies
    const conditionSimilarity = this.calculateStringSimilarity(
      plan1.triggerCondition,
      plan2.triggerCondition
    );

    return conditionSimilarity > 0.7 &&
           this.calculateStringSimilarity(plan1.fallbackStrategy, plan2.fallbackStrategy) < 0.5;
  }

  /**
   * Merge two conflicting contingency plans
   */
  private mergeContingencyPlans(plan1: ContingencyPlan, plan2: ContingencyPlan): ContingencyPlan {
    return {
      triggerCondition: plan1.triggerCondition, // Keep the first condition
      fallbackStrategy: `${plan1.fallbackStrategy}; Alternative: ${plan2.fallbackStrategy}`,
      resourceAdjustment: `${plan1.resourceAdjustment}; ${plan2.resourceAdjustment}`,
      estimatedImpact: `${plan1.estimatedImpact} (primary), ${plan2.estimatedImpact} (alternative)`
    };
  }

  /**
   * Calculate string similarity (simple implementation)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Early exits for empty strings
    if (len1 === 0) {
      return len2;
    }
    if (len2 === 0) {
      return len1;
    }

    // Allocate a fully-initialized (non-sparse) matrix: (len2+1) x (len1+1)
    const matrix: number[][] = Array.from({ length: len2 + 1 }, () => new Array(len1 + 1).fill(0));

    // Initialize first column and first row using local row references to avoid "possibly undefined"
    for (let i = 0; i <= len2; i++) {
      const row = matrix[i]!; // assert row exists
      row[0] = i;
    }
    for (let j = 0; j <= len1; j++) {
      const firstRow = matrix[0]!; // assert first row exists
      firstRow[j] = j;
    }

    // Compute distances using local row references to avoid "possibly undefined" errors
    for (let i = 1; i <= len2; i++) {
      const rowI = matrix[i]!;        // assert row exists
      const rowPrev = matrix[i - 1]!; // assert previous row exists
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          rowI[j] = rowPrev[j - 1]!;
        } else {
          rowI[j] = Math.min(
            rowPrev[j - 1]! + 1, // substitution
            rowI[j - 1]! + 1,     // insertion
            rowPrev[j]! + 1       // deletion
          );
        }
      }
    }

    return matrix[len2]![len1]!;
  }

  /**
   * Get contingency planning recommendations
   */
  getContingencyRecommendations(plans: ContingencyPlan[]): string[] {
    const recommendations: string[] = [];

    if (plans.length > 5) {
      recommendations.push('Consider simplifying research scope to reduce contingency complexity');
    }

    const highImpactPlans = plans.filter(plan =>
      plan.estimatedImpact.includes('high') || plan.estimatedImpact.includes('40%')
    );

    if (highImpactPlans.length > 0) {
      recommendations.push('High-impact contingency plans identified - consider additional time allocation');
    }

    const timeRelatedPlans = plans.filter(plan =>
      plan.resourceAdjustment.includes('time') || plan.triggerCondition.includes('time')
    );

    if (timeRelatedPlans.length > 2) {
      recommendations.push('Multiple time-related risks identified - implement strict timeline monitoring');
    }

    return recommendations;
  }
}
import type { RiskFactor, ContingencyPlan, DataSource, ResearchStep } from '../shared/interfaces.js';

/**
 * Risk Assessment Engine for the Planning Agent
 * Evaluates potential obstacles and creates mitigation strategies
 */
export class RiskAssessor {
  /**
   * Assess risks for a research plan
   */
  assessRisks(
    topic: string,
    dataSources: DataSource[],
    executionSteps: ResearchStep[],
    estimatedTimeline: string,
    methodology: string
  ): { risks: RiskFactor[]; contingencyPlans: ContingencyPlan[] } {
    const risks: RiskFactor[] = [];

    // Assess data availability risks
    risks.push(...this.assessDataAvailabilityRisks(dataSources, topic));

    // Assess API and rate limiting risks
    risks.push(...this.assessApiLimitRisks(dataSources));

    // Assess time constraint risks
    risks.push(...this.assessTimeConstraintRisks(executionSteps, estimatedTimeline));

    // Assess credibility and quality risks
    risks.push(...this.assessCredibilityRisks(dataSources, methodology));

    // Assess technical failure risks
    risks.push(...this.assessTechnicalFailureRisks(executionSteps));

    // Generate contingency plans based on identified risks
    const contingencyPlans = this.generateContingencyPlans(risks, dataSources, executionSteps);

    return { risks, contingencyPlans };
  }

  /**
   * Assess data availability risks
   */
  private assessDataAvailabilityRisks(dataSources: DataSource[], topic: string): RiskFactor[] {
    const risks: RiskFactor[] = [];

    for (const source of dataSources) {
      const availabilityRisk = this.calculateDataAvailabilityRisk(source, topic);

      if (availabilityRisk.probability !== 'low') {
        risks.push({
          type: 'data-availability',
          probability: availabilityRisk.probability,
          impact: availabilityRisk.impact,
          mitigationStrategy: availabilityRisk.mitigation,
          monitoringTrigger: `Check ${source.type} source availability before step execution`
        });
      }
    }

    // Assess overall data availability diversity
    const sourceTypes = [...new Set(dataSources.map(s => s.type))];
    if (sourceTypes.length < 2) {
      risks.push({
        type: 'data-availability',
        probability: 'medium',
        impact: 'high',
        mitigationStrategy: 'Add backup data sources from different types',
        monitoringTrigger: 'Monitor for single point of failure in data sources'
      });
    }

    return risks;
  }

  /**
   * Calculate data availability risk for a specific source
   */
  private calculateDataAvailabilityRisk(
    source: DataSource,
    topic: string
  ): { probability: 'low' | 'medium' | 'high'; impact: 'low' | 'medium' | 'high'; mitigation: string } {
    let probability: 'low' | 'medium' | 'high' = 'low';
    let impact: 'low' | 'medium' | 'high' = 'medium';

    // Academic sources have higher availability risk due to paywalls
    if (source.type === 'academic') {
      probability = 'medium';
      impact = 'high';
    }

    // Statistical sources may have limited public access
    if (source.type === 'statistical') {
      probability = 'medium';
      impact = 'medium';
    }

    // News sources are generally available but may have API limits
    if (source.type === 'news') {
      probability = 'low';
      impact = 'medium';
    }

    // Web sources are most available
    if (source.type === 'web') {
      probability = 'low';
      impact = 'low';
    }

    // Increase risk for high-priority sources
    if (source.priority <= 2) {
      impact = impact === 'low' ? 'medium' : 'high';
    }

    const mitigation = this.getDataAvailabilityMitigation(source.type);

    return { probability, impact, mitigation };
  }

  /**
   * Get mitigation strategy for data availability issues
   */
  private getDataAvailabilityMitigation(sourceType: string): string {
    switch (sourceType) {
      case 'academic':
        return 'Use Google Scholar API as primary, Semantic Scholar as backup, implement paywall detection';
      case 'statistical':
        return 'Cache statistical data when available, use government open data portals';
      case 'news':
        return 'Implement multiple news APIs (NewsAPI, Bing News), cache recent articles';
      case 'web':
        return 'Use multiple search engines (Google, Bing), implement content caching';
      default:
        return 'Implement fallback data sources and caching mechanisms';
    }
  }

  /**
   * Assess API and rate limiting risks
   */
  private assessApiLimitRisks(dataSources: DataSource[]): RiskFactor[] {
    const risks: RiskFactor[] = [];

    for (const source of dataSources) {
      if (source.rateLimits) {
        const usageRisk = this.calculateApiUsageRisk(source);

        if (usageRisk.probability !== 'low') {
          risks.push({
            type: 'api-limits',
            probability: usageRisk.probability,
            impact: usageRisk.impact,
            mitigationStrategy: usageRisk.mitigation,
            monitoringTrigger: `Monitor API usage for ${source.type} source`
          });
        }
      }
    }

    // Assess concurrent API usage risk
    const highUsageSources = dataSources.filter(s =>
      s.rateLimits && s.rateLimits.requestsPerMinute < 20
    );

    if (highUsageSources.length > 2) {
      risks.push({
        type: 'api-limits',
        probability: 'high',
        impact: 'high',
        mitigationStrategy: 'Implement request queuing and rate limit distribution across time',
        monitoringTrigger: 'Monitor total API usage across all sources'
      });
    }

    return risks;
  }

  /**
   * Calculate API usage risk for a source
   */
  private calculateApiUsageRisk(source: DataSource): {
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  } {
    if (!source.rateLimits) {
      return { probability: 'low', impact: 'low', mitigation: 'No specific mitigation needed' };
    }

    const { requestsPerMinute, requestsPerHour } = source.rateLimits;
    let probability: 'low' | 'medium' | 'high' = 'low';
    let impact: 'low' | 'medium' | 'high' = 'medium';

    // Very restrictive rate limits
    if (requestsPerMinute < 5 || requestsPerHour < 50) {
      probability = 'high';
      impact = 'high';
    }
    // Moderately restrictive
    else if (requestsPerMinute < 15 || requestsPerHour < 200) {
      probability = 'medium';
      impact = 'medium';
    }

    // Higher impact for high-priority sources
    if (source.priority <= 2 && probability !== 'low') {
      impact = 'high';
    }

    const mitigation = this.getApiLimitMitigation(source.rateLimits);

    return { probability, impact, mitigation };
  }

  /**
   * Get mitigation strategy for API rate limits
   */
  private getApiLimitMitigation(rateLimits: { requestsPerMinute: number; requestsPerHour: number }): string {
    const { requestsPerMinute } = rateLimits;

    if (requestsPerMinute < 10) {
      return 'Implement request batching, caching, and distributed execution with delays';
    } else if (requestsPerMinute < 30) {
      return 'Use request throttling and implement exponential backoff for rate limit errors';
    } else {
      return 'Monitor usage and implement basic rate limiting';
    }
  }

  /**
   * Assess time constraint risks
   */
  private assessTimeConstraintRisks(executionSteps: ResearchStep[], estimatedTimeline: string): RiskFactor[] {
    const risks: RiskFactor[] = [];
    const totalEstimatedTime = executionSteps.reduce((sum, step) => sum + step.estimatedDuration, 0);

    // Parse estimated timeline
    const timelineMatch = /(\d+)\s*(hour|day|week)/i.exec(estimatedTimeline);
    let timelineHours = 0;

    if (timelineMatch) {
      const [, timeValue, timeUnit] = timelineMatch;
      if (timeValue && timeUnit) {
        const value = parseInt(timeValue);

        switch (timeUnit.toLowerCase()) {
          case 'hour':
            timelineHours = value;
            break;
          case 'day':
            timelineHours = value * 24;
            break;
          case 'week':
            timelineHours = value * 24 * 7;
            break;
        }
      }
    }

    // Check if estimated execution time exceeds timeline
    if (timelineHours > 0 && totalEstimatedTime / 60 > timelineHours) {
      risks.push({
        type: 'time-constraints',
        probability: 'high',
        impact: 'high',
        mitigationStrategy: 'Prioritize critical steps, implement parallel execution, reduce scope if necessary',
        monitoringTrigger: 'Monitor execution time vs timeline throughout research process'
      });
    }

    // Check for steps with high time variance
    const highVarianceSteps = executionSteps.filter(step =>
      step.agentType === 'academic-research' || step.agentType === 'data-analysis'
    );

    if (highVarianceSteps.length > 0) {
      risks.push({
        type: 'time-constraints',
        probability: 'medium',
        impact: 'medium',
        mitigationStrategy: 'Allocate buffer time for complex steps, implement progress checkpoints',
        monitoringTrigger: 'Track progress of time-intensive steps'
      });
    }

    return risks;
  }

  /**
   * Assess credibility and quality risks
   */
  private assessCredibilityRisks(dataSources: DataSource[], methodology: string): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Assess source credibility diversity
    const avgCredibility = dataSources.reduce((sum, source) => sum + source.credibilityWeight, 0) / dataSources.length;

    if (avgCredibility < 0.7) {
      risks.push({
        type: 'credibility-concerns',
        probability: 'medium',
        impact: 'high',
        mitigationStrategy: 'Implement credibility scoring and cross-validation across sources',
        monitoringTrigger: 'Validate source credibility scores and implement quality thresholds'
      });
    }

    // Assess methodology-specific credibility risks
    if (methodology === 'exploratory') {
      risks.push({
        type: 'credibility-concerns',
        probability: 'medium',
        impact: 'medium',
        mitigationStrategy: 'Supplement exploratory findings with systematic validation steps',
        monitoringTrigger: 'Cross-reference exploratory findings with credible sources'
      });
    }

    // Assess single-source dependency risks
    const sourcesByType = dataSources.reduce((acc, source) => {
      acc[source.type] = (acc[source.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const highDependencyTypes = Object.entries(sourcesByType)
      .filter(([, count]) => count > dataSources.length * 0.6)
      .map(([type]) => type);

    if (highDependencyTypes.length > 0) {
      risks.push({
        type: 'credibility-concerns',
        probability: 'medium',
        impact: 'medium',
        mitigationStrategy: `Reduce dependency on ${highDependencyTypes.join(', ')} sources by adding diverse alternatives`,
        monitoringTrigger: 'Monitor source type distribution and credibility balance'
      });
    }

    return risks;
  }

  /**
   * Assess technical failure risks
   */
  private assessTechnicalFailureRisks(executionSteps: ResearchStep[]): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Assess agent failure risks
    const agentTypes = [...new Set(executionSteps.map(step => step.agentType))];

    if (agentTypes.length > 3) {
      risks.push({
        type: 'technical-failures',
        probability: 'medium',
        impact: 'medium',
        mitigationStrategy: 'Implement agent health monitoring and automatic failover mechanisms',
        monitoringTrigger: 'Monitor agent availability and implement circuit breaker patterns'
      });
    }

    // Assess network dependency risks
    const networkDependentSteps = executionSteps.filter(step =>
      step.agentType !== 'data-analysis' // Assuming data analysis is local
    );

    if (networkDependentSteps.length > executionSteps.length * 0.8) {
      risks.push({
        type: 'technical-failures',
        probability: 'medium',
        impact: 'high',
        mitigationStrategy: 'Implement offline caching, retry mechanisms, and network resilience patterns',
        monitoringTrigger: 'Monitor network connectivity and implement graceful degradation'
      });
    }

    return risks;
  }

  /**
   * Generate contingency plans based on identified risks
   */
  private generateContingencyPlans(
    risks: RiskFactor[],
    dataSources: DataSource[],
    executionSteps: ResearchStep[]
  ): ContingencyPlan[] {
    const plans: ContingencyPlan[] = [];

    for (const risk of risks) {
      const plan = this.createContingencyPlan(risk, dataSources, executionSteps);
      if (plan) {
        plans.push(plan);
      }
    }

    return plans;
  }

  /**
   * Create a contingency plan for a specific risk
   */
  private createContingencyPlan(
    risk: RiskFactor,
    dataSources: DataSource[],
    executionSteps: ResearchStep[]
  ): ContingencyPlan | null {
    switch (risk.type) {
      case 'data-availability':
        return {
          triggerCondition: 'Data source becomes unavailable or returns insufficient results',
          fallbackStrategy: 'Switch to backup data sources and adjust research scope',
          resourceAdjustment: 'Allocate additional time for alternative data collection',
          estimatedImpact: '10-30% increase in research time, potential reduction in scope'
        };

      case 'api-limits':
        return {
          triggerCondition: 'API rate limits exceeded or service unavailable',
          fallbackStrategy: 'Implement request queuing, use cached data, switch to alternative APIs',
          resourceAdjustment: 'Add delay buffers between requests, reduce concurrent operations',
          estimatedImpact: '20-50% increase in execution time for affected steps'
        };

      case 'time-constraints':
        return {
          triggerCondition: 'Research execution exceeds time estimates',
          fallbackStrategy: 'Prioritize critical findings, reduce scope of non-essential steps',
          resourceAdjustment: 'Reallocate time from low-priority to high-priority steps',
          estimatedImpact: 'Potential reduction in research comprehensiveness'
        };

      case 'credibility-concerns':
        return {
          triggerCondition: 'Source credibility falls below threshold',
          fallbackStrategy: 'Replace low-credibility sources, implement additional validation steps',
          resourceAdjustment: 'Add validation time and potentially extend research timeline',
          estimatedImpact: 'Improved result quality with moderate time increase'
        };

      case 'technical-failures':
        return {
          triggerCondition: 'Agent or network failures occur',
          fallbackStrategy: 'Retry failed operations, switch to backup agents, implement manual processing',
          resourceAdjustment: 'Add retry attempts and monitoring overhead',
          estimatedImpact: '5-15% increase in execution time with improved reliability'
        };

      default:
        return null;
    }
  }

  /**
   * Get risk assessment summary
   */
  getRiskSummary(risks: RiskFactor[]): {
    overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskBreakdown: Record<string, number>;
    recommendations: string[];
  } {
    const riskCounts = risks.reduce((acc, risk) => {
      acc[risk.type] = (acc[risk.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate overall risk level
    const highImpactRisks = risks.filter(r => r.impact === 'high').length;
    const highProbRisks = risks.filter(r => r.probability === 'high').length;

    let overallRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (highImpactRisks > 2 || highProbRisks > 1) {
      overallRiskLevel = 'critical';
    } else if (highImpactRisks > 0 || highProbRisks > 0 || risks.length > 5) {
      overallRiskLevel = 'high';
    } else if (risks.length > 2) {
      overallRiskLevel = 'medium';
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (overallRiskLevel === 'critical') {
      recommendations.push('Consider simplifying research scope or extending timeline');
      recommendations.push('Implement comprehensive monitoring and manual oversight');
    } else if (overallRiskLevel === 'high') {
      recommendations.push('Add additional buffer time and backup resources');
      recommendations.push('Implement automated monitoring and alerting');
    } else if (overallRiskLevel === 'medium') {
      recommendations.push('Monitor high-risk areas closely');
      recommendations.push('Prepare contingency plans for identified risks');
    }

    return {
      overallRiskLevel,
      riskBreakdown: riskCounts,
      recommendations
    };
  }
}
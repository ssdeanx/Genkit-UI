import type { ResearchStepResult, SourceCitation, ResearchFinding, OrchestrationState, QualityThreshold } from '../shared/interfaces.js';

/**
 * Quality Validation System for the Orchestrator Agent
 * Validates research quality, source credibility, and cross-verification
 */
export class QualityValidator {
  private credibilityWeights: Record<string, number> = {
    'academic': 0.95,
    'government': 0.90,
    'news': 0.75,
    'web': 0.60,
    'social': 0.40,
    'statistical': 0.85
  };

  private recencyWeights: Record<string, number> = {
    'current': 1.0,    // Within 1 week
    'recent': 0.9,     // Within 1 month
    'moderate': 0.7,   // Within 6 months
    'old': 0.4,        // Within 1 year
    'outdated': 0.2    // Over 1 year
  };

  /**
   * Validate overall quality of research results
   */
  validateResearchQuality(
    results: ResearchStepResult[],
    orchestrationState: OrchestrationState
  ): {
    overallScore: number;
    qualityBreakdown: {
      sourceCredibility: number;
      dataConsistency: number;
      crossValidation: number;
      recency: number;
      completeness: number;
    };
    issues: QualityIssue[];
    recommendations: string[];
    meetsThresholds: boolean;
  } {
    const sourceCredibility = this.calculateSourceCredibility(results);
    const dataConsistency = this.calculateDataConsistency(results);
    const crossValidation = this.calculateCrossValidation(results);
    const recency = this.calculateRecencyScore(results);
    const completeness = this.calculateCompleteness(results);

    const qualityBreakdown = {
      sourceCredibility,
      dataConsistency,
      crossValidation,
      recency,
      completeness
    };

    // Weighted overall score
    const weights = { sourceCredibility: 0.3, dataConsistency: 0.25, crossValidation: 0.25, recency: 0.1, completeness: 0.1 };
    const overallScore = Object.entries(qualityBreakdown).reduce(
      (sum, [key, value]) => sum + (value * weights[key as keyof typeof weights]),
      0
    );

    const issues = this.identifyQualityIssues(results, qualityBreakdown, orchestrationState);
    const recommendations = this.generateRecommendations(issues, qualityBreakdown);

    const meetsThresholds = this.checkThresholdCompliance(overallScore, qualityBreakdown, orchestrationState.plan.qualityThresholds);

    return {
      overallScore,
      qualityBreakdown,
      issues,
      recommendations,
      meetsThresholds
    };
  }

  /**
   * Calculate source credibility score
   */
  private calculateSourceCredibility(results: ResearchStepResult[]): number {
    const allSources = this.extractAllSources(results);
    if (allSources.length === 0) {
      return 0;
    }

    const credibilityScores = allSources.map(source => {
      const baseWeight = this.credibilityWeights[source.type] || 0.5;
      const recencyMultiplier = this.getRecencyMultiplier(source.accessedAt || new Date());
      return baseWeight * recencyMultiplier * source.credibilityScore;
    });

    return credibilityScores.reduce((sum, score) => sum + score, 0) / credibilityScores.length;
  }

  /**
   * Calculate data consistency across results
   */
  private calculateDataConsistency(results: ResearchStepResult[]): number {
    if (results.length < 2) {
      return 1.0; // Single result is perfectly consistent
    }

    const findings = this.extractAllFindings(results);
    const consistencyPairs = this.calculateFindingConsistencyPairs(findings);

    if (consistencyPairs.length === 0) {
      return 0.5; // No comparable findings
    }

    const averageConsistency = consistencyPairs.reduce((sum, pair) => sum + pair.consistency, 0) / consistencyPairs.length;
    return averageConsistency;
  }

  /**
   * Calculate cross-validation score
   */
  private calculateCrossValidation(results: ResearchStepResult[]): number {
    const findings = this.extractAllFindings(results);
    const sourcesPerFinding = findings.map(f => f.sources?.length || 0);

    if (sourcesPerFinding.length === 0) return 0;

    const averageSources = sourcesPerFinding.reduce((sum, count) => sum + count, 0) / sourcesPerFinding.length;
    return Math.min(averageSources / 3, 1.0); // Normalize to 3+ sources = perfect score
  }

  /**
   * Calculate recency score of sources
   */
  private calculateRecencyScore(results: ResearchStepResult[]): number {
    const allSources = this.extractAllSources(results);
    if (allSources.length === 0) return 0;

    const recencyScores = allSources.map(source => {
      const recencyCategory = this.categorizeRecency(source.accessedAt || new Date());
      return this.recencyWeights[recencyCategory];
    });

    return recencyScores.reduce((sum, score) => sum + score, 0) / recencyScores.length;
  }

  /**
   * Calculate completeness of research coverage
   */
  private calculateCompleteness(results: ResearchStepResult[]): number {
    let totalExpectedElements = 0;
    let totalPresentElements = 0;

    for (const result of results) {
      const expectedElements = this.calculateExpectedElements(result);
      const presentElements = this.countPresentElements(result);

      totalExpectedElements += expectedElements;
      totalPresentElements += presentElements;
    }

    return totalExpectedElements > 0 ? totalPresentElements / totalExpectedElements : 0;
  }

  /**
   * Extract all sources from results
   */
  private extractAllSources(results: ResearchStepResult[]): SourceCitation[] {
    const allSources: SourceCitation[] = [];

    for (const result of results) {
      if (result.sources && Array.isArray(result.sources)) {
        allSources.push(...result.sources);
      }
    }

    return allSources;
  }

  /**
   * Extract all findings from results
   */
  private extractAllFindings(results: ResearchStepResult[]): ResearchFinding[] {
    const allFindings: ResearchFinding[] = [];

    for (const result of results) {
      if (result.data && typeof result.data === 'object') {
        const data = result.data as any;

        if (data.findings && Array.isArray(data.findings)) {
          // Convert to ResearchFinding format if needed
          data.findings.forEach((finding: any) => {
            allFindings.push({
              claim: finding.claim || finding.statement || '',
              evidence: finding.evidence || finding.explanation || '',
              confidence: finding.confidence || 0.5,
              sources: finding.sourceIndices || [],
              category: finding.category || 'factual'
            });
          });
        }
      }
    }

    return allFindings;
  }

  /**
   * Calculate finding consistency pairs
   */
  private calculateFindingConsistencyPairs(findings: ResearchFinding[]): Array<{
    finding1: ResearchFinding;
    finding2: ResearchFinding;
    consistency: number;
  }> {
    const pairs: Array<{
      finding1: ResearchFinding;
      finding2: ResearchFinding;
      consistency: number;
    }> = [];

    for (let i = 0; i < findings.length; i++) {
      for (let j = i + 1; j < findings.length; j++) {
        const consistency = this.calculateFindingSimilarity(findings[i], findings[j]);
        pairs.push({
          finding1: findings[i],
          finding2: findings[j],
          consistency
        });
      }
    }

    return pairs;
  }

  /**
   * Calculate similarity between two findings
   */
  private calculateFindingSimilarity(finding1: ResearchFinding, finding2: ResearchFinding): number {
    // Simple text similarity based on claims
    const claim1 = finding1.claim.toLowerCase();
    const claim2 = finding2.claim.toLowerCase();

    const words1 = new Set(claim1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(claim2.split(/\s+/).filter(w => w.length > 2));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    const textSimilarity = intersection.size / union.size;

    // Factor in confidence agreement
    const confidenceSimilarity = 1 - Math.abs(finding1.confidence - finding2.confidence);

    // Weighted combination
    return (textSimilarity * 0.7) + (confidenceSimilarity * 0.3);
  }

  /**
   * Get recency multiplier for a date
   */
  private getRecencyMultiplier(accessDate: Date): number {
    const daysSinceAccess = (Date.now() - accessDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceAccess <= 7) return 1.0;      // Within 1 week
    if (daysSinceAccess <= 30) return 0.9;     // Within 1 month
    if (daysSinceAccess <= 180) return 0.7;    // Within 6 months
    if (daysSinceAccess <= 365) return 0.4;    // Within 1 year
    return 0.2;                                // Over 1 year
  }

  /**
   * Categorize recency of a date
   */
  private categorizeRecency(accessDate: Date): keyof typeof QualityValidator.prototype.recencyWeights {
    const daysSinceAccess = (Date.now() - accessDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceAccess <= 7) return 'current';
    if (daysSinceAccess <= 30) return 'recent';
    if (daysSinceAccess <= 180) return 'moderate';
    if (daysSinceAccess <= 365) return 'old';
    return 'outdated';
  }

  /**
   * Calculate expected elements for a result
   */
  private calculateExpectedElements(result: ResearchStepResult): number {
    // Expected elements: sources, quality score, processing time, metadata
    let expected = 4;

    // Add expectations based on result data structure
    if (result.data && typeof result.data === 'object') {
      const data = result.data as any;
      if (data.findings && Array.isArray(data.findings)) {
        expected += data.findings.length * 3; // claim, evidence, confidence per finding
      }
    }

    return expected;
  }

  /**
   * Count present elements in a result
   */
  private countPresentElements(result: ResearchStepResult): number {
    let present = 0;

    if (result.sources && result.sources.length > 0) present++;
    if (result.qualityScore !== undefined && result.qualityScore >= 0) present++;
    if (result.processingTime && result.processingTime > 0) present++;
    if (result.metadata && Object.keys(result.metadata).length > 0) present++;

    // Count data elements
    if (result.data && typeof result.data === 'object') {
      const data = result.data as any;
      if (data.findings && Array.isArray(data.findings)) {
        data.findings.forEach((finding: any) => {
          if (finding.claim) present++;
          if (finding.evidence) present++;
          if (finding.confidence !== undefined) present++;
        });
      }
    }

    return present;
  }

  /**
   * Identify quality issues
   */
  private identifyQualityIssues(
    results: ResearchStepResult[],
    qualityBreakdown: any,
    orchestrationState: OrchestrationState
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Source credibility issues
    if (qualityBreakdown.sourceCredibility < 0.6) {
      issues.push({
        type: 'low-source-credibility',
        severity: qualityBreakdown.sourceCredibility < 0.3 ? 'high' : 'medium',
        description: `Source credibility score is ${qualityBreakdown.sourceCredibility.toFixed(2)} (below recommended threshold)`,
        affectedSteps: results.map(r => r.stepId),
        suggestedFix: 'Include more academic or government sources'
      });
    }

    // Data consistency issues
    if (qualityBreakdown.dataConsistency < 0.7) {
      issues.push({
        type: 'inconsistent-data',
        severity: qualityBreakdown.dataConsistency < 0.4 ? 'high' : 'medium',
        description: `Data consistency score is ${qualityBreakdown.dataConsistency.toFixed(2)} (findings show significant disagreement)`,
        affectedSteps: results.map(r => r.stepId),
        suggestedFix: 'Cross-validate findings across multiple sources'
      });
    }

    // Cross-validation issues
    if (qualityBreakdown.crossValidation < 0.5) {
      issues.push({
        type: 'insufficient-cross-validation',
        severity: 'medium',
        description: `Cross-validation score is ${qualityBreakdown.crossValidation.toFixed(2)} (findings not sufficiently corroborated)`,
        affectedSteps: results.map(r => r.stepId),
        suggestedFix: 'Ensure each key finding is supported by multiple sources'
      });
    }

    // Recency issues
    if (qualityBreakdown.recency < 0.6) {
      issues.push({
        type: 'outdated-sources',
        severity: 'low',
        description: `Source recency score is ${qualityBreakdown.recency.toFixed(2)} (sources may be outdated)`,
        affectedSteps: results.map(r => r.stepId),
        suggestedFix: 'Include more recent sources and data'
      });
    }

    // Completeness issues
    if (qualityBreakdown.completeness < 0.8) {
      issues.push({
        type: 'incomplete-data',
        severity: 'medium',
        description: `Data completeness score is ${qualityBreakdown.completeness.toFixed(2)} (missing expected information)`,
        affectedSteps: results.map(r => r.stepId),
        suggestedFix: 'Ensure all research steps provide complete results'
      });
    }

    return issues;
  }

  /**
   * Generate recommendations based on quality issues
   */
  private generateRecommendations(issues: QualityIssue[], qualityBreakdown: any): string[] {
    const recommendations: string[] = [];

    if (issues.some(i => i.type === 'low-source-credibility')) {
      recommendations.push('Prioritize academic journals, government publications, and peer-reviewed sources');
      recommendations.push('Verify source credibility using fact-checking services');
    }

    if (issues.some(i => i.type === 'inconsistent-data')) {
      recommendations.push('Cross-reference conflicting findings with additional sources');
      recommendations.push('Consider the context and date of conflicting information');
    }

    if (issues.some(i => i.type === 'insufficient-cross-validation')) {
      recommendations.push('Ensure each major finding is supported by at least 3 independent sources');
      recommendations.push('Use triangulation methods to validate findings from multiple angles');
    }

    if (issues.some(i => i.type === 'outdated-sources')) {
      recommendations.push('Supplement with recent publications and current data');
      recommendations.push('Note the publication dates of key sources in the final report');
    }

    if (issues.some(i => i.type === 'incomplete-data')) {
      recommendations.push('Re-run incomplete research steps with more comprehensive queries');
      recommendations.push('Combine results from multiple specialized agents for better coverage');
    }

    // General recommendations based on scores
    if (qualityBreakdown.overallScore < 0.7) {
      recommendations.push('Consider additional research iterations to improve quality scores');
    }

    return recommendations;
  }

  /**
   * Check if quality meets defined thresholds
   */
  private checkThresholdCompliance(
    overallScore: number,
    qualityBreakdown: any,
    thresholds: QualityThreshold[]
  ): boolean {
    if (!thresholds || thresholds.length === 0) {
      return overallScore >= 0.7; // Default threshold
    }

    return thresholds.every(threshold => {
      const actualValue = qualityBreakdown[threshold.metric] || 0;
      return actualValue >= threshold.minimumValue;
    });
  }

  /**
   * Validate individual source credibility
   */
  validateSourceCredibility(source: SourceCitation): {
    isValid: boolean;
    credibilityScore: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let credibilityScore = source.credibilityScore;

    // Check source type credibility
    const typeWeight = this.credibilityWeights[source.type] || 0.5;
    if (typeWeight < 0.7) {
      issues.push(`Source type '${source.type}' has lower inherent credibility`);
      recommendations.push('Consider supplementing with higher-credibility sources');
    }

    // Check recency
    const recencyCategory = this.categorizeRecency(source.accessedAt || new Date());
    if (recencyCategory === 'outdated') {
      issues.push('Source data may be outdated');
      credibilityScore *= 0.8;
      recommendations.push('Verify if more recent data is available');
    }

    // Check for missing metadata
    if (!source.author) {
      issues.push('Source missing author information');
      credibilityScore *= 0.9;
    }

    if (!source.publicationDate) {
      issues.push('Source missing publication date');
      credibilityScore *= 0.9;
    }

    const isValid = issues.length === 0 || credibilityScore >= 0.6;

    return {
      isValid,
      credibilityScore,
      issues,
      recommendations
    };
  }

  /**
   * Detect potential biases in research results
   */
  detectBiases(results: ResearchStepResult[]): Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    affectedFindings: string[];
    mitigationStrategy: string;
  }> {
    const biases: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      affectedFindings: string[];
      mitigationStrategy: string;
    }> = [];

    const findings = this.extractAllFindings(results);

    // Check for confirmation bias (similar findings from same source type)
    const sourceTypeClusters = this.detectSourceTypeClusters(findings);
    if (sourceTypeClusters.length > 0) {
      biases.push({
        type: 'confirmation-bias',
        description: 'Multiple findings supported primarily by same source types',
        severity: 'medium',
        affectedFindings: sourceTypeClusters.flat(),
        mitigationStrategy: 'Include diverse source types to validate findings'
      });
    }

    // Check for recency bias (over-reliance on recent sources)
    const recencyBias = this.detectRecencyBias(results);
    if (recencyBias) {
      biases.push({
        type: 'recency-bias',
        description: 'Over-reliance on recent sources without historical context',
        severity: 'low',
        affectedFindings: recencyBias.affectedFindings,
        mitigationStrategy: 'Include historical data and long-term trends'
      });
    }

    // Check for geographic bias
    const geographicBias = this.detectGeographicBias(results);
    if (geographicBias) {
      biases.push({
        type: 'geographic-bias',
        description: 'Sources primarily from limited geographic regions',
        severity: 'medium',
        affectedFindings: geographicBias.affectedFindings,
        mitigationStrategy: 'Include sources from diverse geographic regions'
      });
    }

    return biases;
  }

  /**
   * Detect clusters of findings from same source types
   */
  private detectSourceTypeClusters(findings: ResearchFinding[]): string[][] {
    const clusters: string[][] = [];

    findings.forEach(finding => {
      const sourceTypes = finding.sources.map(idx => `source-${idx}`);
      // Simple clustering: findings with identical source type patterns
      const existingCluster = clusters.find(cluster =>
        cluster.length === sourceTypes.length &&
        cluster.every(type => sourceTypes.includes(type))
      );

      if (existingCluster) {
        existingCluster.push(finding.claim);
      } else {
        clusters.push([finding.claim]);
      }
    });

    return clusters.filter(cluster => cluster.length > 2); // Only significant clusters
  }

  /**
   * Detect recency bias in results
   */
  private detectRecencyBias(results: ResearchStepResult[]): { affectedFindings: string[] } | null {
    const allSources = this.extractAllSources(results);
    const recencyScores = allSources.map(s => this.categorizeRecency(s.accessedAt || new Date()));

    const recentCount = recencyScores.filter(r => r === 'current' || r === 'recent').length;
    const totalCount = recencyScores.length;

    if (totalCount > 0 && (recentCount / totalCount) > 0.8) {
      // Over 80% recent sources
      const findings = this.extractAllFindings(results);
      return {
        affectedFindings: findings.map(f => f.claim)
      };
    }

    return null;
  }

  /**
   * Detect geographic bias in sources
   */
  private detectGeographicBias(results: ResearchStepResult[]): { affectedFindings: string[] } | null {
    // This is a simplified implementation - in practice, you'd analyze source domains
    // for geographic indicators (.uk, .de, .jp, etc.)
    const allSources = this.extractAllSources(results);
    const domains = allSources.map(s => {
      try {
        return new URL(s.url).hostname;
      } catch {
        return '';
      }
    }).filter(d => d);

    // Simple check: if most domains share the same TLD
    const tlds = domains.map(d => d.split('.').pop()).filter((tld): tld is string => tld !== undefined && tld.length === 2);
    const tldCounts: Record<string, number> = {};
    tlds.forEach(tld => {
      if (tldCounts.hasOwnProperty(tld)) {
        tldCounts[tld] += 1;
      } else {
        tldCounts[tld] = 1;
      }
    });

    const maxTldCount = Math.max(...Object.values(tldCounts));
    const totalDomains = domains.length;

    if (totalDomains > 5 && (maxTldCount / totalDomains) > 0.7) {
      // Over 70% from same geographic region
      const findings = this.extractAllFindings(results);
      return {
        affectedFindings: findings.map(f => f.claim)
      };
    }

    return null;
  }
}

interface QualityIssue {
  type: 'low-source-credibility' | 'inconsistent-data' | 'insufficient-cross-validation' | 'outdated-sources' | 'incomplete-data';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedSteps: string[];
  suggestedFix: string;
}
import type {
  ResearchStepResult,
  SourceCitation,
  OrchestrationState,
  ResearchFinding,
  ResearchResult,
  ResearchPlan // added
} from '../shared/interfaces.js';

/**
 * Result Aggregation System for the Orchestrator Agent
 * Collects, validates, and merges results from multiple research agents
 */
export class ResultAggregator {
  private resultCache: Map<string, ResearchStepResult[]> = new Map();
  private sourceDeduplicationCache: Map<string, SourceCitation> = new Map();

  /**
   * Aggregate results from completed research steps
   */
  aggregateResults(
    completedResults: ResearchStepResult[],
    orchestrationState: OrchestrationState
  ): ResearchResult {
    const { researchId, plan } = orchestrationState;

    // Cache results for this research
    this.resultCache.set(researchId, completedResults);

    // Extract and deduplicate sources
    const allSources = this.extractAllSources(completedResults);
    const deduplicatedSources = this.deduplicateSources(allSources);

    // Extract and consolidate findings
    const allFindings = this.extractAllFindings(completedResults);
    const consolidatedFindings = this.consolidateFindings(allFindings, deduplicatedSources);

    // Calculate overall confidence and processing time
    const overallConfidence = this.calculateOverallConfidence(completedResults);
    const totalProcessingTime = this.calculateTotalProcessingTime(completedResults);

    // Generate methodology summary
    const methodology = this.generateMethodologySummary(plan, completedResults);

    return {
      topic: plan.topic,
      findings: consolidatedFindings,
      sources: deduplicatedSources,
      methodology,
      confidence: overallConfidence,
      generatedAt: new Date(),
      processingTime: totalProcessingTime
    };
  }

  /**
   * Extract all sources from research step results
   */
  extractAllSources(results: ResearchStepResult[]): SourceCitation[] {
    if (results.length === 0) {
      return [];
    }

    const allSources: SourceCitation[] = [];
    for (const res of results) {
      if (Array.isArray(res.sources) && res.sources.length > 0) {
        for (const s of res.sources) {
          allSources.push(s);
        }
      }
    }
    return allSources;
  }

  /**
   * Deduplicate sources based on URL similarity and content
   */
  protected deduplicateSources(sources: SourceCitation[]): SourceCitation[] {
    const deduplicated: SourceCitation[] = [];
    const seen = new Set<string>();

    for (const source of sources) {
      const key = this.generateSourceKey(source);

      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(source);
        this.sourceDeduplicationCache.set(key, source);
      } else {
        // Merge credibility scores for duplicate sources
        const existing = this.sourceDeduplicationCache.get(key);
        if (existing) {
          existing.credibilityScore = Math.max(existing.credibilityScore, source.credibilityScore);
        }
      }
    }

    return deduplicated;
  }

  /**
   * Generate a unique key for source deduplication
   */
  private generateSourceKey(source: SourceCitation): string {
    // Normalize URL for comparison
    const normalizedUrl = this.normalizeUrl(source.url);

    // Create key from normalized URL and title
    const titleKey = source.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${normalizedUrl}:${titleKey}`;
  }

  /**
   * Normalize URL for comparison (remove protocol, www, trailing slashes, etc.)
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      let normalized = urlObj.hostname + urlObj.pathname;

      // Remove www prefix
      normalized = normalized.replace(/^www\./, '');

      // Remove trailing slashes
      normalized = normalized.replace(/\/$/, '');

      // Remove common tracking parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
      const searchParams = new URLSearchParams(urlObj.search);
      trackingParams.forEach(param => searchParams.delete(param));

      if (searchParams.toString()) {
        normalized += '?' + searchParams.toString();
      }

      return normalized.toLowerCase();
    } catch {
      // If URL parsing fails, return normalized string
      return url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    }
  }

  /**
   * Extract all findings from research step results
   */
  private extractAllFindings(results: ResearchStepResult[]): Array<{
    claim: string;
    evidence: string;
    confidence: number;
    sourceUrls: string[]; // changed from sourceIndices to concrete URLs
    category: 'factual' | 'analytical' | 'speculative';
    stepId: string;
  }> {
    const allFindings: Array<{
      claim: string;
      evidence: string;
      confidence: number;
      sourceUrls: string[];
      category: 'factual' | 'analytical' | 'speculative';
      stepId: string;
    }> = [];

    for (const result of results) {
      // Extract structured findings from result data
      if (typeof result.data === 'object' && result.data !== null) {
        // Narrow to a safe, unknown-based type instead of 'any'
        const data = result.data as Record<string, unknown>;

        if (Array.isArray(data.findings)) {
          const findingsArray = data.findings as unknown[];
          findingsArray.forEach((rawFinding: unknown, index: number) => {
            if (!this.isRecord(rawFinding)) {
              return;
            }

            const claim =
              this.asString(rawFinding['claim']) ??
              this.asString(rawFinding['statement']) ??
              `Finding ${index + 1}`;

            const evidence =
              this.asString(rawFinding['evidence']) ??
              this.asString(rawFinding['explanation']) ??
              '';

            // Compute confidence safely: prefer explicit numeric field, fallback to result.qualityScore if numeric, otherwise 0.
            const rawConfidence = this.asNumber(rawFinding['confidence']);
            const confidence =
              rawConfidence ?? (typeof result.qualityScore === 'number' ? result.qualityScore : 0);

            // Resolve source URLs for the finding:
            const sourceUrls: string[] = [];

            // 1) If the finding lists numeric indices, map them to the result.sources URLs (guarded)
            const idxs = this.asNumberArray(rawFinding['sourceIndices']);
            if (idxs && Array.isArray(result.sources)) {
              idxs.forEach(i => {
                const s = result.sources?.[i];
                if (s && typeof s.url === 'string') {
                  sourceUrls.push(s.url);
                }
              });
            }

            // 2) If the finding provides explicit URLs
            if (Array.isArray(rawFinding['sourceUrls'])) {
              (rawFinding['sourceUrls'] as unknown[]).forEach(u => {
                if (typeof u === 'string') { sourceUrls.push(u); }
              });
            }

            // 3) If the finding provides 'sources' objects with url fields
            if (Array.isArray(rawFinding['sources'])) {
              (rawFinding['sources'] as unknown[]).forEach(sObj => {
                if (this.isRecord(sObj) && typeof sObj['url'] === 'string') {
                  sourceUrls.push(sObj['url']);
                }
              });
            }

            // Deduplicate URLs for this finding
            const uniqueUrls = Array.from(new Set(sourceUrls));

            const rawCategory = this.asString(rawFinding['category']);
            const category =
              rawCategory === 'analytical' || rawCategory === 'speculative'
                ? (rawCategory)
                : 'factual';

            allFindings.push({
              claim,
              evidence,
              confidence,
              sourceUrls: uniqueUrls,
              category,
              stepId: result.stepId
            });
          });
        } else if (this.isRecord(data) && (typeof data['claim'] === 'string' || typeof data['statement'] === 'string')) {
          // Single finding in result (safe extraction)
          const claim = this.asString(data['claim']) ?? this.asString(data['statement']) ?? 'Finding';
          const evidence = this.asString(data['evidence']) ?? this.asString(data['explanation']) ?? '';
          const confidence = this.asNumber(data['confidence']) ?? result.qualityScore;

          // Resolve sources similarly for single finding
          const sourceUrls: string[] = [];

          const idxs = this.asNumberArray(data['sourceIndices']);
          if (idxs && Array.isArray(result.sources)) {
            idxs.forEach(i => {
              const s = result.sources?.[i];
              if (s && typeof s.url === 'string') {
                sourceUrls.push(s.url);
              }
            });
          }

          if (Array.isArray(data['sourceUrls'])) {
            (data['sourceUrls'] as unknown[]).forEach(u => {
              if (typeof u === 'string') {
                sourceUrls.push(u);
              }
            });
          }

          if (Array.isArray(data['sources'])) {
            (data['sources'] as unknown[]).forEach(sObj => {
              if (this.isRecord(sObj) && typeof sObj['url'] === 'string') {
                sourceUrls.push(sObj['url']);
              }
            });
          }

          const uniqueUrls = Array.from(new Set(sourceUrls));

          const rawCategory = this.asString(data['category']);
          const category =
            rawCategory === 'analytical' || rawCategory === 'speculative'
              ? (rawCategory)
              : 'factual';

          allFindings.push({
            claim,
            evidence,
            confidence,
            sourceUrls: uniqueUrls,
            category,
            stepId: result.stepId
          });
        }
      }
    }

    return allFindings;
  }

  /**
   * Consolidate findings by merging similar claims and resolving conflicts
   * Now maps per-finding source URLs into indices into the provided deduplicated sources array.
   */
  private consolidateFindings(
    findings: Array<{
      claim: string;
      evidence: string;
      confidence: number;
      sourceUrls: string[]; // updated to use URLs
      category: 'factual' | 'analytical' | 'speculative';
      stepId: string;
    }>,
    sources: SourceCitation[]
  ): ResearchFinding[] {
    const consolidated: ResearchFinding[] = [];
    const processedClaims = new Set<string>();

    // Precompute normalized URL -> index map for the provided deduplicated sources
    const sourceIndexByNormalizedUrl = new Map<string, number>();
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      if (s && typeof s.url === 'string') {
        sourceIndexByNormalizedUrl.set(this.normalizeUrl(s.url), i);
      }
    }

    // Group similar findings
    const claimGroups = this.groupSimilarFindings(findings);

    for (const group of claimGroups) {
      if (group.length === 0) {
        continue;
      }

      // Use the finding with highest confidence as primary
      const primaryFinding = group.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );

      // Merge evidence from all similar findings
      const allEvidence = group.map(f => f.evidence).filter(e => e);
      const consolidatedEvidence = this.consolidateEvidence(allEvidence);

      // Collect all source indices by resolving each finding's sourceUrls into indices in 'sources'
      const allSourceIndices = new Set<number>();
      group.forEach(finding => {
        (finding.sourceUrls ?? []).forEach(url => {
          const idx = sourceIndexByNormalizedUrl.get(this.normalizeUrl(url));
          if (typeof idx === 'number') {
            allSourceIndices.add(idx);
          }
        });
      });

      // Determine category based on agreement
      const category = this.determineConsensusCategory(group);

      consolidated.push({
        claim: primaryFinding.claim,
        evidence: consolidatedEvidence,
        confidence: this.calculateConsensusConfidence(group),
        sources: Array.from(allSourceIndices),
        category
      });

      processedClaims.add(primaryFinding.claim.toLowerCase());
    }

    return consolidated;
  }

  /**
   * Group similar findings based on claim similarity
   */
  private groupSimilarFindings(findings: Array<{
    claim: string;
    evidence: string;
    confidence: number;
    sourceUrls: string[];
    category: 'factual' | 'analytical' | 'speculative';
    stepId: string;
  }>): Array<typeof findings> {
    const groups: Array<typeof findings> = [];

    for (const finding of findings) {
      let addedToGroup = false;

      // Check if this finding is similar to any existing group
      for (const group of groups) {
        // Ensure the group has at least one element and the first claim exists
        if (group.length === 0) {
          continue;
        }

        const firstClaim = group[0]?.claim;
        if (typeof firstClaim === 'string' && firstClaim.length > 0 && this.areClaimsSimilar(finding.claim, firstClaim)) {
          group.push(finding);
          addedToGroup = true;
          break;
        }
      }

      // Create new group if no similar claims found
      if (!addedToGroup) {
        groups.push([finding]);
      }
    }

    return groups;
  }

  /**
   * Check if two claims are similar using simple text similarity
   */
  private areClaimsSimilar(claim1: string, claim2: string): boolean {
    const normalize = (text: string) =>
      text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2);

    const words1 = new Set(normalize(claim1));
    const words2 = new Set(normalize(claim2));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    const similarity = intersection.size / union.size;

    return similarity > 0.4; // 40% word overlap threshold
  }

  /**
   * Consolidate evidence from multiple similar findings
   */
  private consolidateEvidence(evidenceList: string[]): string {
    if (evidenceList.length === 0) {
      return '';
    }
    if (evidenceList.length === 1) {
      // ensure we always return a string (avoid string | undefined)
      return evidenceList[0] ?? '';
    }

    // Remove duplicates and very similar evidence
    const uniqueEvidence = this.deduplicateEvidence(evidenceList);

    if (uniqueEvidence.length === 1) {
      // ensure we always return a string (avoid string | undefined)
      return uniqueEvidence[0] ?? '';
    }

    // Combine evidence with clear separation
    return uniqueEvidence.join('\n\nAdditionally: ');
  }

  /**
   * Remove duplicate or very similar evidence
   */
  private deduplicateEvidence(evidenceList: string[]): string[] {
    const unique: string[] = [];

    for (const evidence of evidenceList) {
      const isDuplicate = unique.some(existing =>
        this.calculateTextSimilarity(evidence, existing) > 0.8
      );

      if (!isDuplicate) {
        unique.push(evidence);
      }
    }

    return unique;
  }

  /**
   * Calculate simple text similarity
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Determine consensus category from multiple findings
   */
  private determineConsensusCategory(findings: Array<{
    category: 'factual' | 'analytical' | 'speculative';
  }>): 'factual' | 'analytical' | 'speculative' {
    const categories = findings.map(f => f.category);
    const categoryCounts = categories.reduce((counts, cat) => {
      counts[cat] = (counts[cat] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    // Return category with highest count, default to 'factual'
    const sortedCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a);

    return (sortedCategories[0]?.[0] as 'factual' | 'analytical' | 'speculative') || 'factual';
  }

  /**
   * Calculate consensus confidence from multiple findings
   */
  private calculateConsensusConfidence(findings: Array<{ confidence: number }>): number {
    if (findings.length === 0) {
      return 0;
    }
    if (findings.length === 1) {
      // Safely handle the single-element case to avoid 'Object is possibly undefined'
      const only = findings[0];
      return typeof only?.confidence === 'number' ? only.confidence : 0;
    }

    // Use weighted average where higher confidence findings have more weight
    const totalWeight = findings.reduce((sum, f) => sum + f.confidence, 0);
    const weightedSum = findings.reduce((sum, f) => sum + (f.confidence * f.confidence), 0);

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  /**
   * Calculate overall confidence for the aggregated result
   */
  protected calculateOverallConfidence(results: ResearchStepResult[]): number {
    if (results.length === 0) {
      return 0;
    }

    const totalQuality = results.reduce((sum, result) => sum + result.qualityScore, 0);
    const averageQuality = totalQuality / results.length;

    // Factor in result consistency and source diversity
    const consistencyBonus = this.calculateConsistencyBonus(results);
    const sourceDiversityBonus = this.calculateSourceDiversityBonus(results);

    return Math.min(averageQuality * (1 + consistencyBonus + sourceDiversityBonus), 1.0);
  }

  /**
   * Calculate consistency bonus based on agreement between results
   */
  private calculateConsistencyBonus(results: ResearchStepResult[]): number {
    if (results.length < 2) {
      return 0;
    }

    // Simple consistency measure: average quality score variance
    const qualities = results.map(r => r.qualityScore);
    const mean = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
    const variance = qualities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / qualities.length;
    const standardDeviation = Math.sqrt(variance);

    // Lower variance = higher consistency bonus (max 0.2)
    return Math.max(0, 0.2 - (standardDeviation * 2));
  }

  /**
   * Calculate source diversity bonus
   */
  private calculateSourceDiversityBonus(results: ResearchStepResult[]): number {
    const uniqueSourceTypes = new Set<string>();

    for (const result of results) {
      if (Array.isArray(result.sources)) {
        result.sources.forEach(source => uniqueSourceTypes.add(source.type));
      }
    }

    // Bonus for having multiple source types (max 0.1)
    const diversityScore = Math.min(uniqueSourceTypes.size / 4, 1); // Normalize to 4 source types
    return diversityScore * 0.1;
  }

  /**
   * Calculate total processing time across all results
   */
  private calculateTotalProcessingTime(results: ResearchStepResult[]): number {
    return results.reduce((total, result) => total + result.processingTime, 0);
  }

  /**
   * Generate methodology summary from plan and results
   */
  private generateMethodologySummary(plan: ResearchPlan, results: ResearchStepResult[]): string {
    // Guard against unexpected plan shapes even though plan is now typed
    const approach = plan?.methodology?.approach ?? 'systematic';

    // Attempt to extract agent types from step IDs safely
    const rawAgentTypes = results
      .map(r => (typeof r.stepId === 'string' ? r.stepId.split('-')[1] : undefined))
      .filter((t): t is string => typeof t === 'string');

    const agentTypes = [...new Set(rawAgentTypes)];

    const stepCount = Array.isArray(plan.executionSteps) ? plan.executionSteps.length : 0;
    const topic = typeof plan.topic === 'string' ? plan.topic : 'unspecified topic';

    return `This research on "${topic}" used a ${approach} approach, combining data from ${agentTypes.length} different agent types: ${agentTypes.join(', ') || 'none'}. The methodology included ${stepCount} distinct research steps with quality validation and source verification.`;
  }

  /**
   * Validate result integrity and detect potential issues
   */
  validateResultIntegrity(aggregatedResult: ResearchResult): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for minimum requirements
    if (aggregatedResult.findings.length === 0) {
      issues.push('No findings generated from research');
    }

    if (aggregatedResult.sources.length === 0) {
      issues.push('No sources cited in research results');
    }

    // Check confidence levels
    const lowConfidenceFindings = aggregatedResult.findings.filter(f => f.confidence < 0.3);
    if (lowConfidenceFindings.length > aggregatedResult.findings.length * 0.5) {
      issues.push('More than 50% of findings have low confidence scores');
      recommendations.push('Consider additional verification steps for low-confidence findings');
    }

    // Check source diversity
    const sourceTypes = new Set(aggregatedResult.sources.map(s => s.type));
    if (sourceTypes.size < 2) {
      issues.push('Limited source type diversity');
      recommendations.push('Include results from additional agent types for better coverage');
    }

    // Check for contradictory findings
    const contradictions = this.detectContradictions(aggregatedResult.findings);
    if (contradictions.length > 0) {
      issues.push(`Found ${contradictions.length} potential contradictions in findings`);
      recommendations.push('Review and resolve contradictory findings manually');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Detect potential contradictions in findings
   */
  private detectContradictions(findings: ResearchFinding[]): Array<{
    finding1: ResearchFinding;
    finding2: ResearchFinding;
    contradictionType: string;
  }> {
    const contradictions: Array<{
      finding1: ResearchFinding;
      finding2: ResearchFinding;
      contradictionType: string;
    }> = [];

    // Simple contradiction detection based on keyword opposites
    const oppositePairs: Array<[string, string]> = [
      ['increase', 'decrease'],
      ['positive', 'negative'],
      ['effective', 'ineffective'],
      ['beneficial', 'harmful'],
      ['successful', 'unsuccessful']
    ];

    for (let i = 0; i < findings.length; i++) {
      for (let j = i + 1; j < findings.length; j++) {
        const finding1 = findings[i];
        const finding2 = findings[j];

        // Guard: ensure both findings are defined (satisfies TS strict checks)
        if (!finding1 || !finding2) {
          continue;
        }

        const text1 = (finding1.claim + ' ' + finding1.evidence).toLowerCase();
        const text2 = (finding2.claim + ' ' + finding2.evidence).toLowerCase();

        for (const pair of oppositePairs) {
          const [word1, word2] = pair;
          // runtime guard to satisfy TypeScript strictness and avoid calling includes on undefined
          if (!word1 || !word2) {
            continue;
          }

          if ((text1.includes(word1) && text2.includes(word2)) ||
              (text1.includes(word2) && text2.includes(word1))) {
            contradictions.push({
              finding1,
              finding2,
              contradictionType: `${word1} vs ${word2}`
            });
          }
        }
      }
    }

    return contradictions;
  }

  /**
   * Clean up cached results for completed research
   */
  cleanupResearchResults(researchId: string): void {
    this.resultCache.delete(researchId);
  }

  /**
   * Get cached results for a research project
   */
  getCachedResults(researchId: string): ResearchStepResult[] | null {
    return this.resultCache.get(researchId) ?? null;
  }

  /**
   * Runtime helpers to safely work with unknown-shaped data
   */
  private isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private asNumberArray(value: unknown): number[] | undefined {
    if (!Array.isArray(value)) { return undefined; }
    const nums: number[] = [];
    for (const item of value) {
      if (typeof item === 'number' && Number.isFinite(item)) {
        nums.push(item);
      }
    }
    return nums;
  }
}
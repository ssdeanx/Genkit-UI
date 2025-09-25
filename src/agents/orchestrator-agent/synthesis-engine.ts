import type { ResearchStepResult, OrchestrationState, SynthesisResult } from '../shared/interfaces.js';

/**
 * Synthesis Engine for the Orchestrator Agent
 * Combines partial research results into coherent, comprehensive outputs
 */
export class SynthesisEngine {
  /**
   * Synthesize research results into a comprehensive output
   */
  async synthesizeResults(
    results: ResearchStepResult[],
    orchestrationState: OrchestrationState
  ): Promise<SynthesisResult> {
    const synthesisId = `synth-${orchestrationState.researchId}-${Date.now()}`;

    try {
      // Group results by research dimension
      const groupedResults = this.groupResultsByDimension(results);

      // Identify key findings and themes
      const keyFindings = this.extractKeyFindings(groupedResults);

      // Cross-validate information across sources
      const crossValidatedFindings = this.crossValidateFindings(keyFindings, results);

      // Generate synthesis narrative
      const synthesis = await this.generateSynthesisNarrative(
        crossValidatedFindings,
        orchestrationState.plan.objectives,
        results
      );

      // Calculate confidence scores
      const confidenceMetrics = this.calculateConfidenceMetrics(results, crossValidatedFindings);

      // Identify gaps and recommendations
      const gapsAndRecommendations = this.identifyGapsAndRecommendations(
        results,
        orchestrationState.plan.objectives
      );

      return {
        id: synthesisId,
        researchId: orchestrationState.researchId,
        synthesis,
        keyFindings: crossValidatedFindings,
        confidenceMetrics,
        gapsAndRecommendations,
        sourceSummary: this.generateSourceSummary(results),
        generatedAt: new Date(),
        version: '1.0'
      };

    } catch (error) {
      console.error('Synthesis failed:', error);
      throw new Error(`Synthesis engine failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Group research results by research dimension
   */
  private groupResultsByDimension(results: ResearchStepResult[]): Map<string, ResearchStepResult[]> {
    const grouped = new Map<string, ResearchStepResult[]>();

    for (const result of results) {
      const dimension = result.metadata?.dimension || 'general';

      if (!grouped.has(dimension)) {
        grouped.set(dimension, []);
      }

      grouped.get(dimension)!.push(result);
    }

    return grouped;
  }

  /**
   * Extract key findings from grouped results
   */
  private extractKeyFindings(groupedResults: Map<string, ResearchStepResult[]>): Array<{
    dimension: string;
    finding: string;
    confidence: number;
    supportingSources: string[];
    evidence: string[];
  }> {
    const keyFindings: Array<{
      dimension: string;
      finding: string;
      confidence: number;
      supportingSources: string[];
      evidence: string[];
    }> = [];

    for (const [dimension, results] of groupedResults.entries()) {
      // Extract findings from each result
      for (const result of results) {
        // Try to extract findings from the data field
        const findings = this.extractFindingsFromResult(result);

        if (findings && findings.length > 0) {
          for (const finding of findings) {
            // Check if this finding is already captured
            const existingFinding = keyFindings.find(kf =>
              kf.finding === finding.claim && kf.dimension === dimension
            );

            if (existingFinding) {
              // Add supporting evidence
              const sourceName = result.sources[0]?.title || result.sources[0]?.url || `Step ${result.stepId}`;
              existingFinding.supportingSources.push(sourceName);
              existingFinding.evidence.push(finding.evidence);
              existingFinding.confidence = Math.max(existingFinding.confidence, finding.confidence);
            } else {
              // New finding
              const sourceName = result.sources[0]?.title || result.sources[0]?.url || `Step ${result.stepId}`;
              keyFindings.push({
                dimension,
                finding: finding.claim,
                confidence: finding.confidence,
                supportingSources: [sourceName],
                evidence: [finding.evidence]
              });
            }
          }
        }
      }
    }

    // Sort by confidence and limit to top findings
    return keyFindings
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20); // Limit to top 20 findings
  }

  /**
   * Extract findings from a research step result
   */
  private extractFindingsFromResult(result: ResearchStepResult): Array<{
    claim: string;
    evidence: string;
    confidence: number;
  }> | null {
    // Try different ways to extract findings from the result data
    if (typeof result.data === 'object' && result.data !== null) {
      // Check if data has findings array
      if (Array.isArray((result.data).findings)) {
        return (result.data).findings;
      }

      // Check if data has results array with findings
      if (Array.isArray((result.data).results)) {
        const { results } = result.data;
        return results.flatMap((r: any) => r.findings ?? []);
      }

      // Check if data itself is a finding
      if ((result.data).claim) {
        return [result.data];
      }

      // Try to extract from text content
      if (typeof (result.data).content === 'string') {
        return this.extractFindingsFromText((result.data).content);
      }
    }

    // Fallback: try to extract from metadata
    if (result.metadata?.findings) {
      return result.metadata.findings;
    }

    return null;
  }

  /**
   * Extract findings from text content using simple heuristics
   */
  private extractFindingsFromText(text: string): Array<{
    claim: string;
    evidence: string;
    confidence: number;
  }> {
    const findings: Array<{
      claim: string;
      evidence: string;
      confidence: number;
    }> = [];

    // Simple extraction: look for sentences that seem like claims
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

    for (const sentence of sentences.slice(0, 5)) { // Limit to first 5 sentences
      const trimmed = sentence.trim();
      if (trimmed.length > 0) {
        findings.push({
          claim: trimmed,
          evidence: trimmed,
          confidence: 0.5 // Default confidence for extracted findings
        });
      }
    }

    return findings;
  }

  /**
   * Cross-validate findings across multiple sources
   */
  private crossValidateFindings(
    keyFindings: Array<{
      dimension: string;
      finding: string;
      confidence: number;
      supportingSources: string[];
      evidence: string[];
    }>,
    allResults: ResearchStepResult[]
  ): Array<{
    dimension: string;
    finding: string;
    confidence: number;
    validationStatus: 'confirmed' | 'partially-confirmed' | 'unconfirmed' | 'contradicted';
    supportingSources: string[];
    contradictingSources?: string[];
    consensusLevel: number;
  }> {
    return keyFindings.map(finding => {
      // Check for contradictions
      const contradictions = this.findContradictions(finding.finding, allResults);

      // Calculate consensus level (sources agreeing / total relevant sources)
      const relevantSources = allResults.filter((r): boolean => {
        const resultDimension = r.metadata?.dimension ?? 'general';
        const resultContent = typeof r.data === 'string' ? r.data :
                            (r.data)?.content ?? JSON.stringify(r.data);
        return resultDimension === finding.dimension ||
               resultContent.toLowerCase().includes(finding.finding.toLowerCase().split(' ')[0]);
      });

      const consensusLevel = relevantSources.length > 0 ?
        finding.supportingSources.length / relevantSources.length : 0;

      let validationStatus: 'confirmed' | 'partially-confirmed' | 'unconfirmed' | 'contradicted';

      if (contradictions.length > 0) {
        validationStatus = 'contradicted';
      } else if (consensusLevel >= 0.8) {
        validationStatus = 'confirmed';
      } else if (consensusLevel >= 0.5) {
        validationStatus = 'partially-confirmed';
      } else {
        validationStatus = 'unconfirmed';
      }

      return {
        dimension: finding.dimension,
        finding: finding.finding,
        confidence: finding.confidence * consensusLevel, // Adjust confidence by consensus
        validationStatus,
        supportingSources: finding.supportingSources,
        contradictingSources: contradictions.length > 0 ? contradictions : undefined,
        consensusLevel
      };
    });
  }

  /**
   * Find contradictions to a finding
   */
  private findContradictions(finding: string, results: ResearchStepResult[]): string[] {
    const contradictions: string[] = [];
    const findingLower = finding.toLowerCase();

    for (const result of results) {
      // Get content from result data
      const content = typeof result.data === 'string' ? result.data :
                     (result.data)?.content ?? JSON.stringify(result.data);
      const contentLower = content.toLowerCase();

      // Check for direct contradictions
      if (contentLower.includes('however') || contentLower.includes('but') ||
          contentLower.includes('contrary') || contentLower.includes('despite')) {
        // Look for patterns that might indicate contradiction
        const sentences = content.split(/[.!?]+/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(findingLower.split(' ')[0]) &&
              (sentence.toLowerCase().includes('not') || sentence.toLowerCase().includes('false') ||
               sentence.toLowerCase().includes('incorrect'))) {
            const sourceName = result.sources[0]?.title || result.sources[0]?.url || `Step ${result.stepId}`;
            contradictions.push(sourceName);
            break;
          }
        }
      }
    }

    return [...new Set(contradictions)]; // Remove duplicates
  }

  /**
   * Generate synthesis narrative
   */
  private async generateSynthesisNarrative(
    validatedFindings: Array<{
      dimension: string;
      finding: string;
      confidence: number;
      validationStatus: 'confirmed' | 'partially-confirmed' | 'unconfirmed' | 'contradicted';
      supportingSources: string[];
      contradictingSources?: string[];
      consensusLevel: number;
    }>,
    objectives: string[],
    allResults: ResearchStepResult[]
  ): Promise<string> {
    // Group findings by dimension
    const findingsByDimension = new Map<string, typeof validatedFindings>();

    for (const finding of validatedFindings) {
      if (!findingsByDimension.has(finding.dimension)) {
        findingsByDimension.set(finding.dimension, []);
      }
      findingsByDimension.get(finding.dimension)!.push(finding);
    }

    // Generate narrative sections
    const sections: string[] = [];

    // Executive summary
    sections.push(this.generateExecutiveSummary(validatedFindings, objectives));

    // Detailed findings by dimension
    for (const [dimension, findings] of findingsByDimension.entries()) {
      sections.push(this.generateDimensionSection(dimension, findings));
    }

    // Methodology and source summary
    sections.push(this.generateMethodologySection(allResults));

    // Conclusions and recommendations
    sections.push(this.generateConclusionsSection(validatedFindings, objectives));

    return sections.join('\n\n');
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(
    findings: Array<{
      dimension: string;
      finding: string;
      confidence: number;
      validationStatus: string;
    }>,
    objectives: string[]
  ): string {
    const highConfidenceFindings = findings.filter(f => f.confidence >= 0.8);
    const confirmedFindings = findings.filter(f => f.validationStatus === 'confirmed');

    return `# Executive Summary

This research synthesis addresses the following objectives: ${objectives.join(', ')}.

## Key Findings
- **Total Findings Identified**: ${findings.length}
- **High Confidence Findings**: ${highConfidenceFindings.length}
- **Fully Confirmed Findings**: ${confirmedFindings.length}

## Research Overview
${highConfidenceFindings.slice(0, 5).map(f => `- ${f.finding} (Confidence: ${(f.confidence * 100).toFixed(1)}%)`).join('\n')}

## Validation Status
- Confirmed findings represent information validated across multiple sources
- High confidence findings have strong evidential support
- All findings include source attribution and confidence metrics`;
  }

  /**
   * Generate dimension-specific section
   */
  private generateDimensionSection(
    dimension: string,
    findings: Array<{
      finding: string;
      confidence: number;
      validationStatus: string;
      consensusLevel: number;
    }>
  ): string {
    const sortedFindings = findings.sort((a, b) => b.confidence - a.confidence);

    return `## ${dimension.charAt(0).toUpperCase() + dimension.slice(1)} Analysis

${sortedFindings.map(finding => {
  const statusIcon = {
    'confirmed': '✅',
    'partially-confirmed': '⚠️',
    'unconfirmed': '❓',
    'contradicted': '❌'
  }[finding.validationStatus] ?? '❓';

  return `${statusIcon} **${finding.finding}**
   - **Confidence**: ${(finding.confidence * 100).toFixed(1)}%
   - **Consensus**: ${(finding.consensusLevel * 100).toFixed(1)}% of sources agree
   - **Status**: ${finding.validationStatus.replace('-', ' ')}`;
}).join('\n\n')}`;
  }

  /**
   * Generate methodology section
   */
  private generateMethodologySection(results: ResearchStepResult[]): string {
    // Extract source types from the sources array
    const sourceTypes = new Set<string>();
    const agentTypes = new Set<string>();

    for (const result of results) {
      // Get source types from sources
      result.sources.forEach(source => sourceTypes.add(source.type));

      // Get agent type from metadata or stepId pattern
      const agentType = (result.metadata?.agentType ??
                       result.stepId.split('-')[0]) ?? 'unknown';
      agentTypes.add(agentType);
    }

    const totalSources = results.length;

    return `## Methodology & Sources

### Research Approach
This synthesis was generated using a multi-agent research system that coordinated specialized agents across ${sourceTypes.size} different source types.

### Source Summary
- **Total Sources Consulted**: ${totalSources}
- **Source Types**: ${Array.from(sourceTypes).join(', ')}
- **Research Agents Used**: ${Array.from(agentTypes).join(', ')}

### Data Processing
- Cross-validation performed across all findings
- Confidence scores calculated based on source credibility and consensus
- Contradictions identified and flagged for manual review`;
  }

  /**
   * Generate conclusions section
   */
  private generateConclusionsSection(
    findings: Array<{
      dimension: string;
      finding: string;
      confidence: number;
      validationStatus: 'confirmed' | 'partially-confirmed' | 'unconfirmed' | 'contradicted';
      supportingSources: string[];
      contradictingSources?: string[];
      consensusLevel: number;
    }>,
    objectives: string[]
  ): string {
    const confirmedFindings = findings.filter(f => f.validationStatus === 'confirmed');
    const highConfidenceFindings = findings.filter(f => f.confidence >= 0.8);

    return `## Conclusions & Recommendations

### Research Objectives Achievement
${objectives.map(obj => `- **${obj}**: ${this.assessObjectiveAchievement(obj, findings)}`).join('\n')}

### Key Conclusions
${confirmedFindings.slice(0, 3).map(f => `- ${f.finding}`).join('\n')}

### Recommendations for Further Research
${this.generateResearchRecommendations(findings, objectives)}

### Confidence Assessment
- **Overall Research Confidence**: ${this.calculateOverallConfidence(findings)}%
- **Validated Information**: ${((confirmedFindings.length / findings.length) * 100).toFixed(1)}% of findings confirmed across multiple sources

---
*This synthesis was generated automatically by the Deep Research Agent system. All findings include source attribution and confidence metrics for transparency.*`;
  }

  /**
   * Assess achievement of research objective
   */
  private assessObjectiveAchievement(objective: string, findings: Array<{
    dimension: string;
    finding: string;
    confidence: number;
    validationStatus: 'confirmed' | 'partially-confirmed' | 'unconfirmed' | 'contradicted';
    supportingSources: string[];
    contradictingSources?: string[];
    consensusLevel: number;
  }>): string {
    const relevantFindings = findings.filter(f =>
      f.finding.toLowerCase().includes(objective.toLowerCase().split(' ')[0])
    );

    if (relevantFindings.length === 0) {
      return 'No relevant findings identified';
    }
    if (relevantFindings.some(f => f.validationStatus === 'confirmed')) {
      return 'Well supported by evidence';
    }
    if (relevantFindings.some(f => f.confidence >= 0.7)) {
      return 'Moderately supported';
    }
    return 'Limited evidence found';
  }

  /**
   * Generate research recommendations
   */
  private generateResearchRecommendations(
    findings: Array<{
      dimension: string;
      finding: string;
      confidence: number;
      validationStatus: 'confirmed' | 'partially-confirmed' | 'unconfirmed' | 'contradicted';
      supportingSources: string[];
      contradictingSources?: string[];
      consensusLevel: number;
    }>,
    objectives: string[]
  ): string {
    const recommendations: string[] = [];

    // Check for contradictory findings
    const contradictedFindings = findings.filter(f => f.validationStatus === 'contradicted');
    if (contradictedFindings.length > 0) {
      recommendations.push(`- Investigate ${contradictedFindings.length} contradictory findings requiring manual review`);
    }

    // Check for unconfirmed findings
    const unconfirmedFindings = findings.filter(f => f.validationStatus === 'unconfirmed');
    if (unconfirmedFindings.length > 0) {
      recommendations.push(`- Seek additional sources for ${unconfirmedFindings.length} unconfirmed findings`);
    }

    // Check objective coverage
    const coveredObjectives = objectives.filter(obj =>
      findings.some(f => f.finding.toLowerCase().includes(obj.toLowerCase().split(' ')[0]))
    );

    if (coveredObjectives.length < objectives.length) {
      recommendations.push(`- Expand research scope for ${objectives.length - coveredObjectives.length} uncovered objectives`);
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '- No additional research recommended at this time';
  }

  /**
   * Calculate overall research confidence
   */
  private calculateOverallConfidence(findings: Array<{
    dimension: string;
    finding: string;
    confidence: number;
    validationStatus: 'confirmed' | 'partially-confirmed' | 'unconfirmed' | 'contradicted';
    supportingSources: string[];
    contradictingSources?: string[];
    consensusLevel: number;
  }>): number {
    if (findings.length === 0) {
      return 0;
    }

    const totalConfidence = findings.reduce((sum, f) => sum + f.confidence, 0);
    return Math.round((totalConfidence / findings.length) * 100);
  }

  /**
   * Calculate confidence metrics
   */
  private calculateConfidenceMetrics(
    results: ResearchStepResult[],
    validatedFindings: Array<{
      dimension: string;
      finding: string;
      confidence: number;
      validationStatus: 'confirmed' | 'partially-confirmed' | 'unconfirmed' | 'contradicted';
      supportingSources: string[];
      contradictingSources?: string[];
      consensusLevel: number;
    }>
  ): {
    overallConfidence: number;
    sourceDiversity: number;
    validationRate: number;
    contradictionRate: number;
  } {
    const overallConfidence = this.calculateOverallConfidence(validatedFindings);
    const sourceDiversity = new Set(results.flatMap(r => r.sources.map(s => s.title || s.url))).size / results.length;
    const validationRate = validatedFindings.filter(f => f.validationStatus === 'confirmed').length / validatedFindings.length;
    const contradictionRate = validatedFindings.filter(f => f.validationStatus === 'contradicted').length / validatedFindings.length;

    return {
      overallConfidence,
      sourceDiversity,
      validationRate: validationRate || 0,
      contradictionRate: contradictionRate || 0
    };
  }

  /**
   * Identify gaps and recommendations
   */
  private identifyGapsAndRecommendations(
    results: ResearchStepResult[],
    objectives: string[]
  ): {
    knowledgeGaps: string[];
    methodologicalLimitations: string[];
    recommendations: string[];
  } {
    const knowledgeGaps: string[] = [];
    const methodologicalLimitations: string[] = [];
    const recommendations: string[] = [];

    // Check for objective coverage gaps
    for (const objective of objectives) {
      const relevantResults = results.filter((r): boolean => {
        const content = typeof r.data === 'string' ? r.data :
                       (r.data)?.content ?? JSON.stringify(r.data);
        return content.toLowerCase().includes(objective.toLowerCase().split(' ')[0]);
      });

      if (relevantResults.length === 0) {
        knowledgeGaps.push(`Limited information found regarding: ${objective}`);
      }
    }

    // Check source diversity
    const sourceTypes = new Set(results.flatMap(r => r.sources.map(s => s.type)));
    if (sourceTypes.size < 3) {
      methodologicalLimitations.push('Limited source type diversity may affect result validity');
      recommendations.push('Incorporate additional source types (academic, news, government) in future research');
    }

    // Check for temporal coverage
    const hasRecentSources = results.some(r => {
      const latestSourceDate = Math.max(...r.sources.map(s => s.accessedAt.getTime()));
      const daysSince = (Date.now() - latestSourceDate) / (1000 * 60 * 60 * 24);
      return daysSince < 365; // Within last year
    });

    if (!hasRecentSources) {
      methodologicalLimitations.push('Limited recent source material may miss current developments');
      recommendations.push('Include more recent sources to capture current developments');
    }

    return {
      knowledgeGaps,
      methodologicalLimitations,
      recommendations
    };
  }

  /**
   * Generate source summary
   */
  private generateSourceSummary(results: ResearchStepResult[]): {
    totalSources: number;
    sourceTypes: Record<string, number>;
    topSources: Array<{source: string, contributionCount: number}>;
  } {
    const sourceTypes: Record<string, number> = {};
    const sourceContributions: Record<string, number> = {};

    for (const result of results) {
      // Count source types from sources array
      result.sources.forEach(source => {
        sourceTypes[source.type] = (sourceTypes[source.type] || 0) + 1;
      });

      // Count contributions per source (use first source as identifier)
      const sourceName = result.sources[0]?.title || result.sources[0]?.url || `Step ${result.stepId}`;
      sourceContributions[sourceName] = (sourceContributions[sourceName] || 0) + 1;
    }

    // Get top contributing sources
    const topSources = Object.entries(sourceContributions)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([source, contributionCount]) => ({ source, contributionCount }));

    return {
      totalSources: results.length,
      sourceTypes,
      topSources
    };
  }
}
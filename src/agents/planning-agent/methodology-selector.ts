import type { ResearchMethodology, ResearchDimension } from '../shared/interfaces.js';

/**
 * Methodology Selection Engine for the Planning Agent
 * Selects appropriate research methodologies based on query analysis
 */
export class MethodologySelector {
  /**
   * Select the most appropriate research methodology for a given query analysis
   */
  selectMethodology(
    queryAnalysis: {
      scopeDimensions: string[];
      knowledgeGaps: string[];
      stakeholderNeeds: string[];
      researchDimensions: ResearchDimension[];
      complexity: 'simple' | 'moderate' | 'complex' | 'expert';
      estimatedScope: 'narrow' | 'medium' | 'broad' | 'comprehensive';
    },
    topic: string
  ): ResearchMethodology {
    const methodology = this.determineApproach(queryAnalysis, topic);
    const phases = this.definePhases(methodology.approach);
    const qualityControls = this.defineQualityControls(methodology.approach, queryAnalysis);

    return {
      approach: methodology.approach,
      justification: methodology.justification,
      phases,
      qualityControls,
    };
  }

  /**
   * Determine the most appropriate research approach
   */
  private determineApproach(
    analysis: {
      scopeDimensions: string[];
      knowledgeGaps: string[];
      stakeholderNeeds: string[];
      researchDimensions: ResearchDimension[];
      complexity: 'simple' | 'moderate' | 'complex' | 'expert';
      estimatedScope: 'narrow' | 'medium' | 'broad' | 'comprehensive';
    },
    topic: string
  ): { approach: ResearchMethodology['approach']; justification: string } {
    const { scopeDimensions, knowledgeGaps, stakeholderNeeds, researchDimensions, complexity, estimatedScope } = analysis;

    // Systematic approach for complex, comprehensive research
    if (complexity === 'expert' || estimatedScope === 'comprehensive') {
      return {
        approach: 'systematic',
        justification: 'Complex topic requiring comprehensive, methodical investigation with multiple validation steps'
      };
    }

    // Comparative approach for comparison-focused queries
    if (scopeDimensions.includes('comparative') || topic.toLowerCase().includes('compare')) {
      return {
        approach: 'comparative',
        justification: 'Query involves comparing multiple options, entities, or time periods requiring side-by-side analysis'
      };
    }

    // Case study approach for in-depth, specific examples
    if (complexity === 'complex' && estimatedScope === 'narrow') {
      return {
        approach: 'case-study',
        justification: 'Focused, in-depth investigation of specific cases or examples within a narrow scope'
      };
    }

    // Exploratory approach for broad, discovery-oriented research
    if (estimatedScope === 'broad' || knowledgeGaps.includes('fundamental understanding')) {
      return {
        approach: 'exploratory',
        justification: 'Broad topic requiring initial exploration and discovery of key concepts and relationships'
      };
    }

    // Default to systematic for moderate complexity
    return {
      approach: 'systematic',
      justification: 'Balanced approach ensuring comprehensive coverage with structured validation'
    };
  }

  /**
   * Define research phases based on the selected approach
   */
  private definePhases(approach: ResearchMethodology['approach']): string[] {
    switch (approach) {
      case 'systematic':
        return [
          'Research question formulation',
          'Systematic literature review',
          'Data collection and synthesis',
          'Critical analysis and validation',
          'Findings integration and reporting'
        ];

      case 'exploratory':
        return [
          'Initial scoping and orientation',
          'Broad information gathering',
          'Pattern identification',
          'Hypothesis generation',
          'Focused investigation and validation'
        ];

      case 'comparative':
        return [
          'Comparison framework development',
          'Parallel data collection',
          'Side-by-side analysis',
          'Difference identification',
          'Comparative synthesis and conclusions'
        ];

      case 'case-study':
        return [
          'Case selection and scoping',
          'In-depth case investigation',
          'Cross-case pattern analysis',
          'Case-specific insights development',
          'Generalizable findings extraction'
        ];

      default:
        return [
          'Planning and preparation',
          'Data collection',
          'Analysis and synthesis',
          'Validation and verification',
          'Reporting and dissemination'
        ];
    }
  }

  /**
   * Define quality controls based on approach and analysis
   */
  private defineQualityControls(
    approach: ResearchMethodology['approach'],
    analysis: {
      scopeDimensions: string[];
      knowledgeGaps: string[];
      stakeholderNeeds: string[];
      researchDimensions: ResearchDimension[];
      complexity: 'simple' | 'moderate' | 'complex' | 'expert';
    }
  ): string[] {
    const controls: string[] = [];

    // Base quality controls for all approaches
    controls.push('Source credibility verification');
    controls.push('Cross-reference validation');

    // Approach-specific controls
    switch (approach) {
      case 'systematic':
        controls.push('Comprehensive literature coverage');
        controls.push('Methodological rigor assessment');
        controls.push('Peer review simulation');
        break;

      case 'exploratory':
        controls.push('Multiple perspective inclusion');
        controls.push('Bias identification and mitigation');
        controls.push('Preliminary finding validation');
        break;

      case 'comparative':
        controls.push('Equivalence assurance');
        controls.push('Contextual factor control');
        controls.push('Statistical comparison validity');
        break;

      case 'case-study':
        controls.push('Case representativeness evaluation');
        controls.push('Triangulation of evidence');
        controls.push('Contextual depth assessment');
        break;
    }

    // Complexity-based controls
    if (analysis.complexity === 'expert') {
      controls.push('Expert peer validation');
      controls.push('Methodological transparency');
    }

    // Scope-based controls
    if (analysis.scopeDimensions.includes('global') || analysis.scopeDimensions.includes('comparative')) {
      controls.push('Cultural and contextual adaptation');
    }

    // Research dimension-based controls
    const hasAcademic = analysis.researchDimensions.some(d => d.type === 'academic');
    const hasStatistical = analysis.researchDimensions.some(d => d.type === 'statistical');

    if (hasAcademic) {
      controls.push('Academic rigor standards');
    }

    if (hasStatistical) {
      controls.push('Statistical validity checks');
      controls.push('Data integrity verification');
    }

    return controls;
  }

  /**
   * Get methodology recommendations for different research scenarios
   */
  getMethodologyRecommendations(): Record<string, {
    approach: ResearchMethodology['approach'];
    whenToUse: string;
    strengths: string[];
    limitations: string[];
  }> {
    return {
      systematic: {
        approach: 'systematic',
        whenToUse: 'Complex topics requiring comprehensive evidence-based analysis',
        strengths: [
          'Comprehensive coverage',
          'High reliability',
          'Replicable methodology',
          'Strong evidence base'
        ],
        limitations: [
          'Time-intensive',
          'May miss unexpected insights',
          'Requires extensive resources'
        ]
      },

      exploratory: {
        approach: 'exploratory',
        whenToUse: 'New or broad topics where understanding is limited',
        strengths: [
          'Discovers unexpected insights',
          'Flexible and adaptive',
          'Generates new hypotheses',
          'Broad perspective'
        ],
        limitations: [
          'Less structured',
          'May lack depth',
          'Harder to replicate',
          'Potential for bias'
        ]
      },

      comparative: {
        approach: 'comparative',
        whenToUse: 'Topics involving comparison of multiple entities or time periods',
        strengths: [
          'Highlights differences and similarities',
          'Supports decision-making',
          'Identifies best practices',
          'Contextual understanding'
        ],
        limitations: [
          'Requires equivalent data',
          'Context complexity',
          'May overlook unique factors'
        ]
      },

      'case-study': {
        approach: 'case-study',
        whenToUse: 'In-depth investigation of specific examples or instances',
        strengths: [
          'Deep understanding',
          'Rich contextual detail',
          'Practical insights',
          'Real-world applicability'
        ],
        limitations: [
          'Limited generalizability',
          'Potential selection bias',
          'Time and resource intensive'
        ]
      }
    };
  }

  /**
   * Validate methodology selection against query requirements
   */
  validateMethodology(
    methodology: ResearchMethodology,
    analysis: {
      scopeDimensions: string[];
      knowledgeGaps: string[];
      stakeholderNeeds: string[];
      researchDimensions: ResearchDimension[];
    }
  ): { isValid: boolean; issues: string[]; recommendations: string[] } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if methodology aligns with scope dimensions
    if (analysis.scopeDimensions.includes('comparative') && methodology.approach !== 'comparative') {
      issues.push('Comparative scope requires comparative methodology');
      recommendations.push('Consider switching to comparative approach');
    }

    // Check if methodology supports required research dimensions
    const academicRequired = analysis.researchDimensions.some(d => d.type === 'academic' && d.priority === 'high');
    if (academicRequired && methodology.approach === 'exploratory') {
      issues.push('High academic requirements may not be met by exploratory approach');
      recommendations.push('Consider systematic approach for academic rigor');
    }

    // Check complexity alignment
    const complexityLevel = analysis.stakeholderNeeds.includes('analysis') ? 'high' : 'standard';
    if (complexityLevel === 'high' && methodology.approach === 'exploratory') {
      issues.push('Complex analysis needs may require more structured approach');
      recommendations.push('Consider systematic or case-study approaches');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }
}
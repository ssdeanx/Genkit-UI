import type { ResearchStep, ResearchDimension, DataSource } from '../shared/interfaces.js';

/**
 * Step Decomposition Engine for the Planning Agent
 * Breaks complex research into atomic, parallelizable tasks
 */
export class StepDecomposer {
  /**
   * Decompose a research plan into executable steps
   */
  decomposeIntoSteps(
    topic: string,
    methodology: string,
    dataSources: DataSource[],
    researchDimensions: ResearchDimension[],
    estimatedScope: string
  ): ResearchStep[] {
    const steps: ResearchStep[] = [];

    // Add planning and preparation steps
    steps.push(...this.createPreparationSteps(topic));

    // Add research execution steps based on methodology
    steps.push(...this.createResearchSteps(topic, methodology, dataSources, researchDimensions));

    // Add analysis and synthesis steps
    steps.push(...this.createAnalysisSteps(topic, methodology, researchDimensions));

    // Add validation and quality assurance steps
    steps.push(...this.createValidationSteps(topic, methodology));

    // Assign dependencies and priorities
    this.assignDependencies(steps);
    this.assignPriorities(steps, estimatedScope);

    return steps;
  }

  /**
   * Create preparation steps for research execution
   */
  private createPreparationSteps(topic: string): ResearchStep[] {
    return [
      {
        id: 'prep-001',
        description: `Initialize research environment and validate access to required data sources for topic: ${topic}`,
        agentType: 'orchestrator',
        dependencies: [],
        estimatedDuration: 5,
        successCriteria: 'All data sources accessible and research environment ready',
        fallbackStrategies: ['Use alternative data sources', 'Reduce research scope'],
        priority: 1
      },
      {
        id: 'prep-002',
        description: `Set up progress tracking and quality monitoring systems for ${topic} research`,
        agentType: 'orchestrator',
        dependencies: ['prep-001'],
        estimatedDuration: 3,
        successCriteria: 'Monitoring systems operational and baseline metrics established',
        fallbackStrategies: ['Implement basic progress tracking', 'Manual quality checks'],
        priority: 1
      }
    ];
  }

  /**
   * Create research execution steps based on methodology and data sources
   */
  private createResearchSteps(
    topic: string,
    methodology: string,
    dataSources: DataSource[],
    researchDimensions: ResearchDimension[]
  ): ResearchStep[] {
    const steps: ResearchStep[] = [];
    let stepCounter = 1;

    // Group data sources by type for parallel execution
    const sourcesByType = this.groupSourcesByType(dataSources);

    for (const [sourceType, sources] of sourcesByType.entries()) {
      const agentType = this.mapSourceTypeToAgent(sourceType);
      const dimension = researchDimensions.find(d => d.type === sourceType);

      if (dimension && dimension.relevance > 0.3) { // Only include relevant dimensions
        const step: ResearchStep = {
          id: `research-${String(stepCounter).padStart(3, '0')}`,
          description: `Conduct ${methodology} research on ${topic} using ${sourceType} sources (${sources.length} sources)`,
          agentType,
          dependencies: ['prep-002'],
          estimatedDuration: this.calculateStepDuration(sourceType, methodology, sources.length),
          successCriteria: `Gather comprehensive ${sourceType} data on ${topic} with minimum ${Math.round(dimension.relevance * 100)}% relevance`,
          fallbackStrategies: [
            'Use alternative sources within same type',
            'Reduce data volume requirements',
            'Combine with other source types'
          ],
          priority: this.calculateStepPriority(dimension, methodology)
        };

        steps.push(step);
        stepCounter++;
      }
    }

    // Add cross-validation steps for comparative methodology
    if (methodology === 'comparative' && steps.length > 1) {
      steps.push({
        id: `research-${String(stepCounter).padStart(3, '0')}`,
        description: `Cross-validate findings across different source types for ${topic}`,
        agentType: 'orchestrator',
        dependencies: steps.map(s => s.id),
        estimatedDuration: 15,
        successCriteria: 'Consistent findings identified across multiple sources',
        fallbackStrategies: ['Focus on highest credibility sources', 'Document inconsistencies'],
        priority: 3
      });
    }

    return steps;
  }

  /**
   * Create analysis and synthesis steps
   */
  private createAnalysisSteps(
    topic: string,
    methodology: string,
    researchDimensions: ResearchDimension[]
  ): ResearchStep[] {
    const steps: ResearchStep[] = [];
    const hasStatistical = researchDimensions.some(d => d.type === 'statistical');
    const hasAcademic = researchDimensions.some(d => d.type === 'academic');

    // Data analysis step (if statistical data is involved)
    if (hasStatistical) {
      steps.push({
        id: 'analysis-001',
        description: `Analyze quantitative data and statistical patterns for ${topic}`,
        agentType: 'data-analysis',
        dependencies: ['research-001', 'research-002'], // Depends on research steps
        estimatedDuration: 20,
        successCriteria: 'Statistical analysis completed with key insights identified',
        fallbackStrategies: ['Use basic statistical methods', 'Focus on descriptive statistics'],
        priority: 2
      });
    }

    // Content analysis step
    steps.push({
      id: 'analysis-002',
      description: `Synthesize qualitative findings and identify key themes for ${topic}`,
      agentType: 'orchestrator',
      dependencies: hasStatistical ? ['analysis-001'] : ['research-001'],
      estimatedDuration: 15,
      successCriteria: 'Key findings synthesized and themes identified',
      fallbackStrategies: ['Use simplified synthesis approach', 'Focus on most relevant findings'],
      priority: 2
    });

    // Expert validation step (for academic-heavy research)
    if (hasAcademic && methodology === 'systematic') {
      steps.push({
        id: 'analysis-003',
        description: `Validate findings against academic standards and peer-reviewed literature for ${topic}`,
        agentType: 'academic-research',
        dependencies: ['analysis-002'],
        estimatedDuration: 10,
        successCriteria: 'Findings validated against academic standards',
        fallbackStrategies: ['Use peer review simulation', 'Cross-reference with multiple sources'],
        priority: 3
      });
    }

    return steps;
  }

  /**
   * Create validation and quality assurance steps
   */
  private createValidationSteps(topic: string, methodology: string): ResearchStep[] {
    return [
      {
        id: 'validation-001',
        description: `Validate research quality and source credibility for ${topic}`,
        agentType: 'orchestrator',
        dependencies: ['analysis-002'],
        estimatedDuration: 8,
        successCriteria: 'Quality metrics meet established thresholds',
        fallbackStrategies: ['Adjust quality thresholds', 'Supplement with additional sources'],
        priority: 2
      },
      {
        id: 'validation-002',
        description: `Generate final research report and artifact for ${topic}`,
        agentType: 'orchestrator',
        dependencies: ['validation-001'],
        estimatedDuration: 10,
        successCriteria: 'Comprehensive research report generated with all findings',
        fallbackStrategies: ['Generate summary report', 'Focus on key findings only'],
        priority: 1
      }
    ];
  }

  /**
   * Group data sources by type for parallel processing
   */
  private groupSourcesByType(sources: DataSource[]): Map<string, DataSource[]> {
    const grouped = new Map<string, DataSource[]>();

    for (const source of sources) {
      if (!grouped.has(source.type)) {
        grouped.set(source.type, []);
      }
      grouped.get(source.type)!.push(source);
    }

    return grouped;
  }

  /**
   * Map source type to appropriate agent type
   */
  private mapSourceTypeToAgent(sourceType: string): ResearchStep['agentType'] {
    switch (sourceType) {
      case 'academic':
        return 'academic-research';
      case 'web':
        return 'web-research';
      case 'news':
        return 'news-research';
      case 'statistical':
        return 'data-analysis';
      default:
        return 'web-research';
    }
  }

  /**
   * Calculate estimated duration for a research step
   */
  private calculateStepDuration(sourceType: string, methodology: string, sourceCount: number): number {
    let baseDuration = 10; // Base duration in minutes

    // Adjust for source type
    switch (sourceType) {
      case 'academic':
        baseDuration *= 1.5; // Academic research takes longer
        break;
      case 'statistical':
        baseDuration *= 1.3; // Statistical analysis takes longer
        break;
      case 'news':
        baseDuration *= 0.8; // News research is often faster
        break;
    }

    // Adjust for methodology
    switch (methodology) {
      case 'systematic':
        baseDuration *= 1.4; // Systematic requires more thoroughness
        break;
      case 'exploratory':
        baseDuration *= 0.9; // Exploratory can be faster
        break;
      case 'case-study':
        baseDuration *= 1.2; // Case studies require depth
        break;
    }

    // Adjust for source count
    baseDuration *= Math.sqrt(sourceCount); // Diminishing returns for multiple sources

    return Math.round(baseDuration);
  }

  /**
   * Calculate priority for a research step
   */
  private calculateStepPriority(dimension: ResearchDimension, methodology: string): number {
    let priority = 3; // Default medium priority

    // Higher priority for high-relevance dimensions
    if (dimension.relevance > 0.8) {
      priority = 1;
    } else if (dimension.relevance > 0.6) {
      priority = 2;
    }

    // Adjust for methodology requirements
    if (methodology === 'systematic' && dimension.type === 'academic') {
      priority = Math.max(1, priority - 1); // Boost academic priority for systematic research
    }

    return priority;
  }

  /**
   * Assign dependencies between steps
   */
  private assignDependencies(steps: ResearchStep[]): void {
    // Dependencies are already assigned in the step creation methods
    // This method could be used for more complex dependency logic in the future
  }

  /**
   * Assign priorities based on scope and critical path
   */
  private assignPriorities(steps: ResearchStep[], estimatedScope: string): void {
    // Adjust priorities based on scope
    if (estimatedScope === 'narrow') {
      // For narrow scope, boost preparation and validation steps
      steps.forEach(step => {
        if (step.id.startsWith('prep') || step.id.startsWith('validation')) {
          step.priority = Math.max(1, step.priority - 1);
        }
      });
    } else if (estimatedScope === 'comprehensive') {
      // For comprehensive scope, ensure research steps have high priority
      steps.forEach(step => {
        if (step.id.startsWith('research')) {
          step.priority = Math.max(1, step.priority - 1);
        }
      });
    }
  }

  /**
   * Optimize step execution for parallel processing
   */
  optimizeForParallelExecution(steps: ResearchStep[]): {
    parallelGroups: ResearchStep[][];
    criticalPath: ResearchStep[];
    estimatedTotalTime: number;
  } {
    // Group steps that can run in parallel (same dependencies)
    const parallelGroups: ResearchStep[][] = [];
    const processed = new Set<string>();

    // Find steps with no dependencies (can start immediately)
    const initialSteps = steps.filter(step => step.dependencies.length === 0);
    if (initialSteps.length > 0) {
      parallelGroups.push(initialSteps);
      initialSteps.forEach(step => processed.add(step.id));
    }

    // Continue with dependent steps
    let remainingSteps = steps.filter(step => !processed.has(step.id));
    let groupCount = 1;

    while (remainingSteps.length > 0 && groupCount < 10) { // Prevent infinite loops
      const nextGroup: ResearchStep[] = [];

      for (const step of remainingSteps) {
        // Check if all dependencies are satisfied
        const dependenciesMet = step.dependencies.every(depId =>
          processed.has(depId) || parallelGroups.flat().some(s => s.id === depId)
        );

        if (dependenciesMet) {
          nextGroup.push(step);
        }
      }

      if (nextGroup.length === 0) {
        // No more steps can be processed (circular dependency or error)
        break;
      }

      parallelGroups.push(nextGroup);
      nextGroup.forEach(step => processed.add(step.id));
      remainingSteps = remainingSteps.filter(step => !processed.has(step.id));
      groupCount++;
    }

    // Calculate critical path (longest chain of dependent steps)
    const criticalPath = this.calculateCriticalPath(steps);

    // Estimate total execution time
    const estimatedTotalTime = parallelGroups.reduce((total, group) => {
      const groupTime = Math.max(...group.map(step => step.estimatedDuration));
      return total + groupTime;
    }, 0);

    return {
      parallelGroups,
      criticalPath,
      estimatedTotalTime
    };
  }

  /**
   * Calculate the critical path through the steps
   */
  private calculateCriticalPath(steps: ResearchStep[]): ResearchStep[] {
    // Simplified critical path calculation
    // In a real implementation, this would use proper project management algorithms
    const stepMap = new Map(steps.map(step => [step.id, step]));
    const criticalPath: ResearchStep[] = [];

    // Start with the final step
    const finalStep = steps.find(step => step.id.startsWith('validation-002'));
    if (finalStep) {
      criticalPath.unshift(finalStep);

      // Walk backwards through dependencies
      let currentDeps = finalStep.dependencies;
      while (currentDeps.length > 0) {
        const nextStepId = currentDeps[0]; // Take first dependency
        const nextStep = stepMap.get(nextStepId);
        if (nextStep) {
          criticalPath.unshift(nextStep);
          currentDeps = nextStep.dependencies;
        } else {
          break;
        }
      }
    }

    return criticalPath;
  }
}
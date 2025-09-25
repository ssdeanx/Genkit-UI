import { ResearchStep, ResearchStepExecution, TaskRequest, AgentType, OrchestrationState } from '../shared/interfaces.js';
import { A2ACommunicationManager } from './a2a-communication.js';

/**
 * Task Delegation System for the Orchestrator Agent
 * Analyzes research steps and delegates them to appropriate specialized agents
 */
export class TaskDelegator {
  private a2aManager: A2ACommunicationManager;
  private activeTasks: Map<string, ResearchStepExecution> = new Map();

  constructor(a2aManager: A2ACommunicationManager) {
    this.a2aManager = a2aManager;
  }

  /**
   * Delegate all executable research steps to appropriate agents
   */
  async delegateResearchSteps(
    steps: ResearchStep[],
    orchestrationState: OrchestrationState
  ): Promise<ResearchStepExecution[]> {
    const executableSteps = this.identifyExecutableSteps(steps, orchestrationState);
    const prioritizedSteps = this.prioritizeSteps(executableSteps);
    const executions: ResearchStepExecution[] = [];

    for (const step of prioritizedSteps) {
      try {
        const execution = await this.delegateStep(step, orchestrationState);
        executions.push(execution);
        this.activeTasks.set(step.id, execution);
      } catch (error) {
        console.error(`Failed to delegate step ${step.id}:`, error);
        // Continue with other steps - error recovery will handle this
      }
    }

    return executions;
  }

  /**
   * Identify steps that can be executed (dependencies satisfied)
   */
  private identifyExecutableSteps(
    allSteps: ResearchStep[],
    state: OrchestrationState
  ): ResearchStep[] {
    const completedStepIds = new Set(
      state.completedSteps.map(result => result.stepId)
    );

    return allSteps.filter(step => {
      // Check if step is already completed or active
      if (completedStepIds.has(step.id)) return false;
      if (this.activeTasks.has(step.id)) return false;

      // Check if all dependencies are satisfied
      return step.dependencies.every(depId => completedStepIds.has(depId));
    });
  }

  /**
   * Prioritize steps based on priority, dependencies, and resource availability
   */
  private prioritizeSteps(steps: ResearchStep[]): ResearchStep[] {
    return steps.sort((a, b) => {
      // Higher priority first (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Fewer dependencies first (to unblock other steps)
      if (a.dependencies.length !== b.dependencies.length) {
        return a.dependencies.length - b.dependencies.length;
      }

      // Shorter estimated duration first
      return a.estimatedDuration - b.estimatedDuration;
    });
  }

  /**
   * Delegate a single research step to the appropriate agent
   */
  private async delegateStep(
    step: ResearchStep,
    orchestrationState: OrchestrationState
  ): Promise<ResearchStepExecution> {
    const agentType = this.determineAgentType(step);
    const taskRequest = this.createTaskRequest(step, orchestrationState);

    const execution: ResearchStepExecution = {
      stepId: step.id,
      agentId: agentType,
      status: 'pending',
      progressUpdates: [],
      retryCount: 0,
      startedAt: new Date()
    };

    try {
      // Send task asynchronously - don't wait for completion
      this.a2aManager.sendTask(agentType, taskRequest).then(response => {
        this.handleTaskCompletion(step.id, response);
      }).catch(error => {
        this.handleTaskFailure(step.id, error);
      });

      execution.status = 'running';
      execution.assignedAgent = agentType;

    } catch (error) {
      execution.status = 'failed';
      console.error(`Failed to delegate step ${step.id}:`, error);
    }

    return execution;
  }

  /**
   * Determine which agent type should handle this research step
   */
  private determineAgentType(step: ResearchStep): AgentType {
    // Use the agent type specified in the step, or infer from step content
    if (step.agentType && step.agentType !== 'orchestrator') {
      return step.agentType as AgentType;
    }

    // Infer agent type from step description and requirements
    const description = step.description.toLowerCase();

    if (description.includes('web search') || description.includes('internet') || description.includes('online')) {
      return 'web-research';
    }

    if (description.includes('academic') || description.includes('scholarly') || description.includes('citation') || description.includes('paper')) {
      return 'academic-research';
    }

    if (description.includes('news') || description.includes('current events') || description.includes('recent')) {
      return 'news-research';
    }

    if (description.includes('data analysis') || description.includes('statistics') || description.includes('chart') || description.includes('visualization')) {
      return 'data-analysis';
    }

    // Default to web research for general research tasks
    return 'web-research';
  }

  /**
   * Create a task request for the research step
   */
  private createTaskRequest(
    step: ResearchStep,
    orchestrationState: OrchestrationState
  ): TaskRequest {
    const taskParameters = this.extractTaskParameters(step, orchestrationState);

    return {
      taskId: `task-${step.id}-${Date.now()}`,
      type: this.mapStepToTaskType(step),
      parameters: taskParameters,
      priority: step.priority,
      timeout: step.estimatedDuration * 60000, // Convert minutes to milliseconds
      metadata: {
        stepId: step.id,
        researchId: orchestrationState.researchId,
        topic: orchestrationState.plan.topic,
        successCriteria: step.successCriteria
      }
    };
  }

  /**
   * Extract task parameters from the research step
   */
  private extractTaskParameters(
    step: ResearchStep,
    orchestrationState: OrchestrationState
  ): Record<string, any> {
    // Base parameters available to all tasks
    const baseParams = {
      topic: orchestrationState.plan.topic,
      stepDescription: step.description,
      successCriteria: step.successCriteria,
      researchContext: {
        objectives: orchestrationState.plan.objectives,
        methodology: orchestrationState.plan.methodology.approach
      }
    };

    // Add step-specific parameters based on agent type
    const agentType = this.determineAgentType(step);

    switch (agentType) {
      case 'web-research':
        return {
          ...baseParams,
          searchQueries: this.generateSearchQueries(step, orchestrationState),
          maxResults: 20,
          includeImages: false
        };

      case 'academic-research':
        return {
          ...baseParams,
          academicDatabases: ['google-scholar', 'semantic-scholar'],
          publicationTypes: ['journal', 'conference', 'thesis'],
          minCitationCount: 5
        };

      case 'news-research':
        return {
          ...baseParams,
          dateRange: this.calculateDateRange(orchestrationState),
          newsSources: ['major', 'specialized'],
          recencyWeight: 0.8
        };

      case 'data-analysis':
        return {
          ...baseParams,
          dataSources: this.identifyDataSources(step, orchestrationState),
          analysisTypes: ['statistical', 'trend', 'correlation'],
          visualizationRequired: step.description.includes('visualize') || step.description.includes('chart')
        };

      default:
        return baseParams;
    }
  }

  /**
   * Map research step to specific task type for the target agent
   */
  private mapStepToTaskType(step: ResearchStep): string {
    const agentType = this.determineAgentType(step);
    const description = step.description.toLowerCase();

    switch (agentType) {
      case 'web-research':
        if (description.includes('comprehensive')) return 'comprehensive-web-search';
        if (description.includes('fact-check')) return 'fact-checking';
        return 'general-web-research';

      case 'academic-research':
        if (description.includes('literature review')) return 'literature-review';
        if (description.includes('citation analysis')) return 'citation-analysis';
        return 'academic-search';

      case 'news-research':
        if (description.includes('trend')) return 'news-trend-analysis';
        return 'current-events-research';

      case 'data-analysis':
        if (description.includes('visualize')) return 'data-visualization';
        if (description.includes('correlation')) return 'correlation-analysis';
        return 'statistical-analysis';

      default:
        return 'general-research';
    }
  }

  /**
   * Generate search queries for web research tasks
   */
  private generateSearchQueries(
    step: ResearchStep,
    orchestrationState: OrchestrationState
  ): string[] {
    const topic = orchestrationState.plan.topic;
    const description = step.description.toLowerCase();

    const queries = [topic];

    // Add specific query variations based on step requirements
    if (description.includes('background') || description.includes('overview')) {
      queries.push(`${topic} overview`, `${topic} introduction`);
    }

    if (description.includes('impact') || description.includes('effect')) {
      queries.push(`${topic} impact`, `${topic} effects`, `${topic} consequences`);
    }

    if (description.includes('comparison') || description.includes('vs')) {
      queries.push(`${topic} comparison`, `${topic} alternatives`);
    }

    if (description.includes('latest') || description.includes('recent')) {
      queries.push(`${topic} 2024`, `${topic} recent developments`);
    }

    return queries;
  }

  /**
   * Calculate appropriate date range for news research
   */
  private calculateDateRange(orchestrationState: OrchestrationState): { start: Date; end: Date } {
    const now = new Date();
    const topic = orchestrationState.plan.topic.toLowerCase();

    // Adjust date range based on topic recency requirements
    let monthsBack = 6; // Default 6 months

    if (topic.includes('breaking') || topic.includes('current') || topic.includes('today')) {
      monthsBack = 1;
    } else if (topic.includes('trend') || topic.includes('recent')) {
      monthsBack = 3;
    } else if (topic.includes('historical') || topic.includes('history')) {
      monthsBack = 24; // 2 years for historical context
    }

    const start = new Date(now);
    start.setMonth(start.getMonth() - monthsBack);

    return { start, end: now };
  }

  /**
   * Identify relevant data sources for analysis tasks
   */
  private identifyDataSources(
    step: ResearchStep,
    orchestrationState: OrchestrationState
  ): string[] {
    const dataSources = orchestrationState.plan.dataSources;
    const description = step.description.toLowerCase();

    // Filter data sources based on step requirements
    return dataSources
      .filter(source => {
        if (description.includes('statistical') && source.type === 'statistical') return true;
        if (description.includes('government') && source.type === 'government') return true;
        if (description.includes('academic') && source.type === 'academic') return true;
        if (description.includes('news') && source.type === 'news') return true;
        return source.type === 'statistical' || source.type === 'government'; // Default to quantitative sources
      })
      .map(source => source.type);
  }

  /**
   * Handle successful task completion
   */
  private handleTaskCompletion(stepId: string, response: any): void {
    const execution = this.activeTasks.get(stepId);
    if (execution) {
      execution.status = 'completed';
      execution.completedAt = new Date();
      console.log(`Task completed for step ${stepId}`);
    }
  }

  /**
   * Handle task failure
   */
  private handleTaskFailure(stepId: string, error: any): void {
    const execution = this.activeTasks.get(stepId);
    if (execution) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      console.error(`Task failed for step ${stepId}:`, error);
    }
  }

  /**
   * Get active task executions
   */
  getActiveTasks(): ResearchStepExecution[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Cancel a delegated task
   */
  async cancelTask(stepId: string): Promise<boolean> {
    const execution = this.activeTasks.get(stepId);
    if (!execution) return false;

    try {
      // Cancel through A2A manager (would need to be implemented)
      // await this.a2aManager.cancelTask(execution.assignedAgent!, stepId);
      execution.status = 'cancelled';
      execution.completedAt = new Date();
      this.activeTasks.delete(stepId);
      return true;
    } catch (error) {
      console.error(`Failed to cancel task for step ${stepId}:`, error);
      return false;
    }
  }

  /**
   * Clean up completed tasks
   */
  cleanupCompletedTasks(): void {
    for (const [stepId, execution] of this.activeTasks.entries()) {
      if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') {
        this.activeTasks.delete(stepId);
      }
    }
  }
}
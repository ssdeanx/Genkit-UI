import type { OrchestrationState, OrchestrationIssue, ResearchStepExecution, ResearchStep } from '../shared/interfaces.js';
import { log } from './logger.js';
import type { TaskDelegator } from './task-delegator.js';

/**
 * Error Recovery System for the Orchestrator Agent
 * Handles failures, implements fallback strategies, and manages recovery processes
 */
export class ErrorRecovery {
  private retryAttempts: Map<string, number> = new Map();
  private backoffDelays: Map<string, number> = new Map();
  private recoveryInProgress: Set<string> = new Set();

  constructor(private taskDelegator: TaskDelegator) {
    // Mark parameter as used and perform a harmless read to satisfy strict unused checks
    void taskDelegator;
    this._activeTasksCount();
  }

  private _activeTasksCount(): number {
    try {
      const list = this.taskDelegator.getActiveTasks();
      return Array.isArray(list) ? list.length : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Handle a failed research step execution
   */
  async handleStepFailure(
    stepId: string,
    execution: ResearchStepExecution,
    error: unknown,
    orchestrationState: OrchestrationState
  ): Promise<{
    recoveryAction: 'retry' | 'fallback' | 'escalate' | 'abort';
    newExecution?: ResearchStepExecution;
    issue?: OrchestrationIssue;
  }> {
    const failureType = this.classifyFailure(error);
    const retryCount = this.retryAttempts.get(stepId) ?? 0;

    // Check if we've exceeded maximum retries
    if (retryCount >= this.getMaxRetries(failureType)) {
      return await this.handleExhaustedRetries(stepId, execution, failureType, orchestrationState);
    }

    // Attempt recovery based on failure type
    switch (failureType) {
      case 'temporary':
        return this.handleTemporaryFailure(stepId, execution, retryCount);

      case 'rate-limit':
        return this.handleRateLimitFailure(stepId, execution, retryCount);

      case 'agent-unavailable':
        return this.handleAgentUnavailableFailure(stepId, execution, orchestrationState);

      case 'data-quality':
        return this.handleDataQualityFailure(stepId, execution, orchestrationState);

      case 'critical':
      default:
        return this.handleCriticalFailure(stepId, execution, error, orchestrationState);
    }
  }

  /**
   * Classify the type of failure based on error characteristics
   */
  private classifyFailure(error: unknown): 'temporary' | 'rate-limit' | 'agent-unavailable' | 'data-quality' | 'critical' {
    const err = error as Partial<{ message: string; code: string | number; status: string | number }> | undefined;
    const errorMessage = (err?.message ?? '').toLowerCase();
    const errorCode = (err?.code ?? err?.status);

    // Network and temporary errors
    if (errorCode === 'ECONNRESET' || errorCode === 'ETIMEDOUT' || errorCode === 'ENOTFOUND') {
      return 'temporary';
    }

    // Rate limiting
    if (errorCode === 429 || (Boolean(errorMessage.includes('rate limit'))) || (Boolean(errorMessage.includes('quota')))) {
      return 'rate-limit';
    }

    // Agent unavailable
    if (errorCode === 503 || (Boolean(errorMessage.includes('service unavailable'))) || (Boolean(errorMessage.includes('agent unavailable')))) {
      return 'agent-unavailable';
    }

    // Data quality issues
    if ((Boolean(errorMessage.includes('invalid data'))) || (Boolean(errorMessage.includes('malformed'))) || (Boolean(errorMessage.includes('quality')))) {
      return 'data-quality';
    }

    // Authentication and permission errors
    if (errorCode === 401 || errorCode === 403 || (Boolean(errorMessage.includes('unauthorized'))) || (Boolean(errorMessage.includes('forbidden')))) {
      return 'critical';
    }

    // Default to temporary for unknown errors
    return 'temporary';
  }

  /**
   * Get maximum retry attempts for a failure type
   */
  private getMaxRetries(failureType: string): number {
    const retryLimits = {
      'temporary': 3,
      'rate-limit': 5,
      'agent-unavailable': 2,
      'data-quality': 1,
      'critical': 0
    };

    return retryLimits[failureType as keyof typeof retryLimits] || 1;
  }

  /**
   * Handle temporary failures with exponential backoff
   */
  private handleTemporaryFailure(
    stepId: string,
    execution: ResearchStepExecution,
    retryCount: number
  ): {
    recoveryAction: 'retry' | 'fallback' | 'escalate' | 'abort';
    newExecution?: ResearchStepExecution;
  } {
    const backoffDelay = this.calculateBackoffDelay(retryCount);
    this.backoffDelays.set(stepId, backoffDelay);

    // Schedule retry after backoff delay
    setTimeout(() => {
      this.executeRetry(stepId, execution);
    }, backoffDelay);

    return {
      recoveryAction: 'retry',
      newExecution: {
        ...execution,
        status: 'pending',
        retryCount: retryCount + 1
      }
    };
  }

  /**
   * Handle rate limiting with appropriate backoff
   */
  private handleRateLimitFailure(
    stepId: string,
    execution: ResearchStepExecution,
    retryCount: number
  ): {
    recoveryAction: 'retry' | 'fallback' | 'escalate' | 'abort';
    newExecution?: ResearchStepExecution;
  } {
    // Rate limits typically need longer backoff
    const backoffDelay = Math.min(30000 * Math.pow(2, retryCount), 300000); // Max 5 minutes
    this.backoffDelays.set(stepId, backoffDelay);

    setTimeout(() => {
      this.executeRetry(stepId, execution);
    }, backoffDelay);

    return {
      recoveryAction: 'retry',
      newExecution: {
        ...execution,
        status: 'pending',
        retryCount: retryCount + 1
      }
    };
  }

  /**
   * Handle agent unavailable failures by trying alternative agents
   */
  private async handleAgentUnavailableFailure(
    stepId: string,
    execution: ResearchStepExecution,
    orchestrationState: OrchestrationState
  ): Promise<{
    recoveryAction: 'retry' | 'fallback' | 'escalate' | 'abort';
    newExecution?: ResearchStepExecution;
    issue?: OrchestrationIssue;
  }> {
    // Try to find an alternative agent for this step
    const alternativeAgent = this.findAlternativeAgent(execution.agentId, orchestrationState.plan.executionSteps);

    if (typeof alternativeAgent === 'string' && alternativeAgent.length > 0) {
      // Delegate to alternative agent
      try {
        const stepDef = orchestrationState.plan.executionSteps.find(s => s.id === stepId);
        if (!stepDef) {
          throw new Error(`Step not found: ${stepId}`);
        }
        const [delegatedExecution] = await this.taskDelegator.delegateResearchSteps([stepDef], orchestrationState);
        if (!delegatedExecution) {
          throw new Error('Delegation returned no executions');
        }

        const baseExecution: ResearchStepExecution = {
          stepId: delegatedExecution.stepId ?? execution.stepId,
          agentId: delegatedExecution.agentId ?? alternativeAgent,
          status: delegatedExecution.status ?? 'pending',
          startedAt: delegatedExecution.startedAt ?? new Date(),
          // only set completedAt if it exists; omit otherwise to honor optional semantics
          ...(delegatedExecution.completedAt ? { completedAt: delegatedExecution.completedAt } : {}),
          progressUpdates: delegatedExecution.progressUpdates ?? [],
          assignedAgent: alternativeAgent,
          retryCount: execution.retryCount + 1
        };

        const newExecution: ResearchStepExecution =
          delegatedExecution.result !== undefined
            ? { ...baseExecution, result: delegatedExecution.result }
            : baseExecution;

        return {
          recoveryAction: 'fallback',
          newExecution
        };
      } catch {
        // Fallback failed, escalate
        return {
          recoveryAction: 'escalate',
          issue: this.createIssue(stepId, 'agent-failure', 'high',
            `Primary agent ${execution.agentId} and alternative agent ${alternativeAgent} both unavailable`,
            `Consider manual intervention or system maintenance`)
        };
      }
    }

    // No alternative available
    return {
      recoveryAction: 'escalate',
      issue: this.createIssue(stepId, 'agent-failure', 'high',
        `Agent ${execution.agentId} unavailable with no alternatives`,
        `Check agent health and consider adding redundant agents`)
    };
  }

  /**
   * Handle data quality failures
   */
  private handleDataQualityFailure(
    stepId: string,
    execution: ResearchStepExecution,
    orchestrationState: OrchestrationState
  ): {
    recoveryAction: 'retry' | 'fallback' | 'escalate' | 'abort';
    newExecution?: ResearchStepExecution;
    issue?: OrchestrationIssue;
  } {
    // For data quality issues, we typically can't retry the same agent
    // Try an alternative approach or escalate
    const step = orchestrationState.plan.executionSteps.find(s => s.id === stepId);

    if (step && this.canRetryWithDifferentParameters(step)) {
      // Modify parameters and retry
      return {
        recoveryAction: 'retry',
        newExecution: {
          ...execution,
          status: 'pending',
          retryCount: execution.retryCount + 1
        }
      };
    }

    // Escalate data quality issues
    return {
      recoveryAction: 'escalate',
      issue: this.createIssue(stepId, 'data-quality', 'medium',
        `Data quality issues detected in step ${stepId}`,
        `Review data validation rules and consider manual data verification`)
    };
  }

  /**
   * Handle critical failures that require escalation
   */
  private async handleCriticalFailure(
    stepId: string,
    execution: ResearchStepExecution,
    error: unknown,
    orchestrationState: OrchestrationState
  ): Promise<{
    recoveryAction: 'retry' | 'fallback' | 'escalate' | 'abort';
    issue?: OrchestrationIssue;
  }> {
    // Check if this affects other steps
    const dependentSteps = this.findDependentSteps(stepId, orchestrationState);

    const severity = dependentSteps.length > 0 ? 'high' : 'medium';

    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      recoveryAction: 'escalate',
      issue: this.createIssue(stepId, 'agent-failure', severity,
        `Critical failure in step ${stepId}: ${errMsg}`,
        `Manual intervention required. ${dependentSteps.length} dependent steps may be affected.`,
        dependentSteps)
    };
  }

  /**
   * Handle exhausted retries - decide between fallback, escalation, or abort
   */
  private async handleExhaustedRetries(
    stepId: string,
    execution: ResearchStepExecution,
    failureType: string,
    orchestrationState: OrchestrationState
  ): Promise<{
    recoveryAction: 'retry' | 'fallback' | 'escalate' | 'abort';
    issue?: OrchestrationIssue;
  }> {
    const step = orchestrationState.plan.executionSteps.find(s => s.id === stepId);
    const strategies = step?.fallbackStrategies ?? [];
    const hasFallback = strategies.length > 0;

    if (hasFallback && failureType !== 'critical') {
      // Try fallback strategy
      return {
        recoveryAction: 'fallback',
        issue: this.createIssue(stepId, 'dependency-blocked', 'medium',
          `Step ${stepId} failed after maximum retries, attempting fallback`,
          `Fallback strategies: ${strategies.join(', ')}`)
      };
    }

    // Check impact on overall research
    const dependentSteps = this.findDependentSteps(stepId, orchestrationState);
    const isCriticalPath = this.isCriticalPath(stepId, orchestrationState);

    if (isCriticalPath || dependentSteps.length > 5) {
      return {
        recoveryAction: 'escalate',
        issue: this.createIssue(stepId, 'agent-failure', 'critical',
          `Critical step ${stepId} failed permanently`,
          `This failure blocks ${dependentSteps.length} dependent steps. Manual intervention required.`,
          dependentSteps)
      };
    }

    // For non-critical steps, we can abort this step and continue
    return {
      recoveryAction: 'abort',
      issue: this.createIssue(stepId, 'agent-failure', 'low',
        `Step ${stepId} aborted after exhausting all recovery options`,
        `Research can continue with reduced scope`)
    };
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(retryCount: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = baseDelay * Math.pow(2, retryCount);

    return Math.min(delay, maxDelay);
  }

  /**
   * Execute a retry for a failed step
   */
  private async executeRetry(stepId: string, execution: ResearchStepExecution): Promise<void> {
    try {
      // Update retry count
      this.retryAttempts.set(stepId, execution.retryCount + 1);

      // Re-delegate the task (this would need to be implemented in TaskDelegator)
      log('log', `Retrying step ${stepId} (attempt ${execution.retryCount + 1})`);

      // The actual retry logic would be handled by re-calling the task delegation

    } catch (error) {
      log('error', `Retry failed for step ${stepId}:`, error);
    } finally {
      this.backoffDelays.delete(stepId);
    }
  }

  /**
   * Find an alternative agent for a failed step
   */
  private findAlternativeAgent(failedAgent: string, steps: Array<Pick<ResearchStep, 'agentType'>>): string | null {
    // Define agent type mappings for fallbacks
    const agentFallbacks: Record<string, string[]> = {
      'web-research': ['academic-research', 'news-research'],
      'academic-research': ['web-research', 'news-research'],
      'news-research': ['web-research', 'academic-research'],
      'data-analysis': ['web-research'] // Limited fallbacks for data analysis
    };

    const fallbacks = agentFallbacks[failedAgent] ?? [];

    // Find a fallback that's not already overloaded
    for (const fallback of fallbacks) {
      const usageCount = steps.filter(s => s.agentType === fallback).length;
      if (usageCount < 3) { // Arbitrary limit to prevent overload
        return fallback;
      }
    }

    return null;
  }

  /**
   * Check if a step can be retried with different parameters
   */
  private canRetryWithDifferentParameters(step: Pick<ResearchStep, 'description'>): boolean {
    const description = step.description.toLowerCase();

    // Steps that can benefit from parameter changes
    return description.includes('search') ||
           description.includes('query') ||
           description.includes('filter') ||
           description.includes('limit');
  }

  /**
   * Find steps that depend on the given step
   */
  private findDependentSteps(stepId: string, orchestrationState: OrchestrationState): string[] {
    const steps = orchestrationState.plan.executionSteps;
    return steps
      .filter((step) => step.dependencies.includes(stepId))
      .map((step) => step.id);
  }

  /**
   * Check if a step is on the critical path
   */
  private isCriticalPath(stepId: string, orchestrationState: OrchestrationState): boolean {
    // A simple heuristic: steps with high priority or many dependencies
    const step = orchestrationState.plan.executionSteps.find(s => s.id === stepId);

    if (!step) {return false;}

    const dependentCount = this.findDependentSteps(stepId, orchestrationState).length;
    const hasHighPriority = step.priority >= 4;

    return hasHighPriority || dependentCount >= 3;
  }

  /**
   * Create an orchestration issue
   */
  private createIssue(
    stepId: string,
    type: OrchestrationIssue['type'],
    severity: OrchestrationIssue['severity'],
    description: string,
    resolution?: string,
    affectedSteps?: string[]
  ): OrchestrationIssue {
    return {
      id: `issue-${stepId}-${Date.now()}`,
      type,
      severity,
      description,
      affectedSteps: affectedSteps ?? [stepId],
      // Ensure resolution is always a string (avoid `undefined`) to satisfy exactOptionalPropertyTypes
      resolution: resolution ?? '',
      createdAt: new Date()
    };
  }

  /**
   * Get recovery status for a step
   */
  getRecoveryStatus(stepId: string): {
    retryCount: number;
    backoffDelay: number;
    inProgress: boolean;
  } {
    return {
      retryCount: this.retryAttempts.get(stepId) ?? 0,
      backoffDelay: this.backoffDelays.get(stepId) ?? 0,
      inProgress: this.recoveryInProgress.has(stepId)
    };
  }

  /**
   * Clean up recovery state for completed research
   */
  cleanupRecoveryState(researchId: string): void {
    // Clean up step-specific recovery state
    for (const [stepId] of this.retryAttempts.entries()) {
      if (stepId.startsWith(`${researchId}-`)) {
        this.retryAttempts.delete(stepId);
        this.backoffDelays.delete(stepId);
        this.recoveryInProgress.delete(stepId);
      }
    }
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalRetries: number;
    activeRecoveries: number;
    successRate: number;
  } {
    const totalRetries = Array.from(this.retryAttempts.values()).reduce((sum, count) => sum + count, 0);
    const activeRecoveries = this.recoveryInProgress.size;

    // Calculate success rate (simplified - would need more tracking in real implementation)
    const successRate = totalRetries > 0 ? Math.max(0, 1 - (activeRecoveries / totalRetries)) : 1;

    return {
      totalRetries,
      activeRecoveries,
      successRate
    };
  }
}
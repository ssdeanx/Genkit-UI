import type { OrchestrationState, ResearchStepExecution, ProgressUpdate, ResearchStepResult } from '../shared/interfaces.js';

/**
 * Progress Tracking System for the Orchestrator Agent
 * Monitors research execution progress and provides real-time updates
 */
export class ProgressTracker {
  private progressHistory: Map<string, ProgressUpdate[]> = new Map();
  private stepStartTimes: Map<string, Date> = new Map();
  private estimatedDurations: Map<string, number> = new Map();

  /**
   * Initialize progress tracking for a research plan
   */
  initializeProgressTracking(orchestrationState: OrchestrationState): void {
    const { researchId, plan } = orchestrationState;

    // Initialize progress history for the research
    this.progressHistory.set(researchId, []);

    // Store estimated durations for progress calculations
    plan.executionSteps.forEach(step => {
      this.estimatedDurations.set(step.id, step.estimatedDuration);
    });

    // Add initial progress update
    this.addProgressUpdate(researchId, {
      timestamp: new Date(),
      message: `Research initialized with ${plan.executionSteps.length} steps`,
      percentage: 0,
      currentActivity: 'Planning phase',
      estimatedTimeRemaining: this.calculateTotalEstimatedTime(plan.executionSteps)
    });
  }

  /**
   * Record the start of a research step execution
   */
  recordStepStart(stepId: string, execution: ResearchStepExecution): void {
    this.stepStartTimes.set(stepId, execution.startedAt || new Date());

    // Add progress update for step start
    const researchId = this.extractResearchIdFromStepId(stepId);
    this.addProgressUpdate(researchId, {
      timestamp: new Date(),
      message: `Started executing step: ${execution.stepId}`,
      currentActivity: `Running ${execution.agentId} agent`,
      estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(researchId)
    });
  }

  /**
   * Record the completion of a research step
   */
  recordStepCompletion(stepId: string, result: ResearchStepResult, orchestrationState: OrchestrationState): void {
    const startTime = this.stepStartTimes.get(stepId);
    const actualDuration = startTime ? Date.now() - startTime.getTime() : 0;

    // Update estimated duration based on actual performance
    this.updateEstimatedDuration(stepId, actualDuration);

    // Add progress update for step completion
    const { researchId } = orchestrationState;
    const progress = this.calculateOverallProgress(orchestrationState);

    this.addProgressUpdate(researchId, {
      timestamp: new Date(),
      message: `Completed step ${stepId} (${result.status})`,
      percentage: progress.percentage,
      currentActivity: `Step ${stepId} completed`,
      estimatedTimeRemaining: progress.estimatedTimeRemaining
    });
  }

  /**
   * Record a progress update from an agent
   */
  recordAgentProgress(stepId: string, update: ProgressUpdate, orchestrationState: OrchestrationState): void {
    const { researchId } = orchestrationState;

    // Add the agent update to our progress history
    this.addProgressUpdate(researchId, {
      ...update,
      message: `Step ${stepId}: ${update.message}`,
      currentActivity: update.currentActivity
    });

    // Update overall progress if percentage is provided
    if (update.percentage !== undefined) {
      const overallProgress = this.calculateOverallProgress(orchestrationState);
      this.addProgressUpdate(researchId, {
        timestamp: new Date(),
        message: `Overall progress: ${overallProgress.percentage.toFixed(1)}%`,
        percentage: overallProgress.percentage,
        currentActivity: update.currentActivity,
        estimatedTimeRemaining: overallProgress.estimatedTimeRemaining
      });
    }
  }

  /**
   * Calculate overall research progress
   */
  calculateOverallProgress(orchestrationState: OrchestrationState): {
    percentage: number;
    completedSteps: number;
    totalSteps: number;
    estimatedTimeRemaining: number;
    overallConfidence: number;
  } {
    const { completedSteps, activeSteps, plan } = orchestrationState;
    const totalSteps = plan.executionSteps.length;
    const completedCount = completedSteps.length;
    const activeCount = activeSteps.length;

    // Calculate base completion percentage
    let percentage = (completedCount / totalSteps) * 100;

    // Add partial credit for active steps (assume 50% complete)
    percentage += (activeCount * 0.5 / totalSteps) * 100;

    // Ensure percentage doesn't exceed 100%
    percentage = Math.min(percentage, 100);

    // Calculate estimated time remaining
    const estimatedTimeRemaining = this.calculateEstimatedTimeRemaining(orchestrationState.researchId);

    // Calculate overall confidence based on completed step quality
    const overallConfidence = this.calculateOverallConfidence(completedSteps);

    return {
      percentage,
      completedSteps: completedCount,
      totalSteps,
      estimatedTimeRemaining,
      overallConfidence
    };
  }

  /**
   * Calculate estimated time remaining for the research
   */
  private calculateEstimatedTimeRemaining(researchId: string): number {
    const updates = this.progressHistory.get(researchId) || [];
    const latestUpdate = updates[updates.length - 1];

    if (latestUpdate?.estimatedTimeRemaining !== undefined) {
      return latestUpdate.estimatedTimeRemaining;
    }

    // Fallback: sum remaining estimated durations
    let remainingTime = 0;
    for (const [stepId, estimatedDuration] of this.estimatedDurations.entries()) {
      // Assume steps not in progress history are remaining
      if (!this.stepStartTimes.has(stepId)) {
        remainingTime += estimatedDuration;
      }
    }

    return remainingTime;
  }

  /**
   * Calculate total estimated time for all steps
   */
  private calculateTotalEstimatedTime(steps: Array<{ estimatedDuration: number }>): number {
    return steps.reduce((total, step) => total + step.estimatedDuration, 0);
  }

  /**
   * Calculate overall confidence based on completed step results
   */
  private calculateOverallConfidence(completedSteps: ResearchStepResult[]): number {
    if (completedSteps.length === 0) {
      return 0.5; // Default confidence
    }

    const totalConfidence = completedSteps.reduce((sum, step) => sum + step.qualityScore, 0);
    return totalConfidence / completedSteps.length;
  }

  /**
   * Update estimated duration based on actual performance
   */
  private updateEstimatedDuration(stepId: string, actualDurationMs: number): void {
    const actualDurationMinutes = actualDurationMs / (1000 * 60); // Convert to minutes
    const currentEstimate = this.estimatedDurations.get(stepId);

    if (currentEstimate) {
      // Use exponential moving average for updated estimate
      const alpha = 0.3; // Learning rate
      const newEstimate = alpha * actualDurationMinutes + (1 - alpha) * currentEstimate;
      this.estimatedDurations.set(stepId, newEstimate);
    }
  }

  /**
   * Add a progress update to the history
   */
  private addProgressUpdate(researchId: string, update: ProgressUpdate): void {
    const history = this.progressHistory.get(researchId) || [];
    history.push(update);
    this.progressHistory.set(researchId, history);

    // Keep only last 100 updates to prevent memory issues
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Extract research ID from step ID (assumes format: researchId-stepId)
   */
  private extractResearchIdFromStepId(stepId: string): string {
    // This is a simple implementation - in practice, you might want a more robust way
    // to associate steps with research IDs
    return stepId.split('-')[0] || 'unknown';
  }

  /**
   * Get progress history for a research project
   */
  getProgressHistory(researchId: string): ProgressUpdate[] {
    return this.progressHistory.get(researchId) || [];
  }

  /**
   * Get current progress status
   */
  getCurrentProgress(researchId: string, orchestrationState: OrchestrationState): {
    currentStatus: ProgressUpdate | null;
    overallProgress: ReturnType<ProgressTracker['calculateOverallProgress']>;
    recentUpdates: ProgressUpdate[];
  } {
    const history = this.progressHistory.get(researchId) || [];
    const currentStatus = history[history.length - 1] || null;
    const overallProgress = this.calculateOverallProgress(orchestrationState);
    const recentUpdates = history.slice(-5); // Last 5 updates

    return {
      currentStatus,
      overallProgress,
      recentUpdates
    };
  }

  /**
   * Generate a progress report
   */
  generateProgressReport(researchId: string, orchestrationState: OrchestrationState): {
    summary: string;
    details: {
      completedSteps: number;
      activeSteps: number;
      totalSteps: number;
      percentage: number;
      estimatedTimeRemaining: number;
      overallConfidence: number;
    };
    timeline: Array<{
      timestamp: Date;
      activity: string;
      percentage?: number;
    }>;
    issues: string[];
  } {
    const progress = this.calculateOverallProgress(orchestrationState);
    const history = this.progressHistory.get(researchId) || [];

    const summary = `Research ${researchId} is ${progress.percentage.toFixed(1)}% complete with ${progress.completedSteps} of ${progress.totalSteps} steps finished.`;

    const timeline = history.slice(-10).map(update => ({
      timestamp: update.timestamp,
      activity: update.currentActivity,
      percentage: update.percentage
    }));

    const issues = orchestrationState.issues
      .filter(issue => !issue.resolvedAt)
      .map(issue => issue.description);

    return {
      summary,
      details: {
        completedSteps: progress.completedSteps,
        activeSteps: orchestrationState.activeSteps.length,
        totalSteps: progress.totalSteps,
        percentage: progress.percentage,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        overallConfidence: progress.overallConfidence
      },
      timeline,
      issues
    };
  }

  /**
   * Check if research is at risk of missing deadline
   */
  isAtRiskOfDelay(orchestrationState: OrchestrationState, deadline?: Date): boolean {
    if (!deadline) {
      return false;
    }

    const progress = this.calculateOverallProgress(orchestrationState);
    const timeRemaining = progress.estimatedTimeRemaining;
    const deadlineTime = deadline.getTime();
    const currentTime = Date.now();
    const availableTime = (deadlineTime - currentTime) / (1000 * 60); // Convert to minutes

    // Consider at risk if estimated time remaining exceeds 90% of available time
    return timeRemaining > (availableTime * 0.9);
  }

  /**
   * Clean up progress tracking for completed research
   */
  cleanupResearchProgress(researchId: string): void {
    this.progressHistory.delete(researchId);

    // Clean up step-specific data
    for (const [stepId, startTime] of this.stepStartTimes.entries()) {
      if (stepId.startsWith(`${researchId}-`)) {
        this.stepStartTimes.delete(stepId);
        this.estimatedDurations.delete(stepId);
      }
    }
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics(researchId: string): {
    averageStepDuration: number;
    completionRate: number;
    timeAccuracy: number; // How accurate our estimates are
    totalActiveTime: number;
  } {
    const history = this.progressHistory.get(researchId) || [];
    const completedSteps = Array.from(this.stepStartTimes.entries())
      .filter(([stepId]) => stepId.startsWith(`${researchId}-`))
      .filter(([stepId]) => {
        // Check if step is completed (simplified check)
        return history.some(update => update.message.includes(`Completed step ${stepId}`));
      });

    if (completedSteps.length === 0) {
      return {
        averageStepDuration: 0,
        completionRate: 0,
        timeAccuracy: 0,
        totalActiveTime: 0
      };
    }

    const durations = completedSteps.map(([stepId, startTime]) => {
      const completionUpdate = history.find(update =>
        update.message.includes(`Completed step ${stepId}`)
      );
      if (completionUpdate) {
        return completionUpdate.timestamp.getTime() - startTime.getTime();
      }
      return 0;
    }).filter(duration => duration > 0);

    const averageStepDuration = durations.reduce((sum, dur) => sum + dur, 0) / durations.length;
    const totalEstimatedTime = Array.from(this.estimatedDurations.entries())
      .filter(([stepId]) => stepId.startsWith(`${researchId}-`))
      .reduce((sum, [, duration]) => sum + duration, 0);

    const totalActualTime = durations.reduce((sum, dur) => sum + dur, 0);
    const timeAccuracy = totalEstimatedTime > 0 ? totalActualTime / totalEstimatedTime : 1;

    const totalActiveTime = Date.now() - Math.min(...completedSteps.map(([, time]) => time.getTime()));

    return {
      averageStepDuration: averageStepDuration / (1000 * 60), // Convert to minutes
      completionRate: completedSteps.length / this.estimatedDurations.size,
      timeAccuracy,
      totalActiveTime: totalActiveTime / (1000 * 60) // Convert to minutes
    };
  }
}
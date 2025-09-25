import {
  OrchestrationState,
  ResearchPlan,
  ResearchStepExecution,
  ResearchStepResult,
  OrchestrationIssue,
  ProgressUpdate,
  ResearchStep
} from '../shared/interfaces.js';

/**
 * State Manager for orchestrating research execution
 * Maintains research state across agent interactions and system restarts
 */
export class OrchestratorStateManager {
  private researchStates: Map<string, OrchestrationState> = new Map();
  private statePersistenceEnabled: boolean = false;

  constructor(persistenceEnabled: boolean = false) {
    this.statePersistenceEnabled = persistenceEnabled;
    if (persistenceEnabled) {
      this.loadPersistedStates();
    }
  }

  /**
   * Initialize a new research orchestration state
   */
  initializeResearch(researchId: string, plan: ResearchPlan): OrchestrationState {
    const state: OrchestrationState = {
      researchId,
      plan,
      currentPhase: 'planning',
      activeSteps: [],
      completedSteps: [],
      issues: [],
      progress: {
        completedSteps: 0,
        totalSteps: plan.executionSteps.length,
        estimatedTimeRemaining: this.calculateEstimatedTime(plan.executionSteps),
        overallConfidence: 0.5, // Start with moderate confidence
      },
      startedAt: new Date(),
      lastUpdated: new Date(),
    };

    this.researchStates.set(researchId, state);
    this.persistState(researchId, state);

    return state;
  }

  /**
   * Get current orchestration state for a research project
   */
  getResearchState(researchId: string): OrchestrationState | null {
    return this.researchStates.get(researchId) || null;
  }

  /**
   * Update research phase
   */
  updatePhase(researchId: string, phase: OrchestrationState['currentPhase']): void {
    const state = this.researchStates.get(researchId);
    if (!state) {
      throw new Error(`Research state not found: ${researchId}`);
    }

    state.currentPhase = phase;
    state.lastUpdated = new Date();

    this.persistState(researchId, state);
  }

  /**
   * Add a new active step execution
   */
  addActiveStep(researchId: string, stepExecution: ResearchStepExecution): void {
    const state = this.researchStates.get(researchId);
    if (!state) {
      throw new Error(`Research state not found: ${researchId}`);
    }

    // Check if step is already active
    const existingIndex = state.activeSteps.findIndex(s => s.stepId === stepExecution.stepId);
    if (existingIndex >= 0) {
      // Update existing step
      state.activeSteps[existingIndex] = stepExecution;
    } else {
      // Add new step
      state.activeSteps.push(stepExecution);
    }

    state.lastUpdated = new Date();
    this.persistState(researchId, state);
  }

  /**
   * Complete an active step and move it to completed steps
   */
  completeStep(researchId: string, stepId: string, result: ResearchStepResult): void {
    const state = this.researchStates.get(researchId);
    if (!state) {
      throw new Error(`Research state not found: ${researchId}`);
    }

    // Remove from active steps
    const activeIndex = state.activeSteps.findIndex(s => s.stepId === stepId);
    if (activeIndex >= 0) {
      state.activeSteps.splice(activeIndex, 1);
    }

    // Add to completed steps
    const existingResultIndex = state.completedSteps.findIndex(s => s.stepId === stepId);
    if (existingResultIndex >= 0) {
      state.completedSteps[existingResultIndex] = result;
    } else {
      state.completedSteps.push(result);
    }

    // Update progress
    this.updateProgressMetrics(state);

    state.lastUpdated = new Date();
    this.persistState(researchId, state);
  }

  /**
   * Add an issue to the research state
   */
  addIssue(researchId: string, issue: OrchestrationIssue): void {
    const state = this.researchStates.get(researchId);
    if (!state) {
      throw new Error(`Research state not found: ${researchId}`);
    }

    state.issues.push(issue);
    state.lastUpdated = new Date();

    this.persistState(researchId, state);
  }

  /**
   * Resolve an issue
   */
  resolveIssue(researchId: string, issueId: string, resolution?: string): void {
    const state = this.researchStates.get(researchId);
    if (!state) {
      throw new Error(`Research state not found: ${researchId}`);
    }

    const issue = state.issues.find(i => i.id === issueId);
    if (issue) {
      issue.resolvedAt = new Date();
      if (resolution) {
        issue.resolution = resolution;
      }
    }

    state.lastUpdated = new Date();
    this.persistState(researchId, state);
  }

  /**
   * Add a progress update to an active step
   */
  addProgressUpdate(researchId: string, stepId: string, update: ProgressUpdate): void {
    const state = this.researchStates.get(researchId);
    if (!state) {
      throw new Error(`Research state not found: ${researchId}`);
    }

    const step = state.activeSteps.find(s => s.stepId === stepId);
    if (step) {
      step.progressUpdates.push(update);
      state.lastUpdated = new Date();
      this.persistState(researchId, state);
    }
  }

  /**
   * Get all active steps for a research project
   */
  getActiveSteps(researchId: string): ResearchStepExecution[] {
    const state = this.researchStates.get(researchId);
    return state ? state.activeSteps : [];
  }

  /**
   * Get all completed steps for a research project
   */
  getCompletedSteps(researchId: string): ResearchStepResult[] {
    const state = this.researchStates.get(researchId);
    return state ? state.completedSteps : [];
  }

  /**
   * Check if research is complete
   */
  isResearchComplete(researchId: string): boolean {
    const state = this.researchStates.get(researchId);
    if (!state) {
      return false;
    }

    const totalSteps = state.plan.executionSteps.length;
    const completedSteps = state.completedSteps.length;
    const activeSteps = state.activeSteps.length;

    return completedSteps === totalSteps && activeSteps === 0;
  }

  /**
   * Get research progress summary
   */
  getProgressSummary(researchId: string): OrchestrationState['progress'] | null {
    const state = this.researchStates.get(researchId);
    return state ? state.progress : null;
  }

  /**
   * Clean up completed research states (for memory management)
   */
  cleanupCompletedResearch(maxAgeHours: number = 24): string[] {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const cleanedUp: string[] = [];

    for (const [researchId, state] of this.researchStates.entries()) {
      if (state.lastUpdated < cutoffTime && this.isResearchComplete(researchId)) {
        this.researchStates.delete(researchId);
        cleanedUp.push(researchId);
      }
    }

    return cleanedUp;
  }

  /**
   * List all active research projects
   */
  listActiveResearch(): string[] {
    const active: string[] = [];
    for (const [researchId, state] of this.researchStates.entries()) {
      if (!this.isResearchComplete(researchId)) {
        active.push(researchId);
      }
    }
    return active;
  }

  private calculateEstimatedTime(steps: ResearchStep[]): number {
    return steps.reduce((total, step) => {
      // Estimate 30 minutes per step if not specified
      return total + (step.estimatedDuration || 30);
    }, 0);
  }

  private updateProgressMetrics(state: OrchestrationState): void {
    const completedCount = state.completedSteps.length;
    const totalCount = state.plan.executionSteps.length;

    state.progress.completedSteps = completedCount;
    state.progress.totalSteps = totalCount;

    // Calculate estimated time remaining based on completed steps
    const avgTimePerStep = state.completedSteps.reduce((sum, step) => {
      return sum + (step.processingTime || 0);
    }, 0) / Math.max(state.completedSteps.length, 1);

    const remainingSteps = totalCount - completedCount;
    state.progress.estimatedTimeRemaining = remainingSteps * avgTimePerStep;

    // Calculate overall confidence based on step results
    const avgQuality = state.completedSteps.reduce((sum, step) => {
      return sum + (step.qualityScore || 0);
    }, 0) / Math.max(state.completedSteps.length, 1);

    state.progress.overallConfidence = avgQuality || 0.5;
  }

  private persistState(researchId: string, state: OrchestrationState): void {
    if (!this.statePersistenceEnabled) {
      return;
    }

    try {
      // In a real implementation, this would save to a database or file
      // For now, just log that persistence would happen
      console.log(`Persisting state for research ${researchId}`);
    } catch (error) {
      console.error(`Failed to persist state for research ${researchId}:`, error);
    }
  }

  private loadPersistedStates(): void {
    if (!this.statePersistenceEnabled) {
      return;
    }

    try {
      // In a real implementation, this would load from a database or file
      // For now, just log that loading would happen
      console.log('Loading persisted research states');
    } catch (error) {
      console.error('Failed to load persisted states:', error);
    }
  }
}
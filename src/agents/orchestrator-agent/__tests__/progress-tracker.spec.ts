import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressTracker } from '../progress-tracker.js';
import type { OrchestrationState, ResearchStep, ResearchStepExecution, ResearchStepResult, ProgressUpdate } from '../../shared/interfaces.js';

describe('ProgressTracker', () => {
  let progressTracker: ProgressTracker;

  const createMockOrchestrationState = (steps: Array<Partial<ResearchStep>>): OrchestrationState => ({
    researchId: 'test-research',
    plan: {
      id: 'plan1',
      topic: 'Test topic',
      objectives: [],
      methodology: {
        approach: 'systematic' as const,
        justification: 'Test',
        phases: [],
        qualityControls: [],
      },
      dataSources: [],
      executionSteps: steps as ResearchStep[],
      riskAssessment: [],
      contingencyPlans: [],
      qualityThresholds: [],
      estimatedTimeline: '',
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    currentPhase: 'execution',
    activeSteps: [],
    completedSteps: [],
    issues: [],
    progress: {
      completedSteps: 0,
      totalSteps: steps.length,
      estimatedTimeRemaining: 10,
      overallConfidence: 0.8,
    },
    startedAt: new Date(),
    lastUpdated: new Date(),
  });

  beforeEach(() => {
    progressTracker = new ProgressTracker();
  });

  it('should initialize progress tracking', () => {
    const state = createMockOrchestrationState([{ id: 'step1', estimatedDuration: 10 }]);
    progressTracker.initializeProgressTracking(state);
    const history = progressTracker.getProgressHistory('test-research');
    expect(history).toHaveLength(1);
    expect(history[0]?.message).toContain('Research initialized');
  });

  it('should record step start', () => {
    const state = createMockOrchestrationState([{ id: 'test-research-step1', estimatedDuration: 10 }]);
    progressTracker.initializeProgressTracking(state);
    const execution: ResearchStepExecution = { stepId: 'test-research-step1', agentId: 'test-agent', status: 'running', startedAt: new Date(), retryCount: 0, progressUpdates: [] };
    progressTracker.recordStepStart('test-research-step1', execution);
    const history = progressTracker.getProgressHistory('test-research');
    expect(history.some(h => h.message.includes('Started executing step'))).toBe(true);
  });

  it('should record step completion', () => {
    const state = createMockOrchestrationState([{ id: 'step1', estimatedDuration: 10 }]);
    progressTracker.initializeProgressTracking(state);
    const result: ResearchStepResult = { stepId: 'step1', status: 'success', qualityScore: 0.9, data: {}, sources: [], processingTime: 0, issues: [], metadata: {} };
    progressTracker.recordStepCompletion('step1', result, state);
    const history = progressTracker.getProgressHistory('test-research');
    expect(history.some(h => h.message.includes('Completed step'))).toBe(true);
  });

  it('should record agent progress', () => {
    const state = createMockOrchestrationState([{ id: 'step1', estimatedDuration: 10 }]);
    progressTracker.initializeProgressTracking(state);
    const update: ProgressUpdate = { timestamp: new Date(), message: 'Agent update', currentActivity: 'working' };
    progressTracker.recordAgentProgress('step1', update, state);
    const history = progressTracker.getProgressHistory('test-research');
    expect(history.some(h => h.message.includes('Agent update'))).toBe(true);
  });

  it('should calculate overall progress', () => {
    const state: OrchestrationState = {
      researchId: 'test-research',
      plan: {
        id: 'plan1',
        topic: 'Test topic',
        objectives: [],
        methodology: {
          approach: 'systematic' as const,
          justification: 'Test',
          phases: [],
          qualityControls: [],
        },
        dataSources: [],
        executionSteps: [
          { id: 's1', description: 'Step 1', agentType: 'web-research', dependencies: [], estimatedDuration: 10, successCriteria: 'Done', fallbackStrategies: [], priority: 1 },
          { id: 's2', description: 'Step 2', agentType: 'web-research', dependencies: [], estimatedDuration: 10, successCriteria: 'Done', fallbackStrategies: [], priority: 1 }
        ],
        riskAssessment: [],
        contingencyPlans: [],
        qualityThresholds: [],
        estimatedTimeline: '',
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      currentPhase: 'execution',
      activeSteps: [],
      completedSteps: [{
        stepId: 's1',
        status: 'success',
        data: { findings: [] },
        sources: [],
        qualityScore: 0.8,
        processingTime: 100,
        issues: [],
        metadata: {},
      }],
      issues: [],
      progress: {
        completedSteps: 1,
        totalSteps: 2,
        estimatedTimeRemaining: 10,
        overallConfidence: 0.8,
      },
      startedAt: new Date(),
      lastUpdated: new Date(),
    };
    const progress = progressTracker.calculateOverallProgress(state);
    expect(progress.percentage).toBe(50);
    expect(progress.completedSteps).toBe(1);
    expect(progress.totalSteps).toBe(2);
  });

  it('should generate a progress report', () => {
    const state = createMockOrchestrationState([{ id: 'step1', estimatedDuration: 10 }]);
    state.issues = [];
    progressTracker.initializeProgressTracking(state);
    const report = progressTracker.generateProgressReport('test-research', state);
    expect(report.summary).toContain('complete');
    expect(report.details.totalSteps).toBe(1);
  });

  it('should detect risk of delay', () => {
    const state = createMockOrchestrationState([{ id: 'step1', estimatedDuration: 120 }]);
    progressTracker.initializeProgressTracking(state);
    const deadline = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    const atRisk = progressTracker.isAtRiskOfDelay(state, deadline);
    expect(atRisk).toBe(true);
  });

  it('should cleanup research progress', () => {
    const state = createMockOrchestrationState([{ id: 'test-research-step1', estimatedDuration: 10 }]);
    progressTracker.initializeProgressTracking(state);
    progressTracker.cleanupResearchProgress('test-research');
    const history = progressTracker.getProgressHistory('test-research');
    expect(history).toHaveLength(0);
  });

  it('should get performance metrics', () => {
    const state = createMockOrchestrationState([{ id: 'test-research-step1', estimatedDuration: 10 }]);
    progressTracker.initializeProgressTracking(state);
    const execution: ResearchStepExecution = { stepId: 'test-research-step1', agentId: 'test-agent', status: 'running', startedAt: new Date(), retryCount: 0, progressUpdates: [] };
    progressTracker.recordStepStart('test-research-step1', execution);
    const result: ResearchStepResult = { stepId: 'test-research-step1', status: 'success', qualityScore: 0.9, data: {}, sources: [], processingTime: 0, issues: [], metadata: {} };
    progressTracker.recordStepCompletion('test-research-step1', result, state);
    const metrics = progressTracker.getPerformanceMetrics('test-research');
    expect(metrics.completionRate).toBe(1);
  });

  it('should get current progress', () => {
    const state = createMockOrchestrationState([{ id: 'step1', estimatedDuration: 10 }]);
    progressTracker.initializeProgressTracking(state);
    const progress = progressTracker.getCurrentProgress('test-research', state);
    expect(progress.currentStatus).not.toBeNull();
    expect(progress.overallProgress.percentage).toBe(0);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  ResearchPlan,
  ResearchStepExecution,
  ResearchStepResult,
  OrchestrationIssue,
  ProgressUpdate,
  ResearchStep
} from '../../shared/interfaces.js';
import { OrchestratorStateManager } from '../state-manager.js';

// Mock the logger
vi.mock('../logger.js', () => ({
  log: vi.fn(),
}));

describe('OrchestratorStateManager', () => {
  let stateManager: OrchestratorStateManager;

  // Helper function to create valid ResearchStep
  const createResearchStep = (overrides: Partial<ResearchStep> = {}): ResearchStep => ({
    id: 'step1',
    description: 'Test step',
    agentType: 'web-research' as const,
    dependencies: [],
    estimatedDuration: 10,
    successCriteria: 'Test criteria',
    fallbackStrategies: [],
    priority: 3,
    ...overrides,
  });

  // Helper function to create valid ResearchPlan
  const createResearchPlan = (overrides: Partial<ResearchPlan> = {}): ResearchPlan => ({
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
    executionSteps: [],
    riskAssessment: [],
    contingencyPlans: [],
    qualityThresholds: [],
    estimatedTimeline: '',
    version: '1.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // Helper function to create valid ResearchStepExecution
  const createStepExecution = (overrides: Partial<ResearchStepExecution> = {}): ResearchStepExecution => ({
    stepId: 'step1',
    agentId: 'agent1',
    status: 'running' as const,
    retryCount: 0,
    progressUpdates: [],
    ...overrides,
  });

  // Helper function to create valid ResearchStepResult
  const createStepResult = (overrides: Partial<ResearchStepResult> = {}): ResearchStepResult => ({
    stepId: 'step1',
    status: 'success' as const,
    data: {},
    sources: [],
    processingTime: 1000,
    qualityScore: 0.8,
    issues: [],
    metadata: {},
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new OrchestratorStateManager(false);
  });

  describe('constructor', () => {
    it('initializes with persistence disabled by default', () => {
      const manager = new OrchestratorStateManager();
      expect(manager).toBeInstanceOf(OrchestratorStateManager);
    });

    it('initializes with persistence enabled', () => {
      const manager = new OrchestratorStateManager(true);
      expect(manager).toBeInstanceOf(OrchestratorStateManager);
    });
  });

  describe('initializeResearch', () => {
    it('creates and returns a new orchestration state', () => {
      const plan = createResearchPlan({
        executionSteps: [createResearchStep({ id: 'step1' })],
      });

      const state = stateManager.initializeResearch('research1', plan);

      expect(state).toBeDefined();
      expect(state.researchId).toBe('research1');
      expect(state.plan).toBe(plan);
      expect(state.currentPhase).toBe('planning');
      expect(state.activeSteps).toEqual([]);
      expect(state.completedSteps).toEqual([]);
      expect(state.issues).toEqual([]);
      expect(state.progress.completedSteps).toBe(0);
      expect(state.progress.totalSteps).toBe(1);
    });

    it('calculates estimated time correctly', () => {
      const plan = createResearchPlan({
        executionSteps: [
          createResearchStep({ id: 'step1', estimatedDuration: 5 }),
          createResearchStep({ id: 'step2', estimatedDuration: 10 }),
        ],
      });

      const state = stateManager.initializeResearch('research1', plan);

      expect(state.progress.estimatedTimeRemaining).toBe(15); // 5 + 10
    });
  });

  describe('getResearchState', () => {
    it('returns null for non-existent research', () => {
      const state = stateManager.getResearchState('nonexistent');
      expect(state).toBeNull();
    });

    it('returns the correct state for existing research', () => {
      const plan = createResearchPlan();
      stateManager.initializeResearch('research1', plan);

      const state = stateManager.getResearchState('research1');
      expect(state).toBeDefined();
      expect(state?.researchId).toBe('research1');
    });
  });

  describe('updatePhase', () => {
    it('updates the phase of existing research', () => {
      const plan = createResearchPlan();
      stateManager.initializeResearch('research1', plan);

      stateManager.updatePhase('research1', 'execution');

      const state = stateManager.getResearchState('research1');
      expect(state?.currentPhase).toBe('execution');
      expect(state?.lastUpdated).toBeInstanceOf(Date);
    });

    it('throws error for non-existent research', () => {
      expect(() => stateManager.updatePhase('nonexistent', 'execution')).toThrow(
        'Research state not found: nonexistent'
      );
    });
  });

  describe('addActiveStep', () => {
    it('adds a new active step to existing research', () => {
      const plan = createResearchPlan();
      stateManager.initializeResearch('research1', plan);

      const stepExecution = createStepExecution({ stepId: 'step1' });
      stateManager.addActiveStep('research1', stepExecution);

      const activeSteps = stateManager.getActiveSteps('research1');
      expect(activeSteps).toHaveLength(1);
      expect(activeSteps[0]).toBe(stepExecution);
    });

    it('updates existing active step', () => {
      const plan = createResearchPlan();
      stateManager.initializeResearch('research1', plan);

      const stepExecution1 = createStepExecution({ stepId: 'step1', status: 'pending' });
      const stepExecution2 = createStepExecution({ stepId: 'step1', status: 'running' });

      stateManager.addActiveStep('research1', stepExecution1);
      stateManager.addActiveStep('research1', stepExecution2);

      const activeSteps = stateManager.getActiveSteps('research1');
      expect(activeSteps).toHaveLength(1);
      expect(activeSteps[0]?.status).toBe('running');
    });

    it('throws error for non-existent research', () => {
      const stepExecution = createStepExecution();
      expect(() => stateManager.addActiveStep('nonexistent', stepExecution)).toThrow(
        'Research state not found: nonexistent'
      );
    });
  });

  describe('completeStep', () => {
    it('moves step from active to completed and updates progress', () => {
      const plan = createResearchPlan({
        executionSteps: [createResearchStep({ id: 'step1' })],
      });
      stateManager.initializeResearch('research1', plan);

      const stepExecution = createStepExecution({ stepId: 'step1' });
      stateManager.addActiveStep('research1', stepExecution);

      const result = createStepResult({ stepId: 'step1' });
      stateManager.completeStep('research1', 'step1', result);

      const activeSteps = stateManager.getActiveSteps('research1');
      const completedSteps = stateManager.getCompletedSteps('research1');

      expect(activeSteps).toHaveLength(0);
      expect(completedSteps).toHaveLength(1);
      expect(completedSteps[0]).toBe(result);

      const progress = stateManager.getProgressSummary('research1');
      expect(progress?.completedSteps).toBe(1);
      expect(progress?.totalSteps).toBe(1);
    });

    it('throws error for non-existent research', () => {
      const result = createStepResult();
      expect(() => stateManager.completeStep('nonexistent', 'step1', result)).toThrow(
        'Research state not found: nonexistent'
      );
    });
  });

  describe('addIssue', () => {
    it('adds an issue to existing research', () => {
      const plan = createResearchPlan();
      stateManager.initializeResearch('research1', plan);

      const issue: OrchestrationIssue = {
        id: 'issue1',
        type: 'agent-failure',
        severity: 'medium',
        description: 'Test issue',
        affectedSteps: ['step1'],
        createdAt: new Date(),
      };

      stateManager.addIssue('research1', issue);

      const state = stateManager.getResearchState('research1');
      expect(state?.issues).toHaveLength(1);
      expect(state?.issues[0]).toBe(issue);
    });

    it('throws error for non-existent research', () => {
      const issue: OrchestrationIssue = {
        id: 'issue1',
        type: 'agent-failure',
        severity: 'medium',
        description: 'Test issue',
        affectedSteps: ['step1'],
        createdAt: new Date(),
      };

      expect(() => stateManager.addIssue('nonexistent', issue)).toThrow(
        'Research state not found: nonexistent'
      );
    });
  });

  describe('resolveIssue', () => {
    it('resolves an existing issue', () => {
      const plan = createResearchPlan();
      stateManager.initializeResearch('research1', plan);

      const issue: OrchestrationIssue = {
        id: 'issue1',
        type: 'agent-failure',
        severity: 'medium',
        description: 'Test issue',
        affectedSteps: ['step1'],
        createdAt: new Date(),
      };

      stateManager.addIssue('research1', issue);
      stateManager.resolveIssue('research1', 'issue1', 'Fixed');

      const state = stateManager.getResearchState('research1');
      expect(state?.issues[0]?.resolvedAt).toBeInstanceOf(Date);
      expect(state?.issues[0]?.resolution).toBe('Fixed');
    });

    it('throws error for non-existent research', () => {
      expect(() => stateManager.resolveIssue('nonexistent', 'issue1')).toThrow(
        'Research state not found: nonexistent'
      );
    });
  });

  describe('addProgressUpdate', () => {
    it('adds progress update to active step', () => {
      const plan = createResearchPlan();
      stateManager.initializeResearch('research1', plan);

      const stepExecution = createStepExecution({ stepId: 'step1' });
      stateManager.addActiveStep('research1', stepExecution);

      const update: ProgressUpdate = {
        timestamp: new Date(),
        message: 'Progress update',
        currentActivity: 'Working',
      };

      stateManager.addProgressUpdate('research1', 'step1', update);

      const activeSteps = stateManager.getActiveSteps('research1');
      expect(activeSteps[0]?.progressUpdates).toHaveLength(1);
      expect(activeSteps[0]?.progressUpdates[0]).toBe(update);
    });

    it('throws error for non-existent research', () => {
      const update: ProgressUpdate = {
        timestamp: new Date(),
        message: 'Progress update',
        currentActivity: 'Working',
      };

      expect(() => stateManager.addProgressUpdate('nonexistent', 'step1', update)).toThrow(
        'Research state not found: nonexistent'
      );
    });
  });

  describe('getActiveSteps and getCompletedSteps', () => {
    it('returns empty arrays for non-existent research', () => {
      expect(stateManager.getActiveSteps('nonexistent')).toEqual([]);
      expect(stateManager.getCompletedSteps('nonexistent')).toEqual([]);
    });

    it('returns correct arrays for existing research', () => {
      const plan = createResearchPlan();
      stateManager.initializeResearch('research1', plan);

      const stepExecution = createStepExecution({ stepId: 'step1' });
      stateManager.addActiveStep('research1', stepExecution);

      expect(stateManager.getActiveSteps('research1')).toHaveLength(1);
      expect(stateManager.getCompletedSteps('research1')).toHaveLength(0);
    });
  });

  describe('isResearchComplete', () => {
    it('returns false for non-existent research', () => {
      expect(stateManager.isResearchComplete('nonexistent')).toBe(false);
    });

    it('returns false when research has active steps', () => {
      const plan = createResearchPlan({
        executionSteps: [createResearchStep({ id: 'step1' })],
      });
      stateManager.initializeResearch('research1', plan);

      const stepExecution = createStepExecution({ stepId: 'step1' });
      stateManager.addActiveStep('research1', stepExecution);

      expect(stateManager.isResearchComplete('research1')).toBe(false);
    });

    it('returns true when all steps are completed', () => {
      const plan = createResearchPlan({
        executionSteps: [createResearchStep({ id: 'step1' })],
      });
      stateManager.initializeResearch('research1', plan);

      const result = createStepResult({ stepId: 'step1' });
      stateManager.completeStep('research1', 'step1', result);

      expect(stateManager.isResearchComplete('research1')).toBe(true);
    });
  });

  describe('getProgressSummary', () => {
    it('returns null for non-existent research', () => {
      expect(stateManager.getProgressSummary('nonexistent')).toBeNull();
    });

    it('returns progress summary for existing research', () => {
      const plan = createResearchPlan({
        executionSteps: [createResearchStep({ id: 'step1' })],
      });
      stateManager.initializeResearch('research1', plan);

      const progress = stateManager.getProgressSummary('research1');
      expect(progress).toBeDefined();
      expect(progress?.completedSteps).toBe(0);
      expect(progress?.totalSteps).toBe(1);
    });
  });

  describe('cleanupCompletedResearch', () => {
    it('removes completed research older than specified age', () => {
      const plan = createResearchPlan({
        executionSteps: [createResearchStep({ id: 'step1' })],
      });

      // Create old completed research
      stateManager.initializeResearch('old-research', plan);
      const result = createStepResult({ stepId: 'step1' });
      stateManager.completeStep('old-research', 'step1', result);

      // Manually set lastUpdated to be old
      const state = stateManager.getResearchState('old-research');
      if (state) {
        state.lastUpdated = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      }

      // Create new research
      stateManager.initializeResearch('new-research', plan);

      const cleanedUp = stateManager.cleanupCompletedResearch(24); // 24 hours

      expect(cleanedUp).toContain('old-research');
      expect(stateManager.getResearchState('old-research')).toBeNull();
      expect(stateManager.getResearchState('new-research')).toBeDefined();
    });
  });

  describe('listActiveResearch', () => {
    it('returns empty array when no research exists', () => {
      expect(stateManager.listActiveResearch()).toEqual([]);
    });

    it('returns active research IDs', () => {
      const plan = createResearchPlan({
        executionSteps: [createResearchStep({ id: 'step1' })],
      });

      // Create completed research
      stateManager.initializeResearch('completed-research', plan);
      const result = createStepResult({ stepId: 'step1' });
      stateManager.completeStep('completed-research', 'step1', result);

      // Create active research
      stateManager.initializeResearch('active-research', plan);
      const stepExecution = createStepExecution({ stepId: 'step1' });
      stateManager.addActiveStep('active-research', stepExecution);

      const active = stateManager.listActiveResearch();
      expect(active).toContain('active-research');
      expect(active).not.toContain('completed-research');
    });
  });
});
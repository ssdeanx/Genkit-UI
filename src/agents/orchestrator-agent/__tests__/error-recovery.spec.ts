import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { OrchestrationState, ResearchStepExecution, ResearchStep, ResearchPlan } from '../../shared/interfaces.js';
import type { TaskDelegator } from '../task-delegator.js';
import { ErrorRecovery } from '../error-recovery.js';

// Mock the logger
vi.mock('../../logger.js', () => ({
  log: vi.fn(),
}));

// Mock TaskDelegator
const mockTaskDelegator = {
  getActiveTasks: vi.fn(),
} as unknown as TaskDelegator;

describe('ErrorRecovery', () => {
  let errorRecovery: ErrorRecovery;

  beforeEach(() => {
    vi.clearAllMocks();
    (mockTaskDelegator.getActiveTasks as Mock).mockReturnValue([]);
    errorRecovery = new ErrorRecovery(mockTaskDelegator);
  });

  // Helper function to create valid ResearchStep
  const createResearchStep = (overrides: Partial<ResearchStep>): ResearchStep => ({
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
  const createResearchPlan = (overrides: Partial<ResearchPlan>): ResearchPlan => ({
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

  describe('classifyFailure', () => {
    it('classifies network errors as temporary', () => {
      const error = { code: 'ECONNRESET' };
      expect(errorRecovery['classifyFailure'](error)).toBe('temporary');
    });

    it('classifies timeout errors as temporary', () => {
      const error = { code: 'ETIMEDOUT' };
      expect(errorRecovery['classifyFailure'](error)).toBe('temporary');
    });

    it('classifies rate limit errors by code', () => {
      const error = { code: 429 };
      expect(errorRecovery['classifyFailure'](error)).toBe('rate-limit');
    });

    it('classifies rate limit errors by message', () => {
      const error = { message: 'Rate limit exceeded' };
      expect(errorRecovery['classifyFailure'](error)).toBe('rate-limit');
    });

    it('classifies agent unavailable errors by code', () => {
      const error = { code: 503 };
      expect(errorRecovery['classifyFailure'](error)).toBe('agent-unavailable');
    });

    it('classifies agent unavailable errors by message', () => {
      const error = { message: 'Service unavailable' };
      expect(errorRecovery['classifyFailure'](error)).toBe('agent-unavailable');
    });

    it('classifies data quality errors by message', () => {
      const error = { message: 'Invalid data format' };
      expect(errorRecovery['classifyFailure'](error)).toBe('data-quality');
    });

    it('classifies authentication errors as critical', () => {
      const error = { code: 401 };
      expect(errorRecovery['classifyFailure'](error)).toBe('critical');
    });

    it('classifies authorization errors as critical', () => {
      const error = { code: 403 };
      expect(errorRecovery['classifyFailure'](error)).toBe('critical');
    });

    it('defaults to temporary for unknown errors', () => {
      const error = { message: 'Unknown error' };
      expect(errorRecovery['classifyFailure'](error)).toBe('temporary');
    });
  });

  describe('getMaxRetries', () => {
    it('returns correct retry limits for each failure type', () => {
      expect(errorRecovery['getMaxRetries']('temporary')).toBe(3);
      expect(errorRecovery['getMaxRetries']('rate-limit')).toBe(5);
      expect(errorRecovery['getMaxRetries']('agent-unavailable')).toBe(2);
      expect(errorRecovery['getMaxRetries']('data-quality')).toBe(1);
      expect(errorRecovery['getMaxRetries']('critical')).toBe(0);
      expect(errorRecovery['getMaxRetries']('unknown')).toBe(1);
    });
  });

  describe('handleStepFailure', () => {
    const mockExecution: ResearchStepExecution = {
      stepId: 'step1',
      agentId: 'agent1',
      status: 'failed',
      retryCount: 0,
      progressUpdates: [],
    };

    const mockOrchestrationState: OrchestrationState = {
      researchId: 'research1',
      plan: createResearchPlan({}),
      currentPhase: 'execution',
      activeSteps: [],
      completedSteps: [],
      issues: [],
      progress: {
        completedSteps: 0,
        totalSteps: 1,
        estimatedTimeRemaining: 10,
        overallConfidence: 0.8,
      },
      startedAt: new Date(),
      lastUpdated: new Date(),
    };

    it('handles temporary failures with retry', async () => {
      const error = { code: 'ECONNRESET' };
      vi.useFakeTimers();

      const result = await errorRecovery.handleStepFailure(
        'step1',
        mockExecution,
        error,
        mockOrchestrationState
      );

      expect(result.recoveryAction).toBe('retry');
      expect(result.newExecution?.status).toBe('pending');
      expect(result.newExecution?.retryCount).toBe(1);

      vi.useRealTimers();
    });

    it('handles rate limit failures with longer backoff', async () => {
      const error = { code: 429 };
      vi.useFakeTimers();

      const result = await errorRecovery.handleStepFailure(
        'step1',
        mockExecution,
        error,
        mockOrchestrationState
      );

      expect(result.recoveryAction).toBe('retry');
      expect(result.newExecution?.status).toBe('pending');

      vi.useRealTimers();
    });

    it('handles agent unavailable failures by finding alternatives', async () => {
      const error = { code: 503 };
      const stateWithSteps = {
        ...mockOrchestrationState,
        plan: createResearchPlan({
          executionSteps: [
            createResearchStep({ id: 'step1', agentType: 'web-research' }),
            createResearchStep({ id: 'step2', agentType: 'academic-research' }),
          ],
        }),
      };

      const result = await errorRecovery.handleStepFailure(
        'step1',
        mockExecution,
        error,
        stateWithSteps
      );

      expect(result.recoveryAction).toBe('escalate');
      expect(result.issue).toBeDefined();
      expect(result.issue?.type).toBe('agent-failure');
    });

    it('handles data quality failures', async () => {
      const error = { message: 'Invalid data format' };

      const result = await errorRecovery.handleStepFailure(
        'step1',
        mockExecution,
        error,
        mockOrchestrationState
      );

      expect(result.recoveryAction).toBe('escalate');
      expect(result.issue).toBeDefined();
      expect(result.issue?.type).toBe('data-quality');
    });

    it('handles critical failures with escalation', async () => {
      const error = { code: 401 };

      const result = await errorRecovery.handleStepFailure(
        'step1',
        mockExecution,
        error,
        mockOrchestrationState
      );

      expect(result.recoveryAction).toBe('escalate');
      expect(result.issue).toBeDefined();
      expect(result.issue?.severity).toBe('high');
    });

    it('handles exhausted retries with abort', async () => {
      const error = { code: 'ECONNRESET' };
      const executionWithMaxRetries = { ...mockExecution, retryCount: 3 };

      const result = await errorRecovery.handleStepFailure(
        'step1',
        executionWithMaxRetries,
        error,
        mockOrchestrationState
      );

      expect(result.recoveryAction).toBe('abort');
      expect(result.issue).toBeDefined();
    });
  });

  describe('calculateBackoffDelay', () => {
    it('calculates exponential backoff with maximum limit', () => {
      expect(errorRecovery['calculateBackoffDelay'](0)).toBe(1000);
      expect(errorRecovery['calculateBackoffDelay'](1)).toBe(2000);
      expect(errorRecovery['calculateBackoffDelay'](2)).toBe(4000);
      expect(errorRecovery['calculateBackoffDelay'](10)).toBe(30000); // Max limit
    });
  });

  describe('findAlternativeAgent', () => {
    it('returns alternative agents for failed agents', () => {
      const steps = [
        { agentType: 'academic-research' } as Pick<ResearchStep, 'agentType'>,
        { agentType: 'news-research' } as Pick<ResearchStep, 'agentType'>,
      ];

      expect(errorRecovery['findAlternativeAgent']('web-research', steps)).toBe('academic-research');
      expect(errorRecovery['findAlternativeAgent']('academic-research', steps)).toBe('web-research');
      expect(errorRecovery['findAlternativeAgent']('unknown-agent', steps)).toBeNull();
    });
  });

  describe('canRetryWithDifferentParameters', () => {
    it('identifies steps that can benefit from parameter changes', () => {
      expect(errorRecovery['canRetryWithDifferentParameters']({ description: 'Search for information' })).toBe(true);
      expect(errorRecovery['canRetryWithDifferentParameters']({ description: 'Query the database' })).toBe(true);
      expect(errorRecovery['canRetryWithDifferentParameters']({ description: 'Filter results' })).toBe(true);
      expect(errorRecovery['canRetryWithDifferentParameters']({ description: 'Process data' })).toBe(false);
    });
  });

  describe('findDependentSteps', () => {
    it('finds steps that depend on the given step', () => {
      const orchestrationState: OrchestrationState = {
        researchId: 'research1',
        plan: createResearchPlan({
          executionSteps: [
            createResearchStep({ id: 'step1', dependencies: [] }),
            createResearchStep({ id: 'step2', dependencies: ['step1'] }),
            createResearchStep({ id: 'step3', dependencies: ['step2'] }),
          ],
        }),
        currentPhase: 'execution',
        activeSteps: [],
        completedSteps: [],
        issues: [],
        progress: { completedSteps: 0, totalSteps: 3, estimatedTimeRemaining: 10, overallConfidence: 0.8 },
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      expect(errorRecovery['findDependentSteps']('step1', orchestrationState)).toEqual(['step2']);
      expect(errorRecovery['findDependentSteps']('step2', orchestrationState)).toEqual(['step3']);
      expect(errorRecovery['findDependentSteps']('step3', orchestrationState)).toEqual([]);
    });
  });

  describe('isCriticalPath', () => {
    it('identifies critical path steps', () => {
      const orchestrationState: OrchestrationState = {
        researchId: 'research1',
        plan: createResearchPlan({
          executionSteps: [
            createResearchStep({ id: 'step1', priority: 3, dependencies: [] }),
            createResearchStep({ id: 'step2', priority: 5, dependencies: [] }), // High priority
            createResearchStep({ id: 'step3', priority: 3, dependencies: [] }),
          ],
        }),
        currentPhase: 'execution',
        activeSteps: [],
        completedSteps: [],
        issues: [],
        progress: { completedSteps: 0, totalSteps: 3, estimatedTimeRemaining: 10, overallConfidence: 0.8 },
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      expect(errorRecovery['isCriticalPath']('step1', orchestrationState)).toBe(false);
      expect(errorRecovery['isCriticalPath']('step2', orchestrationState)).toBe(true); // High priority
    });
  });

  describe('getRecoveryStatus', () => {
    it('returns recovery status for a step', () => {
      // Initially no recovery state
      expect(errorRecovery.getRecoveryStatus('step1')).toEqual({
        retryCount: 0,
        backoffDelay: 0,
        inProgress: false,
      });
    });
  });

  describe('cleanupRecoveryState', () => {
    it('cleans up recovery state for completed research', () => {
      // This would need more complex setup to test properly
      // For now, just ensure it doesn't throw
      expect(() => errorRecovery.cleanupRecoveryState('research1')).not.toThrow();
    });
  });

  describe('getRecoveryStats', () => {
    it('returns recovery statistics', () => {
      const stats = errorRecovery.getRecoveryStats();
      expect(stats).toHaveProperty('totalRetries');
      expect(stats).toHaveProperty('activeRecoveries');
      expect(stats).toHaveProperty('successRate');
      expect(typeof stats.totalRetries).toBe('number');
      expect(typeof stats.activeRecoveries).toBe('number');
      expect(typeof stats.successRate).toBe('number');
    });
  });
});
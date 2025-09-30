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

  describe('handleAgentUnavailableFailure - alternative agent success path', () => {
    it('successfully delegates to alternative agent when available', async () => {
      const mockExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'web-research',
        status: 'failed',
        retryCount: 0,
        progressUpdates: [],
      };

      const mockDelegateSteps = vi.fn().mockResolvedValue([
        {
          stepId: 'step1',
          agentId: 'academic-research',
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
          progressUpdates: [],
          result: { data: 'success' },
        },
      ]);

      const delegatorWithMock = {
        getActiveTasks: vi.fn().mockReturnValue([]),
        delegateResearchSteps: mockDelegateSteps,
      } as unknown as TaskDelegator;

      const recovery = new ErrorRecovery(delegatorWithMock);

      const orchestrationState: OrchestrationState = {
        researchId: 'research1',
        plan: createResearchPlan({
          executionSteps: [
            createResearchStep({ id: 'step1', agentType: 'web-research' }),
            createResearchStep({ id: 'step2', agentType: 'academic-research' }),
          ],
        }),
        currentPhase: 'execution',
        activeSteps: [],
        completedSteps: [],
        issues: [],
        progress: { completedSteps: 0, totalSteps: 2, estimatedTimeRemaining: 10, overallConfidence: 0.8 },
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      const result = await recovery['handleAgentUnavailableFailure']('step1', mockExecution, orchestrationState);

      expect(result.recoveryAction).toBe('fallback');
      expect(result.newExecution).toBeDefined();
      expect(result.newExecution?.agentId).toBe('academic-research');
      expect(result.newExecution?.result).toEqual({ data: 'success' });
      expect(mockDelegateSteps).toHaveBeenCalled();
    });

    it('escalates when alternative agent delegation fails', async () => {
      const mockExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'web-research',
        status: 'failed',
        retryCount: 0,
        progressUpdates: [],
      };

      const mockDelegateSteps = vi.fn().mockRejectedValue(new Error('Delegation failed'));

      const delegatorWithMock = {
        getActiveTasks: vi.fn().mockReturnValue([]),
        delegateResearchSteps: mockDelegateSteps,
      } as unknown as TaskDelegator;

      const recovery = new ErrorRecovery(delegatorWithMock);

      const orchestrationState: OrchestrationState = {
        researchId: 'research1',
        plan: createResearchPlan({
          executionSteps: [
            createResearchStep({ id: 'step1', agentType: 'web-research' }),
            createResearchStep({ id: 'step2', agentType: 'academic-research' }),
          ],
        }),
        currentPhase: 'execution',
        activeSteps: [],
        completedSteps: [],
        issues: [],
        progress: { completedSteps: 0, totalSteps: 2, estimatedTimeRemaining: 10, overallConfidence: 0.8 },
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      const result = await recovery['handleAgentUnavailableFailure']('step1', mockExecution, orchestrationState);

      expect(result.recoveryAction).toBe('escalate');
      expect(result.issue).toBeDefined();
      expect(result.issue?.severity).toBe('high');
      expect(result.issue?.description).toContain('both unavailable');
    });
  });

  describe('handleDataQualityFailure - retry with different parameters', () => {
    it('retries with different parameters when step supports it', () => {
      const mockExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'web-research',
        status: 'failed',
        retryCount: 0,
        progressUpdates: [],
      };

      const orchestrationState: OrchestrationState = {
        researchId: 'research1',
        plan: createResearchPlan({
          executionSteps: [createResearchStep({ id: 'step1', description: 'Search for information' })],
        }),
        currentPhase: 'execution',
        activeSteps: [],
        completedSteps: [],
        issues: [],
        progress: { completedSteps: 0, totalSteps: 1, estimatedTimeRemaining: 10, overallConfidence: 0.8 },
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      const result = errorRecovery['handleDataQualityFailure']('step1', mockExecution, orchestrationState);

      expect(result.recoveryAction).toBe('retry');
      expect(result.newExecution?.status).toBe('pending');
      expect(result.newExecution?.retryCount).toBe(1);
    });

    it('escalates when step cannot retry with different parameters', () => {
      const mockExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'web-research',
        status: 'failed',
        retryCount: 0,
        progressUpdates: [],
      };

      const orchestrationState: OrchestrationState = {
        researchId: 'research1',
        plan: createResearchPlan({
          executionSteps: [createResearchStep({ id: 'step1', description: 'Process data' })],
        }),
        currentPhase: 'execution',
        activeSteps: [],
        completedSteps: [],
        issues: [],
        progress: { completedSteps: 0, totalSteps: 1, estimatedTimeRemaining: 10, overallConfidence: 0.8 },
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      const result = errorRecovery['handleDataQualityFailure']('step1', mockExecution, orchestrationState);

      expect(result.recoveryAction).toBe('escalate');
      expect(result.issue).toBeDefined();
      expect(result.issue?.type).toBe('data-quality');
    });
  });

  describe('handleCriticalFailure - with dependent steps', () => {
    it('escalates critical failure with dependent step count', async () => {
      const mockExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'web-research',
        status: 'failed',
        retryCount: 0,
        progressUpdates: [],
      };

      const orchestrationState: OrchestrationState = {
        researchId: 'research1',
        plan: createResearchPlan({
          executionSteps: [
            createResearchStep({ id: 'step1', dependencies: [] }),
            createResearchStep({ id: 'step2', dependencies: ['step1'] }),
            createResearchStep({ id: 'step3', dependencies: ['step1'] }),
            createResearchStep({ id: 'step4', dependencies: ['step1'] }),
          ],
        }),
        currentPhase: 'execution',
        activeSteps: [],
        completedSteps: [],
        issues: [],
        progress: { completedSteps: 0, totalSteps: 4, estimatedTimeRemaining: 10, overallConfidence: 0.8 },
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      const criticalError = new Error('Authentication failed');
      const result = await errorRecovery['handleCriticalFailure']('step1', mockExecution, criticalError, orchestrationState);

      expect(result.recoveryAction).toBe('escalate');
      expect(result.issue).toBeDefined();
      expect(result.issue?.severity).toBe('high');
      expect(result.issue?.description).toContain('Critical failure in step step1');
      expect(result.issue?.description).toContain('Authentication failed');
      expect(result.issue?.affectedSteps).toContain('step2');
      expect(result.issue?.affectedSteps).toContain('step3');
      expect(result.issue?.affectedSteps).toContain('step4');
    });
  });

  describe('handleExhaustedRetries - fallback strategies', () => {
    it('attempts fallback when strategies are available', async () => {
      const mockExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'web-research',
        status: 'failed',
        retryCount: 3,
        progressUpdates: [],
      };

      const orchestrationState: OrchestrationState = {
        researchId: 'research1',
        plan: createResearchPlan({
          executionSteps: [
            createResearchStep({
              id: 'step1',
              fallbackStrategies: ['use-cached-data', 'skip-validation'],
            }),
          ],
        }),
        currentPhase: 'execution',
        activeSteps: [],
        completedSteps: [],
        issues: [],
        progress: { completedSteps: 0, totalSteps: 1, estimatedTimeRemaining: 10, overallConfidence: 0.8 },
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      const result = await errorRecovery['handleExhaustedRetries']('step1', mockExecution, 'temporary', orchestrationState);

      expect(result.recoveryAction).toBe('fallback');
      expect(result.issue).toBeDefined();
      expect(result.issue?.description).toContain('attempting fallback');
      expect(result.issue?.resolution).toContain('use-cached-data');
    });

    it('escalates critical failures even with fallback strategies', async () => {
      const mockExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'web-research',
        status: 'failed',
        retryCount: 3,
        progressUpdates: [],
      };

      const orchestrationState: OrchestrationState = {
        researchId: 'research1',
        plan: createResearchPlan({
          executionSteps: [
            createResearchStep({
              id: 'step1',
              fallbackStrategies: ['use-cached-data'],
            }),
          ],
        }),
        currentPhase: 'execution',
        activeSteps: [],
        completedSteps: [],
        issues: [],
        progress: { completedSteps: 0, totalSteps: 1, estimatedTimeRemaining: 10, overallConfidence: 0.8 },
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      const result = await errorRecovery['handleExhaustedRetries']('step1', mockExecution, 'critical', orchestrationState);

      expect(result.recoveryAction).toBe('escalate');
      expect(result.issue).toBeDefined();
      expect(result.issue?.severity).toBe('high');
      expect(result.issue?.description).toContain('cannot be recovered');
    });

    it('escalates when critical path step fails', async () => {
      const mockExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'web-research',
        status: 'failed',
        retryCount: 3,
        progressUpdates: [],
      };

      const orchestrationState: OrchestrationState = {
        researchId: 'research1',
        plan: createResearchPlan({
          executionSteps: [
            createResearchStep({ id: 'step1', priority: 5, dependencies: [] }),
            createResearchStep({ id: 'step2', dependencies: ['step1'] }),
            createResearchStep({ id: 'step3', dependencies: ['step1'] }),
            createResearchStep({ id: 'step4', dependencies: ['step1'] }),
            createResearchStep({ id: 'step5', dependencies: ['step1'] }),
            createResearchStep({ id: 'step6', dependencies: ['step1'] }),
          ],
        }),
        currentPhase: 'execution',
        activeSteps: [],
        completedSteps: [],
        issues: [],
        progress: { completedSteps: 0, totalSteps: 6, estimatedTimeRemaining: 10, overallConfidence: 0.8 },
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      const result = await errorRecovery['handleExhaustedRetries']('step1', mockExecution, 'temporary', orchestrationState);

      expect(result.recoveryAction).toBe('escalate');
      expect(result.issue).toBeDefined();
      expect(result.issue?.severity).toBe('critical');
      expect(result.issue?.description).toContain('failed permanently');
      expect(result.issue?.resolution).toContain('5 dependent steps');
    });

    it('aborts non-critical steps with no fallback', async () => {
      const mockExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'web-research',
        status: 'failed',
        retryCount: 3,
        progressUpdates: [],
      };

      const orchestrationState: OrchestrationState = {
        researchId: 'research1',
        plan: createResearchPlan({
          executionSteps: [
            createResearchStep({ id: 'step1', priority: 2, fallbackStrategies: [] }),
            createResearchStep({ id: 'step2', dependencies: [] }),
          ],
        }),
        currentPhase: 'execution',
        activeSteps: [],
        completedSteps: [],
        issues: [],
        progress: { completedSteps: 0, totalSteps: 2, estimatedTimeRemaining: 10, overallConfidence: 0.8 },
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      const result = await errorRecovery['handleExhaustedRetries']('step1', mockExecution, 'temporary', orchestrationState);

      expect(result.recoveryAction).toBe('abort');
      expect(result.issue).toBeDefined();
      expect(result.issue?.severity).toBe('low');
      expect(result.issue?.description).toContain('aborted');
    });
  });

  describe('executeRetry', () => {
    it('executes retry and updates state', async () => {
      const mockExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'web-research',
        status: 'failed',
        retryCount: 1,
        progressUpdates: [],
      };

      await errorRecovery['executeRetry']('step1', mockExecution);

      const status = errorRecovery.getRecoveryStatus('step1');
      expect(status.retryCount).toBe(2);
      expect(status.backoffDelay).toBe(0); // Cleared after retry
    });

    it('handles retry errors gracefully', async () => {
      const mockExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'web-research',
        status: 'failed',
        retryCount: 0,
        progressUpdates: [],
      };

      // Should not throw even if retry logic fails
      await expect(errorRecovery['executeRetry']('step1', mockExecution)).resolves.not.toThrow();
    });
  });

  describe('cleanupRecoveryState - with prefixed research IDs', () => {
    it('cleans up only steps matching research ID prefix', () => {
      // Simulate some retry state
      errorRecovery['retryAttempts'].set('research1-step1', 2);
      errorRecovery['retryAttempts'].set('research1-step2', 1);
      errorRecovery['retryAttempts'].set('research2-step1', 3);
      errorRecovery['backoffDelays'].set('research1-step1', 5000);
      errorRecovery['recoveryInProgress'].add('research1-step1');

      errorRecovery.cleanupRecoveryState('research1');

      // research1 steps should be cleaned
      expect(errorRecovery['retryAttempts'].has('research1-step1')).toBe(false);
      expect(errorRecovery['retryAttempts'].has('research1-step2')).toBe(false);
      expect(errorRecovery['backoffDelays'].has('research1-step1')).toBe(false);
      expect(errorRecovery['recoveryInProgress'].has('research1-step1')).toBe(false);

      // research2 steps should remain
      expect(errorRecovery['retryAttempts'].has('research2-step1')).toBe(true);
    });
  });

  describe('findAlternativeAgent - overload prevention', () => {
    it('returns null when all alternatives are overloaded', () => {
      const steps = [
        { agentType: 'academic-research' },
        { agentType: 'academic-research' },
        { agentType: 'academic-research' },
        { agentType: 'news-research' },
        { agentType: 'news-research' },
        { agentType: 'news-research' },
      ] as Array<Pick<ResearchStep, 'agentType'>>;

      // All alternatives have 3 or more usages, should return null
      const result = errorRecovery['findAlternativeAgent']('web-research', steps);
      expect(result).toBeNull();
    });

    it('returns available alternative when one is below overload threshold', () => {
      const steps = [
        { agentType: 'academic-research' },
        { agentType: 'academic-research' },
        { agentType: 'academic-research' },
        { agentType: 'news-research' },
      ] as Array<Pick<ResearchStep, 'agentType'>>;

      // news-research has < 3 usages, should be returned
      const result = errorRecovery['findAlternativeAgent']('web-research', steps);
      expect(result).toBe('news-research');
    });
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrchestratorAgentExecutor } from '../index.js';
import type { OrchestrationState, OrchestrationDecision, ResearchPlan, OrchestrationIssue } from '../../shared/interfaces.js';
import { TaskDelegator } from '../task-delegator.js';
import { A2ACommunicationManager } from '../a2a-communication.js';
import type { ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { v4 as uuidv4 } from 'uuid';
import { ai } from 'genkit';

// Mock dependencies
vi.mock('../task-delegator.js');
vi.mock('../a2a-communication.js');
vi.mock('genkit', () => ({
  ai: {
    prompt: vi.fn(),
  },
}));

const mockTaskDelegator = vi.mocked(new TaskDelegator(new A2ACommunicationManager()) as any);
const mockA2aManager = vi.mocked(new A2ACommunicationManager() as any);
const mockEventBus = { publish: vi.fn() } as unknown as ExecutionEventBus;
const mockRequestContext = {
  userMessage: { messageId: 'msg1', role: 'user', parts: [{ kind: 'text', text: 'Test query' }], contextId: 'ctx1' },
  task: undefined,
} as RequestContext;

describe('OrchestratorAgentExecutor', () => {
  let executor: OrchestratorAgentExecutor;
  let state: OrchestrationState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ai.prompt).mockResolvedValue({ text: JSON.stringify({ orchestrationDecision: { currentPhase: 'execution', nextActions: [{ action: 'delegate' }], activeTasks: [], issues: [], progressMetrics: { completedSteps: 0, totalSteps: 1, estimatedTimeRemaining: 10, overallConfidence: 0.8, qualityScore: 0.8 } } }) });
    mockTaskDelegator.delegateResearchSteps.mockResolvedValue([{ stepId: 'test-step', agentId: 'web-research', status: 'running' }]);
    executor = new OrchestratorAgentExecutor(mockTaskDelegator, mockA2aManager);
    state = {
      researchId: 'test-id',
      plan: {} as ResearchPlan,
      currentPhase: 'planning',
      activeSteps: [],
      completedSteps: [],
      issues: [],
      progress: { completedSteps: 0, totalSteps: 0, estimatedTimeRemaining: 0, overallConfidence: 0.5 },
      startedAt: new Date(),
      lastUpdated: new Date(),
    };
    (executor as any).researchStates.set('test-id', state);
  });

  describe('execute', () => {
    it('should parse decision and delegate actions', async () => {
      await executor.execute(mockRequestContext, mockEventBus);

      expect(mockTaskDelegator.delegateResearchSteps).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ kind: 'status-update', status: { state: 'working' } }));
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ final: true, status: { state: 'completed' } }));
    });

    it('should handle fallback decision on parse error', async () => {
      vi.mocked(ai.prompt).mockResolvedValueOnce({ text: 'Invalid JSON' });

      await executor.execute(mockRequestContext, mockEventBus);

      expect(state.progress.completedSteps).toBe(0); // Fallback sets basic
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ final: true }));
    });

    it('should update state from decision', () => {
      const decision: OrchestrationDecision = {
        researchId: 'test',
        timestamp: new Date().toISOString(),
        currentPhase: 'execution',
        activeTasks: [{ taskId: '1', agentType: 'web-research' as const, status: 'running' }],
        completedTasks: ['2'],
        issues: [{ type: 'timeout' as const, severity: 'high', description: 'Test issue', affectedTasks: [] }],
        progressMetrics: { completedSteps: 1, totalSteps: 2, estimatedTimeRemaining: 5, overallConfidence: 0.9, qualityScore: 0.8 },
        nextActions: [],
      };

      executor['updateResearchState'](state, decision);

      expect(state.currentPhase).toBe('execution');
      expect(state.progress.completedSteps).toBe(1);
      expect(state.issues.length).toBe(1);
      expect(state.issues[0].type).toBe('timeout');
    });

    it('should cancel task and update state', async () => {
      (executor as any).cancelledTasks.add('test-task');
      await executor.execute(mockRequestContext, mockEventBus);

      expect((executor as any).cancelledTasks.has('test-task')).toBe(true);
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ status: { state: 'canceled' } }));
      expect(state.activeSteps.every(s => s.status !== 'running')).toBe(true);
    });

    it('should loop up to max cycles and complete', async () => {
      vi.mocked(ai.prompt).mockResolvedValue({ text: JSON.stringify({ orchestrationDecision: { nextActions: [{ action: 'continue' }], activeTasks: [], issues: [], progressMetrics: { completedSteps: 0, totalSteps: 1, estimatedTimeRemaining: 10, overallConfidence: 0.8, qualityScore: 0.8 } } }) });

      await executor.execute(mockRequestContext, mockEventBus);

      // Expect multiple publishes for cycles
      const publishCalls = mockEventBus.publish.mock.calls.length;
      expect(publishCalls).toBeGreaterThan(3); // Initial + at least one cycle + final
    });
  });

  describe('parseOrchestrationDecision', () => {
    it('should parse valid JSON', () => {
      const text = JSON.stringify({ orchestrationDecision: { currentPhase: 'test' } });
      const result = executor['parseOrchestrationDecision'](text);

      expect(result.currentPhase).toBe('test');
    });

    it('should use fallback on invalid JSON', () => {
      const result = executor['parseOrchestrationDecision']('invalid');

      expect(result.currentPhase).toBe('execution');
      expect(result.nextActions).toHaveLength(1);
    });
  });

  describe('cancelTask', () => {
    it('should mark task as cancelled and publish event', async () => {
      await executor.cancelTask('test-task', mockEventBus);

      expect((executor as any).cancelledTasks.has('test-task')).toBe(true);
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ status: { state: 'canceled' } }));
    });
  });
});

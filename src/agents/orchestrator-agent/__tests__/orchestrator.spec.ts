import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrchestratorAgentExecutor } from '../index.js';
import type { OrchestrationState, OrchestrationDecision, ResearchPlan } from '../../shared/interfaces.js';
import { TaskDelegator } from '../task-delegator.js'; // Ensure TaskDelegator is imported
import { A2ACommunicationManager } from '../a2a-communication.js';
import type { ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
// uuid not used in tests
import { ai } from '../genkit.js';

// Narrow helper to access private internals safely in tests
interface OrchestratorPrivate {
  researchStates: Map<string, OrchestrationState>;
  cancelledTasks: Set<string>;
}

// removed TestPrivate helper (unused) — we'll call the private method via Function and cast the result

// Mock dependencies
vi.mock('../task-delegator.js');
vi.mock('../a2a-communication.js');
vi.mock('genkit', () => ({
  ai: {
    prompt: vi.fn(),
  },
}));

const mockTaskDelegator = vi.mocked(new TaskDelegator(new A2ACommunicationManager()) as unknown as TaskDelegator);
const mockA2aManager = vi.mocked(new A2ACommunicationManager() as unknown as A2ACommunicationManager);
const mockEventBus = { publish: vi.fn() } as unknown as ExecutionEventBus;
const mockRequestContext = {
  taskId: 'task1',
  contextId: 'ctx1',
  // Explicitly cast userMessage to unknown first to satisfy TypeScript's strict type checking
  // when converting to RequestContext, as the original type definition for Message
  // in @a2a-js/sdk might have additional properties like 'kind' that are not
  // explicitly defined in the mock object.
  userMessage: {
    kind: 'message', // Added 'kind' property to match Message interface
    messageId: 'msg1',
    role: 'user',
    parts: [{ kind: 'text', text: 'Test query' }],
    contextId: 'ctx1'
  } as unknown as RequestContext['userMessage'],
  task: undefined as unknown as RequestContext['task'],
} as RequestContext;

describe('OrchestratorAgentExecutor', () => {
  let executor: OrchestratorAgentExecutor;
  let state: OrchestrationState;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock ai.prompt to return an ExecutablePrompt-like object with a generate method
    vi.mocked(ai.prompt).mockReturnValue(({
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          orchestrationDecision: {
            currentPhase: 'execution',
            nextActions: [{ action: 'delegate' }],
            activeTasks: [],
            issues: [],
            progressMetrics: {
              completedSteps: 0,
              totalSteps: 1,
              estimatedTimeRemaining: 10,
              overallConfidence: 0.8,
              qualityScore: 0.8
            }
          }
        })
      })
    } as unknown) as ReturnType<typeof ai.prompt>);
  mockTaskDelegator.delegateResearchSteps.mockResolvedValue([{ stepId: 'test-step', agentId: 'web-research', status: 'running', progressUpdates: [], retryCount: 0 }]);
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
    (executor as unknown as OrchestratorPrivate).researchStates.set('test-id', state);
  });

  describe('execute', () => {
    it('should parse decision and delegate actions', async () => {
      await executor.execute(mockRequestContext, mockEventBus);

      expect(mockTaskDelegator.delegateResearchSteps).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ kind: 'status-update', status: { state: 'working' } }));
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ final: true, status: { state: 'completed' } }));
    });

    it('should handle fallback decision on parse error', async () => {
      // Mock the generate method to return invalid JSON
      vi.mocked(ai.prompt).mockReturnValue(({
        generate: vi.fn().mockResolvedValue({ text: 'Invalid JSON' })
      } as unknown) as ReturnType<typeof ai.prompt>);

      await executor.execute(mockRequestContext, mockEventBus);

      expect(state.progress.completedSteps).toBe(0); // Fallback sets basic
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ final: true }));
    });

    it('should update state from decision', () => {
      const decision: OrchestrationDecision = {
        researchId: 'test',
        timestamp: new Date().toISOString(),
        currentPhase: 'execution',
        activeTasks: [{ taskId: '1', agentType: 'web-research' as const, description: 'Web research task', priority: 1, estimatedDuration: 5 }],
        completedTasks: ['2'],
        issues: [{ type: 'timeout' as const, severity: 'high', description: 'Test issue', affectedTasks: [] }],
        progressMetrics: { completedSteps: 1, totalSteps: 2, estimatedTimeRemaining: 5, overallConfidence: 0.9, qualityScore: 0.8 },
        nextActions: [],
      };

      executor['updateResearchState'](state, decision);

      expect(state.currentPhase).toBe('execution');
      expect(state.progress.completedSteps).toBe(1);
      expect(state.issues.length).toBe(1);
      expect(state.issues[0]!.type).toBe('timeout');
    });

    it('should cancel task and update state', async () => {
      (executor as unknown as OrchestratorPrivate).cancelledTasks.add('test-task');
      await executor.execute(mockRequestContext, mockEventBus);

      expect((executor as unknown as OrchestratorPrivate).cancelledTasks.has('test-task')).toBe(true);
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ status: { state: 'canceled' } }));
      expect(state.activeSteps.every(s => s.status !== 'running')).toBe(true);
    });

    it('should loop up to max cycles and complete', async () => {
      // Mock ai.prompt to return an object with generate that resolves to the continue action
      vi.mocked(ai.prompt).mockReturnValue(({
        generate: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            orchestrationDecision: {
              nextActions: [{ action: 'continue' }],
              activeTasks: [],
              issues: [],
              progressMetrics: {
                completedSteps: 0,
                totalSteps: 1,
                estimatedTimeRemaining: 10,
                overallConfidence: 0.8,
                qualityScore: 0.8
              }
            }
          })
        })
      } as unknown) as ReturnType<typeof ai.prompt>);

      await executor.execute(mockRequestContext, mockEventBus);

      // Expect multiple publishes for cycles
      const publishCalls = vi.mocked(mockEventBus.publish).mock.calls.length;
      expect(publishCalls).toBeGreaterThan(3); // Initial + at least one cycle + final
    });
  });

  describe('parseOrchestrationDecision', () => {
    it('should parse valid JSON', () => {
      const localExecutor = new OrchestratorAgentExecutor(mockTaskDelegator, mockA2aManager);
      const text = JSON.stringify({ orchestrationDecision: { currentPhase: 'test' } });
  const result = ((localExecutor as unknown as Record<string, unknown>)['parseOrchestrationDecision'] as Function).call(localExecutor, text) as OrchestrationDecision;

      expect(result.currentPhase).toBe('test');
    });

    it('should use fallback on invalid JSON', () => {
    const localExecutor2 = new OrchestratorAgentExecutor(mockTaskDelegator, mockA2aManager);
  const result = ((localExecutor2 as unknown as Record<string, unknown>)['parseOrchestrationDecision'] as Function).call(localExecutor2, 'invalid') as OrchestrationDecision;

      expect(result.currentPhase).toBe('execution');
      expect(result.nextActions).toHaveLength(1);
    });
  });

  describe('cancelTask', () => {
    it('should mark task as cancelled and publish event', async () => {
      await executor.cancelTask('test-task', mockEventBus);

    expect((executor as unknown as OrchestratorPrivate).cancelledTasks.has('test-task')).toBe(true);
      expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ status: { state: 'canceled' } }));
    });
  });
});

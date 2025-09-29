import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OrchestrationState, ResearchPlan, ResearchStepExecution } from '../../shared/interfaces.js';
import type { ExecutionEventBus, RequestContext, TaskStore } from '@a2a-js/sdk/server';
import { OrchestratorAgentExecutor } from '../index.js';
import { TaskDelegator } from '../task-delegator.js';
import type { A2ACommunicationManager } from '../a2a-communication.js';

// Mock Genkit binding used by orchestrator: ai.prompt returns a function producing a JSON string
vi.mock('../genkit.js', () => ({
  ai: {
    prompt: vi.fn().mockReturnValue(async () => ({
      text: JSON.stringify({
        orchestrationDecision: {
          currentPhase: 'execution',
          nextActions: [{ action: 'delegate', description: 'delegate' }],
          activeTasks: [],
          issues: [],
          progressMetrics: {
            completedSteps: 0,
            totalSteps: 1,
            estimatedTimeRemaining: 10,
            overallConfidence: 0.8,
            qualityScore: 0.8,
          },
        },
      }),
    })),
  },
}));

const mockA2aManager = {} as unknown as A2ACommunicationManager;
const mockTaskStore = {
  save: vi.fn().mockResolvedValue(undefined),
} as unknown as TaskStore;
const mockEventBus = { publish: vi.fn() } as unknown as ExecutionEventBus;

const mockRequestContext: RequestContext = {
  taskId: 'task1',
  contextId: 'ctx1',
  userMessage: {
    kind: 'message',
    messageId: 'msg1',
    role: 'user',
    parts: [{ kind: 'text', text: 'Test query' }],
    contextId: 'ctx1',
  },
  task: undefined as RequestContext['task'],
} as RequestContext;

describe('OrchestratorAgentExecutor', () => {
  let executor: OrchestratorAgentExecutor;
  let state: OrchestrationState;
  let taskDelegator: TaskDelegator;

  beforeEach(() => {
    vi.clearAllMocks();
    taskDelegator = new TaskDelegator(mockA2aManager);
    vi.spyOn(taskDelegator, 'delegateResearchSteps').mockResolvedValue([
      { stepId: 'test-step', agentId: 'web-research', status: 'running', progressUpdates: [], retryCount: 0 } as ResearchStepExecution,
    ]);
    executor = new OrchestratorAgentExecutor(taskDelegator, mockTaskStore);
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
    interface Privates {
      researchStates: Map<string, OrchestrationState>;
    }
    (executor as unknown as Privates).researchStates.set('test-id', state);
  });

  it('delegates actions and publishes updates', async () => {
    await executor.execute(mockRequestContext, mockEventBus);
    expect(taskDelegator.delegateResearchSteps).toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ kind: 'status-update' }));
  });

  it('cancelTask publishes canceled status', async () => {
    await executor.cancelTask('test-task', mockEventBus);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.objectContaining({ state: 'canceled' }) })
    );
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { PlanningAgentExecutor } from '../index.js';

vi.mock('../genkit.js', () => ({
  ai: {
    prompt: vi.fn((name: string) => {
      if (name === 'planning_agent') {
        return vi.fn().mockResolvedValue({
          text: JSON.stringify({
            researchPlan: { steps: [{ description: 'Step 1' }] },
            metadata: { totalSteps: 1 }
          })
        });
      }
      return vi.fn();
    }),
  },
}));

const mockEventBus = { publish: vi.fn() } as unknown as ExecutionEventBus;

const mockRequestContext: RequestContext = {
  taskId: 'task1',
  contextId: 'ctx1',
  userMessage: {
    kind: 'message',
    messageId: 'msg1',
    role: 'user',
    parts: [{ kind: 'text', text: 'Plan research for this' }],
    contextId: 'ctx1',
  },
  task: undefined,
} as unknown as RequestContext;

describe('PlanningAgentExecutor', () => {
  let executor: PlanningAgentExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new PlanningAgentExecutor();
  });

  it('executes and publishes completion', async () => {
    await executor.execute(mockRequestContext, mockEventBus);
    expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ kind: 'task' }));
    expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ status: expect.objectContaining({ state: 'working' }) }));
    expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ status: expect.objectContaining({ state: 'completed' }) }));
  });

  it('cancelTask publishes canceled status', async () => {
    // Set up the task context map as if a task was executed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (executor as any).taskContexts.set('test-task', 'test-context');
    await executor.cancelTask('test-task', mockEventBus);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.objectContaining({ state: 'canceled' }) })
    );
  });
});
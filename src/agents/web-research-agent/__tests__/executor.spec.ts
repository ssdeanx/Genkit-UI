import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { WebResearchAgentExecutor } from '../index.js';

vi.mock('../genkit.js', () => ({
  ai: {
    prompt: vi.fn().mockReturnValue(async () => ({
      text: JSON.stringify({
        webFindings: [{ topic: 'Test Topic', sources: [{ title: 'Source 1' }] }],
        metadata: { totalSources: 3 }
      })
    })),
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
    parts: [{ kind: 'text', text: 'Research this on the web' }],
    contextId: 'ctx1',
  },
  task: undefined,
} as unknown as RequestContext;

describe('WebResearchAgentExecutor', () => {
  let executor: WebResearchAgentExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new WebResearchAgentExecutor();
  });

  it('executes and publishes completion', async () => {
    await executor.execute(mockRequestContext, mockEventBus);
    expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ kind: 'task' }));
    expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ status: expect.objectContaining({ state: 'working' }) }));
    expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ status: expect.objectContaining({ state: 'completed' }) }));
  });

  it('cancelTask publishes canceled status', async () => {
    await executor.cancelTask('test-task', mockEventBus);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.objectContaining({ state: 'canceled' }) })
    );
  });
});
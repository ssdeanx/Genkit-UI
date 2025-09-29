import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { DataAnalysisAgentExecutor } from '../executor.js';

vi.mock('../genkit.js', () => ({
  ai: {
    prompt: vi.fn().mockReturnValue(async () => ({
      text: JSON.stringify({
        dataAssessment: { sampleSize: 100, dataSources: ['source1'], dataQuality: 'high' },
        statisticalAnalysis: { testsPerformed: [{ name: 't-test' }], statisticalPower: 0.8 },
        quantitativeInsights: { primaryConclusions: ['Conclusion 1'] },
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
    parts: [{ kind: 'text', text: 'Analyze this data' }],
    contextId: 'ctx1',
  },
  task: undefined,
} as unknown as RequestContext;

describe('DataAnalysisAgentExecutor', () => {
  let executor: DataAnalysisAgentExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new DataAnalysisAgentExecutor();
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
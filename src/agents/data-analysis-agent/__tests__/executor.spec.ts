import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import type { Task, TaskStatusUpdateEvent, TextPart } from '@a2a-js/sdk';
import { DataAnalysisAgentExecutor } from '../executor.js';
import { ai } from '../genkit.js';

vi.mock('../genkit.js', () => ({
  ai: {
    prompt: vi.fn(() => vi.fn()),
  },
}));

type A2AEvent = TaskStatusUpdateEvent | Task;

describe('DataAnalysisAgentExecutor', () => {
  let executor: DataAnalysisAgentExecutor;
  let mockEventBus: ExecutionEventBus;
  let mockRequestContext: RequestContext;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new DataAnalysisAgentExecutor();
    
    mockEventBus = {
      publish: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
      finished: vi.fn(),
    };

    mockRequestContext = {
      taskId: 'task1',
      contextId: 'ctx1',
      userMessage: {
        kind: 'message',
        messageId: 'msg1',
        role: 'user',
        parts: [{ kind: 'text', text: 'Analyze this data' }],
        contextId: 'ctx1',
      },
      task: {
        id: 'task1',
        contextId: 'ctx1',
        kind: 'task',
        status: { state: 'submitted' },
        history: [],
        metadata: {},
      },
    };

    // Default mock for successful analysis
    const mockPromptFn = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        dataAssessment: { sampleSize: 100, dataSources: ['source1'], dataQuality: 'high' },
        statisticalAnalysis: { testsPerformed: [{ name: 't-test' }], statisticalPower: 0.8 },
        quantitativeInsights: { primaryConclusions: ['Conclusion 1'] },
      }),
    });
    (ai.prompt as Mock).mockReturnValue(mockPromptFn);
  });

  it('executes and publishes completion', async () => {
    await executor.execute(mockRequestContext, mockEventBus);
    
    // Should publish working status
    const workingCall = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'working'
    );
    expect(workingCall).toBeDefined();

    // Should publish completed status
    const completedCall = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'completed'
    );
    expect(completedCall).toBeDefined();
  });

  it('cancelTask publishes canceled status', async () => {
    await executor.cancelTask('test-task', mockEventBus);
    
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.objectContaining({ state: 'canceled' }) })
    );
  });

  it('handles empty message and history', async () => {
    mockRequestContext.userMessage.parts = [];
    mockRequestContext.task!.history = [];

    await executor.execute(mockRequestContext, mockEventBus);

    const failedCall = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'failed'
    );
    expect(failedCall).toBeDefined();
    
    const failedEvent = failedCall?.[0] as TaskStatusUpdateEvent;
    const messagePart = failedEvent?.status?.message?.parts[0] as TextPart | undefined;
    expect(messagePart?.text).toBe('No input message found to process.');
  });

  it('handles task cancellation during execution', async () => {
    // Cancel task before execution
    await executor.cancelTask(mockRequestContext.task!.id, mockEventBus);
    
    // Verify canceled status was published
    const canceledCall = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'canceled'
    );
    expect(canceledCall).toBeDefined();
    
    const canceledEvent = canceledCall?.[0] as TaskStatusUpdateEvent;
    const messagePart = canceledEvent?.status?.message?.parts[0] as TextPart | undefined;
    expect(messagePart?.text).toBe('Data analysis cancelled.');
  });

  it('handles AI prompt failure', async () => {
    const mockPromptFn = vi.fn().mockRejectedValue(new Error('AI model failure'));
    (ai.prompt as Mock).mockReturnValue(mockPromptFn);

    await executor.execute(mockRequestContext, mockEventBus);

    const failedCall = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'failed'
    );
    expect(failedCall).toBeDefined();
    
    const failedEvent = failedCall?.[0] as TaskStatusUpdateEvent;
    const messagePart = failedEvent?.status?.message?.parts[0] as TextPart | undefined;
    expect(messagePart?.text).toContain('Data analysis failed');
    expect(messagePart?.text).toContain('AI model failure');
  });

  it('handles JSON parsing failure with fallback', async () => {
    // Return invalid JSON to trigger parsing fallback
    const mockPromptFn = vi.fn().mockResolvedValue({
      text: 'This is not valid JSON at all',
    });
    (ai.prompt as Mock).mockReturnValue(mockPromptFn);

    await executor.execute(mockRequestContext, mockEventBus);

    // Should still complete successfully with fallback data
    const completedCall = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'completed'
    );
    expect(completedCall).toBeDefined();

    // Verify fallback data structure is used
    const completedEvent = completedCall?.[0] as TaskStatusUpdateEvent;
    const messagePart = completedEvent?.status?.message?.parts[0] as TextPart | undefined;
    expect(messagePart?.text).toContain('Data analysis completed successfully');
    expect(messagePart?.text).toContain('Statistical power: 0.8'); // From fallback data
  });

  it('handles missing task in request context', async () => {
    const contextWithoutTask: RequestContext = {
      taskId: 'test-task',
      contextId: 'test-context',
      task: undefined as unknown as Task,
      userMessage: {
        kind: 'message',
        messageId: 'user-message-id',
        role: 'user',
        parts: [{ kind: 'text', text: 'Analyze data' }],
        contextId: 'test-context',
      },
    };

    await executor.execute(contextWithoutTask, mockEventBus);

    // Should create initial task and publish it
    const taskCall = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).find(
      (call) => call[0].kind === 'task'
    );
    expect(taskCall).toBeDefined();

    // Should also publish working and completed statuses
    const workingCall = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'working'
    );
    expect(workingCall).toBeDefined();
  });
});
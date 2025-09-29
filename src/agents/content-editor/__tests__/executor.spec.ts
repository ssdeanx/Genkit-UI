import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type {
  ExecutionEventBus,
  RequestContext,
} from '@a2a-js/sdk/server';
import type {
  Task,
  TaskStatusUpdateEvent,
  TextPart,
} from '@a2a-js/sdk';
import { ContentEditorExecutor } from '../executor.js';
import { ai } from '../genkit.js';

vi.mock('../genkit.js', () => ({
  ai: {
    prompt: vi.fn(),
  },
}));

type A2AEvent = TaskStatusUpdateEvent | Task;

describe('ContentEditorAgentExecutor', () => {
  let executor: ContentEditorExecutor;
  let mockEventBus: ExecutionEventBus;
  let mockRequestContext: RequestContext;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new ContentEditorExecutor();
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
        parts: [{ kind: 'text', text: 'Edit this text' }],
        contextId: 'ctx1',
      },
      task: {
        id: 'task1',
        contextId: 'ctx1',
        kind: 'task',
        status: { state: 'submitted', timestamp: new Date().toISOString() },
        history: [],
        metadata: {},
      },
    };
  });

  it('executes and publishes completion with edited content', async () => {
    const editedText = 'This is the edited content.';
    (ai.prompt as Mock).mockReturnValue(async () => ({
      text: editedText,
    }));

    await executor.execute(mockRequestContext, mockEventBus);

    const workingCall = (
      (mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>
    ).find(
      (call) =>
        (call[0] as TaskStatusUpdateEvent).status?.state === 'working'
    );
    expect(workingCall).toBeDefined();

    const completedCall = (
      (mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>
    ).find(
      (call) =>
        (call[0] as TaskStatusUpdateEvent).status?.state === 'completed'
    );
    expect(completedCall).toBeDefined();

    const completedEvent = completedCall?.[0] as TaskStatusUpdateEvent;
    const messagePart = completedEvent?.status?.message?.parts[0] as
      | TextPart
      | undefined;
    expect(messagePart?.text).toBe(editedText);
  });

  it('publishes a failed status if the input message is empty', async () => {
    mockRequestContext.userMessage.parts = [];
    if (mockRequestContext.task) {
      mockRequestContext.task.history = [];
    }

    await executor.execute(mockRequestContext, mockEventBus);

    const failedCall = (
      (mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>
    ).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'failed'
    );
    expect(failedCall).toBeDefined();

    const failedEvent = failedCall?.[0] as TaskStatusUpdateEvent;
    const messagePart = failedEvent?.status?.message?.parts[0] as
      | TextPart
      | undefined;
    expect(messagePart?.text).toBe('No message found to process.');
  });

  it('publishes a failed status if the AI prompt throws an error', async () => {
    const errorMessage = 'AI prompt failed';
    (ai.prompt as Mock).mockImplementation(async () => {
      throw new Error(errorMessage);
    });

    await executor.execute(mockRequestContext, mockEventBus);

    const failedCall = (
      (mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>
    ).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'failed'
    );
    expect(failedCall).toBeDefined();

    const failedEvent = failedCall?.[0] as TaskStatusUpdateEvent;
    const messagePart = failedEvent?.status?.message?.parts[0] as
      | TextPart
      | undefined;
    expect(messagePart?.text).toContain(errorMessage);
  });

  it('cancelTask publishes a canceled status', async () => {
    await executor.cancelTask('test-task', mockEventBus);
    const cancelledCall = (
      (mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>
    ).find(
      (call) =>
        (call[0] as TaskStatusUpdateEvent).status?.state === 'canceled'
    );
    expect(cancelledCall).toBeDefined();
  });
});
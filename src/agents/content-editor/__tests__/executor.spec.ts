import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type {
  ExecutionEventBus,
  RequestContext,
} from '@a2a-js/sdk/server';
import type {
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  TextPart,
} from '@a2a-js/sdk';
import { ContentEditorExecutor } from '../executor.js';
import { ai } from '../genkit.js';

vi.mock('../genkit.js', () => ({
  ai: {
    prompt: vi.fn(),
  },
}));

type A2AEvent = TaskStatusUpdateEvent | Task | TaskArtifactUpdateEvent;

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
    (ai.prompt as Mock).mockReturnValue(vi.fn().mockResolvedValue({
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

    // Check that an artifact was published with the edited content
    const artifactCall = (
      (mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>
    ).find(
      (call) => (call[0] as TaskArtifactUpdateEvent).kind === 'artifact-update'
    );
    expect(artifactCall).toBeDefined();

    const artifactEvent = artifactCall?.[0] as TaskArtifactUpdateEvent;
    expect((artifactEvent.artifact.parts[0] as TextPart).text).toBe(editedText);
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

  it('handles AI prompt failure', async () => {
    const errorMessage = 'AI prompt failed';
    (ai.prompt as Mock).mockReturnValue(vi.fn().mockRejectedValue(new Error(errorMessage)));

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
    expect(messagePart?.text).toContain('An unexpected error occurred during content editing');
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

  it('handles missing task in request context', async () => {
    const contextWithoutTask: RequestContext = {
      taskId: 'test-task',
      contextId: 'test-context',
      task: undefined as unknown as Task,
      userMessage: {
        kind: 'message',
        messageId: 'user-message-id',
        role: 'user',
        parts: [{ kind: 'text', text: 'Edit this text' }],
        contextId: 'test-context',
      },
    };

    await executor.execute(contextWithoutTask, mockEventBus);

    // Should return early without publishing any events
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('handles cancelled task during execution', async () => {
    // Setup prompt mock
    (ai.prompt as Mock).mockReturnValue(vi.fn().mockResolvedValue({
      text: 'Edited content',
    }));

    // Cancel task before execution
    await executor.cancelTask(mockRequestContext.task!.id, mockEventBus);
    vi.clearAllMocks(); // Clear the cancellation event

    // Now try to execute
    await executor.execute(mockRequestContext, mockEventBus);

    // Should publish working status first
    const workingCall = (
      (mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>
    ).find(
      (call) =>
        (call[0] as TaskStatusUpdateEvent).status?.state === 'working'
    );
    expect(workingCall).toBeDefined();

    // Should immediately fail due to cancellation
    const failedCall = (
      (mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>
    ).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'failed'
    );
    expect(failedCall).toBeDefined();
    const failedEvent = failedCall?.[0] as TaskStatusUpdateEvent;
    const messagePart = failedEvent?.status?.message?.parts[0] as TextPart | undefined;
    expect(messagePart?.text).toContain('Task was cancelled');
  });
});
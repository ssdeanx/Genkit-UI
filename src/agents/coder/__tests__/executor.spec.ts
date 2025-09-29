import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { CoderAgentExecutor } from '../executor.js';
import { ai } from '../genkit.js';
import {
  CodeMessageSchema,
} from '../code-format.js';
import type {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from '@a2a-js/sdk/server';
import type {
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
  TextPart,
} from '@a2a-js/sdk';

vi.mock('../genkit.js', () => ({
  ai: {
    generateStream: vi.fn(),
  },
}));

type A2AEvent = TaskArtifactUpdateEvent | TaskStatusUpdateEvent | Task;

describe('CoderAgentExecutor', () => {
  let executor: AgentExecutor;
  let mockRequestContext: RequestContext;
  let mockEventBus: ExecutionEventBus;

  beforeEach(() => {
    executor = new CoderAgentExecutor();
    mockRequestContext = {
      taskId: 'test-task',
      contextId: 'test-context',
      task: {
        id: 'test-task',
        contextId: 'test-context',
        kind: 'task',
        status: { state: 'submitted' },
        history: [],
        metadata: {},
      },
      userMessage: {
        kind: 'message',
        messageId: 'user-message-id',
        role: 'user',
        parts: [{ kind: 'text', text: 'write a function that adds two numbers' }],
      },
    };
    mockEventBus = {
      publish: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
      finished: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('successfully generates code and publishes artifacts', async () => {
    const mockStream = (async function* () {
      yield { text: '```typescript\n' };
      yield { text: 'function add(a: number, b: number): number {\n' };
      yield { text: '  return a + b;\n' };
      yield { text: '}\n' };
      yield { text: '```' };
    })();

    (ai.generateStream as Mock).mockReturnValue({
      stream: mockStream,
      response: () =>
        Promise.resolve({
          candidates: [
            {
              finishReason: 'stop',
              index: 0,
              message: {
                content: [
                  {
                    text: '```typescript\nfunction add(a: number, b: number): number {\n  return a + b;\n}\n```',
                  },
                ],
                role: 'model',
              },
            },
          ],
        }),
    });

    await executor.execute(mockRequestContext, mockEventBus);

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({
          state: 'working',
        }),
      })
    );

    const artifactCalls = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).filter(
      (call) => call[0]?.kind === 'artifact-update'
    );
    expect(artifactCalls.length).toBeGreaterThan(0);
    const artifactCall = artifactCalls[0];
    if (!artifactCall) {
      throw new Error('Artifact call not found');
    }
    const artifactData = (artifactCall[0] as TaskArtifactUpdateEvent).artifact
      .parts[0] as { kind: string; data: unknown };
    const validation = CodeMessageSchema.safeParse(artifactData.data);

    expect(validation.success).toBe(true);

    const completedCall = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).find(
      (call) =>
        (call[0] as TaskStatusUpdateEvent).status?.state === 'completed'
    );
    expect(completedCall).toBeDefined();
  });

  it('handles generation failure and publishes a fallback artifact', async () => {
    const error = new Error('Generation failed');
    (ai.generateStream as Mock).mockRejectedValue(error);

    await executor.execute(mockRequestContext, mockEventBus);

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({
          state: 'working',
        }),
      })
    );

    const artifactCalls = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).filter(
      (call) => call[0]?.kind === 'artifact-update'
    );
    expect(artifactCalls.length).toBeGreaterThan(0);
    const artifactCall = artifactCalls[0];
    if (!artifactCall) {
      throw new Error('Artifact call not found');
    }
    const artifactData = (artifactCall[0] as TaskArtifactUpdateEvent).artifact
      .parts[0] as {
      kind: string;
      data: { files: Array<{ filename: string; content: string }> };
    };
    const artifact = artifactData.data;
    expect(artifact.files[0]?.filename).toBe('error.txt');
    expect(artifact.files[0]?.content).toContain(
      'An unexpected error occurred during code generation.'
    );

    const finalStatusCall = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'failed'
    );
    expect(finalStatusCall).toBeDefined();
    if (finalStatusCall) {
      const event = finalStatusCall[0] as TaskStatusUpdateEvent;
      expect(event.final).toBe(true);
    }
  });

  it('handles task cancellation during generation', async () => {
    const mockStream = (async function* () {
      yield { text: 'some partial code' };
      // Simulate a delay during which cancellation can occur
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield { text: 'more code' };
    })();

    (ai.generateStream as Mock).mockReturnValue({
      stream: mockStream,
      response: () => Promise.resolve({}),
    });

    // Execute and cancel
    const executionPromise = executor.execute(mockRequestContext, mockEventBus);
    await (executor as CoderAgentExecutor).cancelTask(
      mockRequestContext.task!.id,
      mockEventBus
    );
    await executionPromise;

    const failedCall = ((mockEventBus.publish as Mock).mock.calls as Array<[A2AEvent]>).find(
      (call) => (call[0] as TaskStatusUpdateEvent).status?.state === 'failed'
    );
    expect(failedCall).toBeDefined();
    const failedEvent = failedCall?.[0] as TaskStatusUpdateEvent;
    expect(failedEvent?.status?.state).toBe('failed');
    expect(
      (failedEvent?.status?.message?.parts[0] as TextPart | undefined)?.text
    ).toContain('Task was cancelled');
  });
});
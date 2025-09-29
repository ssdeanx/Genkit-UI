import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { CoderAgentExecutor } from '../executor.js';

vi.mock('../genkit.js', () => ({
  ai: {
    generateStream: vi.fn().mockReturnValue({
      stream: (async function* () { yield { output: { files: [{ filename: 'test.js', content: 'console.log("test");', done: true }], postamble: '' } }; })(),
      response: Promise.resolve({ output: { files: [{ filename: 'test.js', content: 'console.log("test");', done: true }], postamble: '' } }),
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
    parts: [{ kind: 'text', text: 'Generate a hello world function' }],
    contextId: 'ctx1',
  },
  task: undefined,
} as unknown as RequestContext;

describe('CoderAgentExecutor', () => {
  let executor: CoderAgentExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new CoderAgentExecutor();
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
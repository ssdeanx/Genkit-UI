import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { A2ACommunicationManager, MessageRouter } from '../a2a-communication.js';
import type { TaskRequest, TaskResponse, AgentType, A2AMessage, ResearchStep } from '../../shared/interfaces.js';

// Helper to create a minimal ResearchStep for TaskRequest.step
const makeStep = (id = 'step-1'): ResearchStep => ({
  id,
  description: 'Do work',
  agentType: 'web-research',
  dependencies: [],
  estimatedDuration: 1,
  successCriteria: 'Done',
  fallbackStrategies: [],
  priority: 1,
});

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  // restore all stubs/mocks after each test
  vi.restoreAllMocks();
});

describe('A2ACommunicationManager', () => {
  it('succeeds sending a task and returns TaskResponse', async () => {
    const manager = new A2ACommunicationManager();

    const taskRequest: TaskRequest = {
      taskId: 't-success',
      type: 'general-web-research',
      parameters: {},
      priority: 1,
      timeout: 1000,
      metadata: {},
      step: makeStep('s1'),
    };

    const fakeResponse: TaskResponse = { taskId: 't-success', status: 'success', processingTime: 10 };

    // Mock fetch to return a valid TaskResponse
    // Use a minimal Response-like object coerced to Response to satisfy TS without `any`.
    const fakeFetchResponse = { ok: true, json: async () => fakeResponse } as unknown as Response;
    globalThis.fetch = vi.fn().mockResolvedValue(fakeFetchResponse) as unknown as typeof globalThis.fetch;

    const resp = await manager.sendTask('web-research' as AgentType, taskRequest);
    expect(resp.taskId).toBe('t-success');

    // After success, pending task should be cleared — check via public API
    const status = await manager.checkTaskStatus('t-success');
    expect(status).toBe('not-found');
  });

  it('throws when agent returns invalid TaskResponse', async () => {
    const manager = new A2ACommunicationManager();

    const taskRequest: TaskRequest = {
      taskId: 't-bad',
      type: 'general-web-research',
      parameters: {},
      priority: 1,
      timeout: 1000,
      metadata: {},
      step: makeStep('s2'),
    };

    // Mock fetch to return an invalid body
    const fakeFetchResponse = { ok: true, json: async () => ({}) } as unknown as Response;
    globalThis.fetch = vi.fn().mockResolvedValue(fakeFetchResponse) as unknown as typeof globalThis.fetch;

    await expect(manager.sendTask('web-research' as AgentType, taskRequest)).rejects.toThrow('Invalid TaskResponse');

    // Ensure pendingTasks cleaned up on failure
    const status = await manager.checkTaskStatus('t-bad');
    expect(status).toBe('not-found');
  });

  it('throws if endpoint is not configured for agent type', async () => {
    const manager = new A2ACommunicationManager();

    // Break the endpoint configuration intentionally
    manager.updateAgentEndpoint('web-research', '');

    const taskRequest: TaskRequest = {
      taskId: 't-no-endpoint',
      type: 'web-search',
      parameters: {},
      priority: 1,
      timeout: 100,
      metadata: {},
      step: makeStep('no-endpoint'),
    };

    await expect(manager.sendTask('web-research', taskRequest)).rejects.toThrow('No endpoint configured');
  });

  it('throws when fetch responds non-ok and cleans pending', async () => {
    const manager = new A2ACommunicationManager();

    const taskRequest: TaskRequest = {
      taskId: 't-bad-status',
      type: 'web-search',
      parameters: {},
      priority: 1,
      timeout: 100,
      metadata: {},
      step: makeStep('bad-status'),
    };

    const fakeFetchResponse = { ok: false, status: 500, statusText: 'Internal Server Error' } as unknown as Response;
    globalThis.fetch = vi.fn().mockResolvedValue(fakeFetchResponse) as unknown as typeof globalThis.fetch;

    await expect(manager.sendTask('web-research', taskRequest)).rejects.toThrow('Agent request failed: 500 Internal Server Error');
    expect(await manager.checkTaskStatus('t-bad-status')).toBe('not-found');
  });

  it('marks task as pending before completion and supports cancel', async () => {
    const manager = new A2ACommunicationManager();

    const taskRequest: TaskRequest = {
      taskId: 't-pending',
      type: 'web-search',
      parameters: {},
      priority: 1,
      timeout: 1000,
      metadata: {},
      step: makeStep('pending'),
    };

    // Create a fetch promise we can resolve later to keep it pending
    let resolveFetch: (r: Response) => void;
    const fetchPromise = new Promise<Response>(res => { resolveFetch = res; });
    globalThis.fetch = vi.fn().mockReturnValue(fetchPromise) as unknown as typeof globalThis.fetch;

    const sendPromise = manager.sendTask('web-research', taskRequest);
    // Immediately after starting, task should be tracked as pending
    expect(await manager.checkTaskStatus('t-pending')).toBe('pending');

    // Cancel it and ensure it is removed
    const cancelled = await manager.cancelTask('t-pending');
    expect(cancelled).toBe(true);
    expect(await manager.checkTaskStatus('t-pending')).toBe('not-found');

    // Resolve fetch to let the sendTask promise settle; implementation resolves even after cancel
    resolveFetch!({ ok: true, json: async () => ({ taskId: 't-pending', status: 'success', processingTime: 1 }) } as unknown as Response);
    await expect(sendPromise).resolves.toMatchObject({ taskId: 't-pending', status: 'success' });
    // still not tracked as pending
    expect(await manager.checkTaskStatus('t-pending')).toBe('not-found');
  });

  it('handles timeout path before fetch resolves (using fake timers)', async () => {
    vi.useFakeTimers();
    const manager = new A2ACommunicationManager();

    const taskRequest: TaskRequest = {
      taskId: 't-timeout',
      type: 'web-search',
      parameters: {},
      priority: 1,
      timeout: 5, // very short timeout
      metadata: {},
      step: makeStep('timeout'),
    };

    let resolveFetch: (r: Response) => void;
    const fetchPromise = new Promise<Response>(res => { resolveFetch = res; });
    globalThis.fetch = vi.fn().mockReturnValue(fetchPromise) as unknown as typeof globalThis.fetch;

    const sendPromise = manager.sendTask('web-research', taskRequest);

    // Advance timers to trigger the internal timeout before fetch resolves
    vi.advanceTimersByTime(10);

    // After timeout, status should no longer be pending
    const statusAfterTimeout = await manager.checkTaskStatus('t-timeout');
    expect(statusAfterTimeout).toBe('not-found');

    // Now resolve fetch; sendTask should eventually succeed and return a response
    resolveFetch!({ ok: true, json: async () => ({ taskId: 't-timeout', status: 'success', processingTime: 3 }) } as unknown as Response);

    const resp = await sendPromise;
    expect(resp.taskId).toBe('t-timeout');
    vi.useRealTimers();
  });

  it('sendParallelTasks propagates rejection when any task fails', async () => {
    const manager = new A2ACommunicationManager();

    const t1: TaskRequest = { taskId: 'ok1', type: 'web-search', parameters: {}, priority: 1, timeout: 100, metadata: {}, step: makeStep('ok1') };
    const t2: TaskRequest = { taskId: 'bad2', type: 'web-search', parameters: {}, priority: 1, timeout: 100, metadata: {}, step: makeStep('bad2') };

    const r1: TaskResponse = { taskId: 'ok1', status: 'success', processingTime: 1 };
    const okFetch = { ok: true, json: async () => r1 } as unknown as Response;
    const badFetch = { ok: false, status: 503, statusText: 'Service Unavailable' } as unknown as Response;

    globalThis.fetch = (vi.fn()
      .mockResolvedValueOnce(okFetch)
      .mockResolvedValueOnce(badFetch)) as unknown as typeof globalThis.fetch;

    await expect(manager.sendParallelTasks([
      { agentType: 'web-research', taskRequest: t1 },
      { agentType: 'web-research', taskRequest: t2 },
    ])).rejects.toThrow('Agent request failed: 503 Service Unavailable');
  });

  it('cancelTask returns false when task not found', async () => {
    const manager = new A2ACommunicationManager();
    const result = await manager.cancelTask('does-not-exist');
    expect(result).toBe(false);
  });

  it('exposes and updates agent endpoints', () => {
    const manager = new A2ACommunicationManager();
    const before = manager.getAgentEndpoints();
    expect(before['web-research']).toBeTruthy();
    manager.updateAgentEndpoint('web-research', 'http://example.com');
    const after = manager.getAgentEndpoints();
    expect(after['web-research']).toBe('http://example.com');
  });

  it('sendParallelTasks returns multiple responses', async () => {
    const manager = new A2ACommunicationManager();

    const t1: TaskRequest = { taskId: 'p1', type: 'general-web-research', parameters: {}, priority: 1, timeout: 1000, metadata: {}, step: makeStep('p1') };
    const t2: TaskRequest = { taskId: 'p2', type: 'general-web-research', parameters: {}, priority: 1, timeout: 1000, metadata: {}, step: makeStep('p2') };

    const r1: TaskResponse = { taskId: 'p1', status: 'success', processingTime: 10 };
    const r2: TaskResponse = { taskId: 'p2', status: 'success', processingTime: 20 };

    // Fetch will be called twice, return r1 then r2
    const fakeFetch1 = { ok: true, json: async () => r1 } as unknown as Response;
    const fakeFetch2 = { ok: true, json: async () => r2 } as unknown as Response;
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(fakeFetch1)
      .mockResolvedValueOnce(fakeFetch2) as unknown as typeof globalThis.fetch;

    const responses = await manager.sendParallelTasks([
      { agentType: 'web-research', taskRequest: t1 },
      { agentType: 'web-research', taskRequest: t2 },
    ]);

    expect(responses).toHaveLength(2);
    expect(responses.map(r => r.taskId)).toEqual(['p1', 'p2']);
  });

  it('sendTaskStream falls back to single request and emits synthetic message', async () => {
    // Ensure streaming/client are disabled
    const oldClient = process.env.USE_A2A_CLIENT;
    const oldStreaming = process.env.USE_A2A_STREAMING;
    process.env.USE_A2A_CLIENT = 'false';
    process.env.USE_A2A_STREAMING = 'false';

    const manager = new A2ACommunicationManager();

    const t: TaskRequest = { taskId: 'sf1', type: 'web-search', parameters: {}, priority: 1, timeout: 100, metadata: {}, step: makeStep('sf1') };
    const r: TaskResponse = { taskId: 'sf1', status: 'success', processingTime: 7 };

    // Mock the underlying sendTask to avoid network
    const spy = vi.spyOn(manager, 'sendTask').mockResolvedValue(r);

    const events: any[] = [];
    const { cancel, done } = await manager.sendTaskStream('web-research', t, (e) => events.push(e));
    await done; // fallback completes immediately after single request

    expect(spy).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('message');
    // The message parts should contain the serialized TaskResponse
    const textPart = events[0].parts.find((p: any) => p.kind === 'text');
    expect(textPart).toBeTruthy();
    expect(JSON.parse(textPart.text)).toMatchObject(r);
    // Cancel in fallback path should succeed (noop)
    await expect(cancel()).resolves.toBe(true);

    // restore env
    process.env.USE_A2A_CLIENT = oldClient;
    process.env.USE_A2A_STREAMING = oldStreaming;
  });

  it('sendTask uses A2AClient when enabled', async () => {
    const oldClient = process.env.USE_A2A_CLIENT;
    process.env.USE_A2A_CLIENT = 'true';

    // Capture client instances created by manager
    const mockInstances: any[] = [];
    vi.mock('@a2a-js/sdk/client', () => {
      const sendMessage = vi.fn().mockResolvedValue({ ok: true, via: 'rpc' });
      const cancelTask = vi.fn().mockResolvedValue({});
      const sendMessageStream = vi.fn(async function* () {
        yield { kind: 'message', role: 'agent', messageId: 'm', parts: [], taskId: 'x' };
      });
      const A2AClient = vi.fn().mockImplementation((_url: string) => {
        const inst = { sendMessage, cancelTask, sendMessageStream };
        mockInstances.push(inst);
        return inst;
      });
      return { A2AClient };
    });

    const { A2ACommunicationManager: Manager } = await import('../a2a-communication.js');
    const manager = new Manager();

    const t: TaskRequest = { taskId: 'rpc1', type: 'web-search', parameters: {}, priority: 1, timeout: 100, metadata: {}, step: makeStep('rpc1') };
    const resp = await manager.sendTask('web-research', t);
    expect(resp.taskId).toBe('rpc1');
    expect(resp.status).toBe('success');
    // Ensure client was constructed and sendMessage used
    expect(mockInstances.length).toBeGreaterThan(0);
    expect(mockInstances[0].sendMessage).toHaveBeenCalledTimes(1);

    process.env.USE_A2A_CLIENT = oldClient;
  });

  it('sendTaskStream uses A2AClient streaming when enabled and cancel triggers client.cancelTask', async () => {
    const oldClient = process.env.USE_A2A_CLIENT;
    const oldStreaming = process.env.USE_A2A_STREAMING;
    process.env.USE_A2A_CLIENT = 'true';
    process.env.USE_A2A_STREAMING = 'true';

    // Defer the first stream yield so we can call cancel before completion
    const mockInstances: any[] = [];
    // Initialize as a no-op so it's always callable (avoids TS 'never' error).
    let deferResolve: () => void = () => {};
    vi.mock('@a2a-js/sdk/client', () => {
      const sendMessage = vi.fn().mockResolvedValue({ ok: true, via: 'rpc' });
      const cancelTask = vi.fn().mockResolvedValue({});
      const sendMessageStream = vi.fn(({ message }: any) => {
        const defer = new Promise<void>(res => { deferResolve = () => res(); });
        async function* gen() {
          // wait until test triggers
          await defer;
          yield { kind: 'status-update', taskId: message.taskId, status: { state: 'working' }, final: false };
          yield { kind: 'message', role: 'agent', messageId: 'm', parts: [], taskId: message.taskId };
        }
        const it = gen();
        return it as any;
      });
      const A2AClient = vi.fn().mockImplementation((_url: string) => {
        const inst = { sendMessage, cancelTask, sendMessageStream };
        mockInstances.push(inst);
        return inst;
      });
      return { A2AClient };
    });

    const { A2ACommunicationManager: Manager } = await import('../a2a-communication.js');
    const manager = new Manager();

    const t: TaskRequest = { taskId: 'rpc-stream-1', type: 'web-search', parameters: {}, priority: 1, timeout: 1000, metadata: {}, step: makeStep('rpc-stream-1') };
    const events: any[] = [];
    const { cancel, done } = await manager.sendTaskStream('web-research', t, e => events.push(e));

    // Cancel before allowing stream to emit
    const cancelResult = await cancel();
    expect(cancelResult).toBe(true);
    expect(mockInstances.length).toBeGreaterThan(0);
    expect(mockInstances[0].cancelTask).toHaveBeenCalledWith({ taskId: 'rpc-stream-1' });

    // Now allow the generator to proceed and complete cleanup
    deferResolve();
    await done;

    process.env.USE_A2A_CLIENT = oldClient;
    process.env.USE_A2A_STREAMING = oldStreaming;
  });
});

describe('MessageRouter', () => {
  it('routes task-request to communication manager.sendTask', async () => {
    const fakeManager = { sendTask: vi.fn(async () => ({ taskId: 'mr1', status: 'success', processingTime: 5 })) } as unknown as A2ACommunicationManager;
    const router = new MessageRouter(fakeManager);

    const msg: A2AMessage = {
      id: 'm1',
      from: 'a',
      to: 'orchestrator',
      type: 'task-request',
      payload: { taskId: 'mr1', type: 'web-search', parameters: {}, priority: 1, step: makeStep('mr1') },
      timestamp: new Date(),
    };

    const resp = await router.routeMessage(msg);
    expect((fakeManager.sendTask as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect((resp as TaskResponse).taskId).toBe('mr1');
  });

  it('handles status-update and error messages without throwing', async () => {
    const fakeManager = { cancelTask: vi.fn() } as unknown as A2ACommunicationManager;
    const router = new MessageRouter(fakeManager);

    const statusMsg: A2AMessage = { id: 's1', from: 'agent', to: 'orchestrator', type: 'status-update', payload: { state: 'running' }, timestamp: new Date() };
    const errorMsg: A2AMessage = { id: 'e1', from: 'agent', to: 'orchestrator', type: 'error', payload: { message: 'boom' }, timestamp: new Date() };

    await expect(router.routeMessage(statusMsg)).resolves.toBeUndefined();
    await expect(router.routeMessage(errorMsg)).resolves.toBeUndefined();
  });

  it('throws on unknown message type and on unimplemented task-response', async () => {
    const router = new MessageRouter({} as unknown as A2ACommunicationManager);

    const badType: A2AMessage = { id: 'u1', from: 'x', to: 'y', type: 'unknown' as any, payload: {}, timestamp: new Date() };
    await expect(router.routeMessage(badType)).rejects.toThrow('Unknown message type');

    const unimpl: A2AMessage = { id: 'u2', from: 'x', to: 'y', type: 'task-response', payload: {}, timestamp: new Date() };
    await expect(router.routeMessage(unimpl)).rejects.toThrow('Not implemented yet');
  });

  it('determines agent type from task type in task-request', async () => {
    const captured: Array<AgentType> = [];
    const fakeManager = {
      sendTask: vi.fn(async (agentType: AgentType) => {
        captured.push(agentType);
        return { taskId: 'any', status: 'success', processingTime: 1 } as TaskResponse;
      })
    } as unknown as A2ACommunicationManager;
    const router = new MessageRouter(fakeManager);

    const msgs: Array<{ t: string; expected: AgentType }> = [
      { t: 'web-search', expected: 'web-research' },
      { t: 'academic-scholar', expected: 'academic-research' },
      { t: 'news-current', expected: 'news-research' },
      { t: 'data-analysis', expected: 'data-analysis' },
      { t: 'misc', expected: 'web-research' }, // default
    ];

    for (const [i, { t }] of msgs.entries()) {
      const msg: A2AMessage = { id: `m${i}`, from: 'a', to: 'o', type: 'task-request', payload: { taskId: `id${i}`, type: t, parameters: {}, priority: 1, step: makeStep(`st${i}`) }, timestamp: new Date() };
      await router.routeMessage(msg);
    }

    expect(captured).toEqual(['web-research', 'academic-research', 'news-research', 'data-analysis', 'web-research']);
  });

  it('handles cancel messages and delegates to communication manager.cancelTask', async () => {
    const fakeManager = { cancelTask: vi.fn(async () => true) } as unknown as A2ACommunicationManager;
    const router = new MessageRouter(fakeManager);

    const cancelMsg: A2AMessage = {
      id: 'c1',
      from: 'a',
      to: 'orchestrator',
      type: 'cancel',
      payload: { taskId: 'to-cancel' },
      timestamp: new Date(),
    };

    const result = await router.routeMessage(cancelMsg);
    expect((fakeManager.cancelTask as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('to-cancel');
    expect(result).toBe(true);
  });

  it('rejects cancel messages with invalid payload', async () => {
    const fakeManager = { cancelTask: vi.fn() } as unknown as A2ACommunicationManager;
    const router = new MessageRouter(fakeManager);

    const badCancel: A2AMessage = {
      id: 'c2',
      from: 'a',
      to: 'orchestrator',
      type: 'cancel',
      payload: 'not-an-object',
      timestamp: new Date(),
    };

    const result = await router.routeMessage(badCancel);
    expect(result).toBe(false);
  });
});


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

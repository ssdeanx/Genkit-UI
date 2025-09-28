import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestratorFlow } from '../orchestratorFlow.js';
import { ai } from '../../config.js';

vi.stubGlobal('fetch', vi.fn());

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
      const impl = args[1] as Function;
      return (input: unknown, ctx?: unknown) => impl(input, ctx);
    }),
  };
  return { ai: fakeAi, VECTORSTORE_INDEX: 'Based' };
});

describe('orchestratorFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('delegates to orchestrator agent and returns planId', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ taskId: 't1' }) });
    const res = await orchestratorFlow({ query: 'q' });
    expect(res.planId).toBe('t1');
  });

  it('throws on non-ok response', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, statusText: 'err' });
    await expect(orchestratorFlow({ query: 'q' })).rejects.toThrowError('Failed to delegate to orchestrator agent: 500 err');
  });

  it('throws on invalid TaskResponse shape', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ nope: true }) });
    await expect(orchestratorFlow({ query: 'q' })).rejects.toThrowError('Orchestrator agent returned invalid TaskResponse');
  });
});

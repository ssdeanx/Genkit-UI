import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planningFlow } from '../planningFlow.js';
import { ai } from '../../config.js';

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
      const impl = args[1] as Function;
      return (input: unknown, ctx?: unknown) => impl(input, ctx);
    }),
    prompt: vi.fn(),
  };
  return { ai: fakeAi, VECTORSTORE_INDEX: 'Based' };
});

describe('planningFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a ResearchPlan', async () => {
    const output = {
      title: 'Plan',
      summary: 'Sum',
      steps: [{ id: '1', description: 'step', successCriteria: ['ok'] }],
      risks: ['risk'],
    };
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: JSON.stringify(output), output })) as unknown as ReturnType<typeof ai.prompt>);

    const res = await planningFlow({ query: 'q' });
    expect(res.title).toBe('Plan');
    expect(res.steps.length).toBe(1);
  });

  it('throws Error when planning prompt returns invalid plan', async () => {
    const bad = { nope: true } as unknown;
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: JSON.stringify(bad), output: bad })) as unknown as ReturnType<typeof ai.prompt>);
    await expect(planningFlow({ query: 'q' })).rejects.toThrowError('Planning prompt returned invalid ResearchPlan');
  });
});

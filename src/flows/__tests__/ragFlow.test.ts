import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ragFlow } from '../ragFlow.js';
import { ai } from '../../config.js';

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
      const impl = args[1] as Function;
      return (input: unknown, ctx?: unknown) => impl(input, ctx);
    }),
    retrieve: vi.fn(),
    generate: vi.fn(),
  };
  return { ai: fakeAi, VECTORSTORE_INDEX: 'Based' };
});
vi.mock('@genkit-ai/google-genai', () => ({ googleAI: { model: vi.fn(() => 'model-id') } }));

describe('ragFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns answer with citations', async () => {
  vi.mocked(ai.retrieve).mockResolvedValue([{ text: 'doc1', metadata: { sourceId: 's1', score: 0.9 } }] as unknown as Awaited<ReturnType<typeof ai.retrieve>>);
  vi.mocked(ai.generate).mockResolvedValue({ text: 'Answer' } as unknown as Awaited<ReturnType<typeof ai.generate>>);
  const res = await ragFlow({ query: 'q', k: 2 });
    expect(res.answer).toBe('Answer');
    expect(Array.isArray(res.citations)).toBe(true);
  });
});

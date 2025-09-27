import { describe, it, expect, vi, beforeEach } from 'vitest';
import { academicResearchFlow } from '../academicResearchFlow.js';
import { ai } from '../../config.js';

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
      const impl = args[1] as (input: unknown, ctx?: unknown) => unknown;
      return (input: unknown, ctx?: unknown) => impl(input, ctx ?? { context: undefined });
    }),
    prompt: vi.fn(),
  };
  return { ai: fakeAi, VECTORSTORE_INDEX: 'Based' };
});

describe('academicResearchFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns validated academic research', async () => {
    const output = {
      topic: 'AI',
      findings: [{ claim: 'c', evidence: 'e', confidence: 0.8, sources: [0], category: 'factual' }],
      sources: [
        {
          url: 'https://paper.example',
          title: 'Paper',
          credibilityScore: 0.9,
          type: 'academic',
          accessedAt: new Date().toISOString(),
        },
      ],
      methodology: 'lit-review',
      confidence: 0.8,
      generatedAt: new Date().toISOString(),
      processingTime: 5,
    };
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: JSON.stringify(output), output })) as unknown as ReturnType<typeof ai.prompt>);

    const res = await academicResearchFlow({ query: 'q' });
    expect(res.topic).toBe('AI');
  });
});

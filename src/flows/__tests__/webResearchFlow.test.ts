import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webResearchFlow } from '../webResearchFlow.js';
import { ai } from '../../config.js';

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const impl = args[1] as (input: unknown, ctx?: unknown) => unknown;
  return (input: unknown, ctx?: unknown) => impl(input, ctx ?? { context: undefined });
    }),
    prompt: vi.fn(),
    generate: vi.fn(),
    retrieve: vi.fn(),
    index: vi.fn(),
    run: vi.fn().mockImplementation((_name: string, fn: () => unknown) => fn()),
  };
  return { ai: fakeAi, VECTORSTORE_INDEX: 'Based' };
});

describe('webResearchFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates and returns structured research', async () => {
    const output = {
      topic: 'AI',
      findings: [
        { claim: 'Claim', evidence: 'Evidence', confidence: 0.9, sources: [0], category: 'factual' },
      ],
      sources: [
        {
          url: 'https://example.com',
          title: 'Example',
          credibilityScore: 0.8,
          type: 'web',
          accessedAt: new Date().toISOString(),
        },
      ],
      methodology: 'method',
      confidence: 0.8,
      generatedAt: new Date().toISOString(),
      processingTime: 10,
    };
  vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: JSON.stringify(output), output })) as unknown as ReturnType<typeof ai.prompt>);

    const result = await webResearchFlow({ query: 'test' });
    expect(result.topic).toBe('AI');
    expect(result.findings.length).toBe(1);
  });
});

// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { newsResearchFlow } from '../newsResearchFlow.js';
import { ai } from '../../config.js';

vi.mock('../../config.js', () => {
  const fakeAi = {
    defineFlow: vi.fn((...args: unknown[]) => {
      const impl = args[1] as (i: unknown, c?: unknown) => unknown;
      return (input: unknown, ctx?: unknown) => impl(input, ctx ?? { context: undefined });
    }),
    prompt: vi.fn(),
  };
  return { ai: fakeAi, VECTORSTORE_INDEX: 'Based' };
});

describe('newsResearchFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns validated news research', async () => {
    const output = {
      newsFindings: [
        {
          event: 'Event',
          timeline: [
            {
              date: '2025-01-01',
              headline: 'Headline',
              summary: 'Summary',
              sources: [
                {
                  outlet: 'Outlet',
                  url: 'https://example.com',
                  credibilityScore: 0.8,
                  publicationDate: '2025-01-01',
                },
              ],
            },
          ],
          currentStatus: 'Ongoing',
          impactLevel: 'High',
          stakeholderImpacts: ['Users'],
        },
      ],
      mediaAnalysis: {
        coverageConsensus: 'Consensus',
        dominantNarratives: ['A'],
        underreportedAspects: ['B'],
        mediaBiasObservations: ['C'],
        factCheckingStatus: 'Done',
      },
      contextAndAnalysis: {
        historicalContext: 'History',
        expertReactions: ['Expert'],
        publicReaction: 'Public',
        futureImplications: 'Future',
        relatedStories: ['Story'],
      },
      metadata: {
        totalArticles: 1,
        dateRange: '2025',
        primarySources: 1,
        credibilityAverage: 0.8,
        lastUpdated: '2025-01-01',
        breakingNews: false,
        sourcesSearched: ['A'],
        queryProcessed: 'Q',
      },
    };
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: JSON.stringify(output), output })) as unknown as ReturnType<typeof ai.prompt>);

    const res = await newsResearchFlow({ query: 'topic' });
    expect(res.metadata.totalArticles).toBe(1);
  });
});

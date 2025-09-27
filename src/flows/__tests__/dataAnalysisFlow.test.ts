import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dataAnalysisFlow } from '../dataAnalysisFlow.js';
import type { DataAnalysisInput } from '../../schemas/dataAnalysisSchema.js';
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

describe('dataAnalysisFlow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns validated analysis', async () => {
    const output = {
      dataAssessment: { dataSources: ['s1'], sampleSize: 10, dataQuality: 'good' },
      statisticalAnalysis: {
        methodology: 't-test',
        testsPerformed: [{ testName: 't', results: { statistic: 1, pValue: 0.5 } }],
        keyFindings: ['f1'],
      },
      dataVisualization: { recommendedCharts: [{ type: 'bar' }] },
      quantitativeInsights: { primaryConclusions: ['c1'] },
      metadata: { analysisDate: new Date().toISOString() },
    };
    vi.mocked(ai.prompt).mockReturnValue((async () => ({ text: JSON.stringify(output), output })) as unknown as ReturnType<typeof ai.prompt>);

    const input: Partial<DataAnalysisInput> = { analysisType: 'summary' };
    const res = await dataAnalysisFlow(input as DataAnalysisInput);
    expect(res.statisticalAnalysis.methodology).toBe('t-test');
    expect(res.quantitativeInsights.primaryConclusions.length).toBe(1);
  });
});

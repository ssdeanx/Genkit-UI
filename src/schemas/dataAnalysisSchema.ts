import { z } from 'genkit';

export const StatisticalTestResultSchema = z.object({
  statistic: z.number(),
  pValue: z.number(),
  effectSize: z.number().optional(),
  confidenceInterval: z.tuple([z.number(), z.number()]).optional(),
  interpretation: z.string().optional(),
});

export const StatisticalTestSchema = z.object({
  testName: z.string(),
  variables: z.array(z.string()).optional(),
  results: StatisticalTestResultSchema,
});

export const DataAnalysisInputSchema = z.object({
  analysisType: z.string().optional(),
  dataCharacteristics: z.string().optional(),
  now: z.string().datetime().optional(),
});

export const DataAnalysisOutputSchema = z.object({
  dataAssessment: z.object({
    dataSources: z.array(z.string()),
    sampleSize: z.number().int().nonnegative(),
    dataQuality: z.string(),
    variables: z.array(z.string()).optional(),
    missingData: z.union([z.string(), z.number()]).optional(),
  }),
  statisticalAnalysis: z.object({
    methodology: z.string(),
    testsPerformed: z.array(StatisticalTestSchema),
    keyFindings: z.array(z.string()),
    statisticalPower: z.number().min(0).max(1).optional(),
  }),
  dataVisualization: z.object({
    recommendedCharts: z.array(
      z.object({
        type: z.string(),
        variables: z.array(z.string()).optional(),
        insights: z.string().optional(),
        dataRange: z.string().optional(),
      })
    ).optional(),
    visualizationPrinciples: z.array(z.string()).optional(),
  }).optional(),
  quantitativeInsights: z.object({
    primaryConclusions: z.array(z.string()),
    effectMagnitudes: z.array(z.string()).optional(),
    practicalSignificance: z.array(z.string()).optional(),
    limitations: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
  }),
  methodologicalNotes: z.object({
    assumptionsTested: z.array(z.string()).optional(),
    robustnessChecks: z.array(z.string()).optional(),
    alternativeAnalyses: z.array(z.string()).optional(),
    dataTransparency: z.string().optional(),
  }).optional(),
  metadata: z.object({
    analysisDate: z.string().datetime(),
    softwareTools: z.array(z.string()).optional(),
    statisticalMethods: z.array(z.string()).optional(),
    confidenceLevel: z.number().min(0).max(1).optional(),
    reproducibilityScore: z.number().min(0).max(1).optional(),
    dataLastUpdated: z.string().optional(),
  }),
});

export type DataAnalysisInput = z.infer<typeof DataAnalysisInputSchema>;
export type DataAnalysisOutput = z.infer<typeof DataAnalysisOutputSchema>;

import { z } from 'genkit';

export const CredibilityLevelEnum = z.enum(['high', 'medium', 'low']);

export const CredibilityScoreSchema = z.object({
  score: z.number().min(0).max(1),
  level: CredibilityLevelEnum,
  factors: z.array(z.string()),
});

export const NewsArticleSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  source: z.string(),
  snippet: z.string(),
  published: z.string(),
  thumbnail: z.string().url().optional(),
  credibility: CredibilityScoreSchema,
  sourceType: z.enum(['google_news', 'newsapi']).optional(),
});

export const NewsResearchInputSchema = z.object({
  query: z.string(),
  newsScope: z.string().optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high']).optional(),
  now: z.string().datetime().optional(),
});

export const NewsResearchOutputSchema = z.object({
  newsFindings: z.array(
    z.object({
      event: z.string(),
      timeline: z.array(
        z.object({
          date: z.string(),
          headline: z.string(),
          summary: z.string(),
          sources: z.array(
            z.object({
              outlet: z.string(),
              url: z.string().url(),
              credibilityScore: z.number().min(0).max(1),
              publicationDate: z.string(),
              biasAssessment: z.string().optional(),
              keyQuotes: z.array(z.string()).optional(),
            })
          ),
        })
      ),
      currentStatus: z.string(),
      impactLevel: z.string(),
      stakeholderImpacts: z.array(z.string()),
    })
  ),
  mediaAnalysis: z.object({
    coverageConsensus: z.string(),
    dominantNarratives: z.array(z.string()),
    underreportedAspects: z.array(z.string()),
    mediaBiasObservations: z.array(z.string()),
    factCheckingStatus: z.string(),
  }),
  contextAndAnalysis: z.object({
    historicalContext: z.string(),
    expertReactions: z.array(z.string()),
    publicReaction: z.string(),
    futureImplications: z.string(),
    relatedStories: z.array(z.string()),
  }),
  metadata: z.object({
    totalArticles: z.number().int().nonnegative(),
    dateRange: z.string(),
    primarySources: z.number().int().nonnegative(),
    credibilityAverage: z.number().min(0).max(1),
    lastUpdated: z.string(),
    breakingNews: z.boolean(),
    sourcesSearched: z.array(z.string()),
    queryProcessed: z.string(),
  }),
});

export type NewsResearchInput = z.infer<typeof NewsResearchInputSchema>;
export type NewsResearchOutput = z.infer<typeof NewsResearchOutputSchema>;

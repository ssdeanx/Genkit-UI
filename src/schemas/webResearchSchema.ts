import { z } from 'genkit';

// Shared sub-schemas matching src/agents/shared/interfaces.ts
export const SourceTypeEnum = z.enum(['academic', 'news', 'web', 'government', 'expert']);

export const SourceCitationSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  author: z.string().optional(),
  publicationDate: z.string().datetime().optional(),
  credibilityScore: z.number().min(0).max(1),
  type: SourceTypeEnum,
  accessedAt: z.string().datetime(),
});

export const ResearchFindingSchema = z.object({
  claim: z.string(),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.number().int().nonnegative()),
  category: z.enum(['factual', 'analytical', 'speculative']),
});

export const WebResearchInputSchema = z.object({
  query: z.string(),
  researchScope: z.string().optional(),
  credibilityThreshold: z.number().min(0).max(1).optional(),
  now: z.string().datetime().optional(),
});

export const WebResearchOutputSchema = z.object({
  topic: z.string(),
  findings: z.array(ResearchFindingSchema),
  sources: z.array(SourceCitationSchema),
  methodology: z.string(),
  confidence: z.number().min(0).max(1),
  generatedAt: z.string().datetime(),
  processingTime: z.number().int().nonnegative(),
});

export type WebResearchInput = z.infer<typeof WebResearchInputSchema>;
export type WebResearchOutput = z.infer<typeof WebResearchOutputSchema>;

import { z } from 'genkit';

export const AcademicSourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  authors: z.array(z.string()).optional(),
  journal: z.string().optional(),
  year: z.number().int().optional(),
  doi: z.string().optional(),
  credibilityScore: z.number().min(0).max(1).optional(),
});

export const AcademicFindingSchema = z.object({
  claim: z.string(),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.number().int().nonnegative()),
  category: z.enum(['factual', 'analytical', 'speculative']).optional(),
});

export const AcademicResearchInputSchema = z.object({
  query: z.string(),
  researchDomain: z.string().optional(),
  methodologicalFocus: z.string().optional(),
  now: z.string().datetime().optional(),
});

export const AcademicResearchOutputSchema = z.object({
  topic: z.string(),
  findings: z.array(AcademicFindingSchema),
  sources: z.array(AcademicSourceSchema),
  methodology: z.string(),
  confidence: z.number().min(0).max(1),
  generatedAt: z.string().datetime(),
  processingTime: z.number().int().nonnegative(),
});

export type AcademicResearchInput = z.infer<typeof AcademicResearchInputSchema>;
export type AcademicResearchOutput = z.infer<typeof AcademicResearchOutputSchema>;

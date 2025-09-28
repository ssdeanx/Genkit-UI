import { z } from 'genkit';

export const ContentEditorInputSchema = z.object({
  content: z.string(),
  tone: z.enum(['formal', 'casual', 'neutral']).optional(),
});

export const ContentEditorOutputSchema = z.object({
  edited: z.string(),
});

export type ContentEditorInput = z.infer<typeof ContentEditorInputSchema>;
export type ContentEditorOutput = z.infer<typeof ContentEditorOutputSchema>;

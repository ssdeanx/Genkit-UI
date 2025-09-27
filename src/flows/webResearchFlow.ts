import type { z } from 'zod';
import type { Flow } from '@genkit-ai/core';
import { ai } from '../config.js';
import { UserFacingError } from '../errors/UserFacingError.js';
import { WebResearchInputSchema, WebResearchOutputSchema } from '../schemas/index.js';

export const webResearchFlow: Flow<typeof WebResearchInputSchema, typeof WebResearchOutputSchema> = ai.defineFlow(
  {
    name: 'webResearchFlow',
    inputSchema: WebResearchInputSchema,
    outputSchema: WebResearchOutputSchema,
  },
  async (input: z.infer<typeof WebResearchInputSchema>) => {
    const webPrompt = ai.prompt('web_research');
    const result = await webPrompt(input);
    const parsed = WebResearchOutputSchema.safeParse(result.output);
    if (!parsed.success) {
      throw new UserFacingError('Schema validation failed for webResearchFlow output', {
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
);

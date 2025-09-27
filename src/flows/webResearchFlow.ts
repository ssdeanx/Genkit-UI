import type { z } from 'zod';
import { ai } from '../config.js';
import { UserFacingError } from '../errors/UserFacingError.js';
import { WebResearchInputSchema, WebResearchOutputSchema } from '../schemas/webResearchSchema.js';

export const webResearchFlow = ai.defineFlow(
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

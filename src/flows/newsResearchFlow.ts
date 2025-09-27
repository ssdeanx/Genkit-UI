import { ai } from '../config.js';
import { UserFacingError } from '../errors/UserFacingError.js';
import { NewsResearchInputSchema, NewsResearchOutputSchema } from '../schemas/newsResearchSchema.js';

export const newsResearchFlow = ai.defineFlow(
  {
    name: 'newsResearchFlow',
    inputSchema: NewsResearchInputSchema,
    outputSchema: NewsResearchOutputSchema,
  },
  async (input) => {
    const prompt = ai.prompt('news_research');
    const { output } = await prompt(input);
    const parsed = NewsResearchOutputSchema.safeParse(output);
    if (!parsed.success) {
      throw new UserFacingError('Schema validation failed for newsResearchFlow output', {
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
);

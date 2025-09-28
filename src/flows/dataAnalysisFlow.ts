import type { Flow } from '@genkit-ai/core';
import { ai } from '../config.js';
import { UserFacingError } from '../errors/UserFacingError.js';
import { DataAnalysisInputSchema, DataAnalysisOutputSchema } from '../schemas/index.js';

export const dataAnalysisFlow: Flow<typeof DataAnalysisInputSchema, typeof DataAnalysisOutputSchema> = ai.defineFlow(
  {
    name: 'dataAnalysisFlow',
    inputSchema: DataAnalysisInputSchema,
    outputSchema: DataAnalysisOutputSchema,
  },
  async (input) => {
    const prompt = ai.prompt('data_analysis');
    const { output } = await prompt(input);
    const parsed = DataAnalysisOutputSchema.safeParse(output);
    if (!parsed.success) {
      throw new UserFacingError('Schema validation failed for dataAnalysisFlow output', {
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
);

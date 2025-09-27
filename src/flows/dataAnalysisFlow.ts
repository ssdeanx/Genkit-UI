import { ai } from '../config.js';
import { UserFacingError } from '../errors/UserFacingError.js';
import { DataAnalysisInputSchema, DataAnalysisOutputSchema } from '../schemas/dataAnalysisSchema.js';

export const dataAnalysisFlow = ai.defineFlow(
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

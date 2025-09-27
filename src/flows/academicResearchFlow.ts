import { ai } from '../config.js';
import { UserFacingError } from '../errors/UserFacingError.js';
import { AcademicResearchInputSchema, AcademicResearchOutputSchema } from '../schemas/academicResearchSchema.js';

export const academicResearchFlow = ai.defineFlow(
  {
    name: 'academicResearchFlow',
    inputSchema: AcademicResearchInputSchema,
    outputSchema: AcademicResearchOutputSchema,
  },
  async (input) => {
    const prompt = ai.prompt('academic_research');
    const { output } = await prompt(input);
    const parsed = AcademicResearchOutputSchema.safeParse(output);
    if (!parsed.success) {
      throw new UserFacingError('Schema validation failed for academicResearchFlow output', {
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
);

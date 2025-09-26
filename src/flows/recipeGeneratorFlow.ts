import { ai } from '../config.js';
import { RecipeInputSchema, RecipeSchema } from '../schemas/recipeSchema.js';
import type { Flow } from '@genkit-ai/core';

// Define a recipe generator flow
/**
 * Defines a Genkit flow for generating recipes based on user input.
 *
 * @param input - An object containing the main ingredient and optional dietary restrictions.
 * @returns A generated recipe adhering to the RecipeSchema.
 * @throws {Error} If the recipe generation fails.
 */
export const recipeGeneratorFlow: Flow<typeof RecipeInputSchema, typeof RecipeSchema> = ai.defineFlow(
  {
    name: 'recipeGeneratorFlow',
    inputSchema: RecipeInputSchema,
    outputSchema: RecipeSchema,
  },
  async (input) => {
    // Create a prompt based on the input
    const prompt = `Create a recipe with the following requirements:
      Main ingredient: ${input.ingredient}
      Dietary restrictions: ${input.dietaryRestrictions ?? 'none'}`;

    // Generate structured recipe data using the same schema
    const { output } = await ai.generate({
      prompt,
      output: { schema: RecipeSchema },
    });

    if (!output) {
      throw new Error('Failed to generate recipe');
    }

    return output;
  },
);

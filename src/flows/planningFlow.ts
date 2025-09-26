import { ai } from '../config.js';
import { z } from 'genkit';

// Define a Zod schema matching the planning agent prompt output
export const ResearchStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  successCriteria: z.array(z.string()),
});

export const ResearchPlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  steps: z.array(ResearchStepSchema),
  risks: z.array(z.string()),
  notes: z.string().optional(),
});

export const planningFlow = ai.defineFlow(
  {
    name: 'planningFlow',
    inputSchema: z.object({ query: z.string() }),
    outputSchema: ResearchPlanSchema,
  },
  async ({ query }) => {
    const planningPrompt = ai.prompt('planning_agent');
    const { output } = await planningPrompt({ query });

    // Validate with Zod to ensure a safe return value
    const parsed = ResearchPlanSchema.safeParse(output);
    if (!parsed.success) {
      throw new Error('Planning prompt returned invalid ResearchPlan');
    }

    return parsed.data;
  }
);

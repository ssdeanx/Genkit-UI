import { ai } from '../../config.js';
import { z } from 'genkit';

export const askClarifyingQuestion = ai.defineTool(
  {
    name: 'askClarifyingQuestion',
    description: 'Ask a clarifying question to the user with optional choices.',
    inputSchema: z.object({
      question: z.string().describe('The question to present to the user'),
      choices: z.array(z.string()).optional().describe('Optional multiple-choice options'),
      allowWriteIn: z.boolean().optional().describe('Allow free-text answers'),
    }),
    outputSchema: z.object({ answer: z.string() }),
  },
  async (input, { interrupt }) => {
    // Always trigger an interrupt to collect a user-provided answer.
    return interrupt({
      message: input.question,
      metadata: {
        choices: input.choices ?? [],
        allowWriteIn: input.allowWriteIn === true,
      },
    });
  }
);

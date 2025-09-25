import { ai } from '../config.js';
import { z } from 'genkit';

export const weatherTool = ai.defineTool(
  {
    name: 'weatherTool',
    description: 'A tool that returns the weather for a given location',
    inputSchema: z.object({
      location: z.string().describe('The location to get the weather for'),
    }),
    outputSchema: z.string(),
  },
  async ({ location }) => {
    return `The weather in ${location} is 72 degrees and sunny.`;
  }
);

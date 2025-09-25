import { ai } from '../config.js';
import { z } from 'genkit';
import wiki from 'wikipedia';

export const wikipediaTool = ai.defineTool(
  {
    name: 'wikipediaTool',
    description: 'A tool that can find information on Wikipedia. Use this to answer questions about people, places, and concepts.',
    inputSchema: z.object({
      query: z.string().describe('The topic to search for on Wikipedia'),
    }),
    outputSchema: z.string(),
  },
  async ({ query }) => {
    console.log(`Searching Wikipedia for: ${query}`);
    try {
      const summary = await wiki.summary(query);
      if (!summary.extract) {
        return `No summary found for ${query}`;
      }
      return summary.extract;
    } catch (error) {
      console.error('Wikipedia tool error:', error);
      return `Could not find any information on that topic: ${query}`;
    }
  }
);
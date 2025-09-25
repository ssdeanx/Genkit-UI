import { ai } from '../config.js';
import { z } from 'genkit';
import { weatherTool } from '../tools/weatherTool.js';

export const weatherFlow = ai.defineFlow(
  {
    name: 'weatherFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (location) => {
    const weather = await weatherTool({ location });
    return `I looked up the weather in ${location} for you. Here it is: ${weather}`;
  }
);

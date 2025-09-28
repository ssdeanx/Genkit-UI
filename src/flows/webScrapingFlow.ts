import type { Flow } from '@genkit-ai/core';
import { ai } from '../config.js';
import { webScrapingTool } from '../tools/webScrapingTool.js';
import { UserFacingError } from '../errors/UserFacingError.js';
import {
  WebScrapingInputSchema,
  WebScrapingOutputSchema,
} from '../schemas/webScrapingSchema.js';

export const webScrapingFlow: Flow<typeof WebScrapingInputSchema, typeof WebScrapingOutputSchema> = ai.defineFlow(
  {
    name: 'webScrapingFlow',
    inputSchema: WebScrapingInputSchema,
    outputSchema: WebScrapingOutputSchema,
  },
  async (input) => {
    const result = await webScrapingTool(input);
    const parsed = WebScrapingOutputSchema.safeParse(result);
    if (!parsed.success) {
      throw new UserFacingError('Schema validation failed for webScrapingFlow output', {
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
);

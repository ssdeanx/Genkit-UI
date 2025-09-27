import { ai } from '../config.js';
import { z } from 'genkit';

export const coderStreamingFlow = ai.defineFlow(
  {
    name: 'coderStreamingFlow',
    inputSchema: z.object({ specification: z.string(), language: z.string().optional() }),
    // Stream schema: each chunk is a string fragment suitable for display
    streamSchema: z.string(),
    outputSchema: z.object({ filenames: z.array(z.string()) }),
  },
  async ({ specification, language }, { sendChunk }) => {
    const coderPrompt = ai.prompt('coder_multi_file_codegen');

    // Start streaming run of the prompt
    const { stream, response } = await coderPrompt.stream({ specification, language });

    for await (const chunk of stream) {
      // Each chunk may be a string or an object with `text` property.
      let text: string;
      if (typeof chunk === 'string') {
        text = chunk;
      } else {
        const unknownChunk = chunk as unknown;
        if (typeof unknownChunk === 'object' && unknownChunk !== null && 'text' in (unknownChunk as Record<string, unknown>) && typeof (unknownChunk as Record<string, unknown>)['text'] === 'string') {
          text = (unknownChunk as Record<string, unknown>)['text'] as string;
        } else {
          text = String(unknownChunk);
        }
      }

      // Send chunk to clients (Dev UI, A2A streaming, etc.)
      sendChunk(text);
    }

    // Wait for final aggregated response
    const final = await response;

    // Validate output.files with Zod to extract filenames
    const filesSchema = z.array(z.object({ filename: z.string().min(1) })).default([]);
    const parsed = filesSchema.safeParse(final.output?.files);
    const filenames: string[] = parsed.success ? parsed.data.map((f) => f.filename) : [];

    return { filenames };
  }
);

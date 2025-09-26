import { ai } from '../config.js';
import { z } from 'genkit';

export const coderEvalFlow = ai.defineFlow(
  {
    name: 'coderEvalFlow',
    inputSchema: z.object({ specification: z.string(), language: z.string().optional() }),
    outputSchema: z.object({ filenames: z.array(z.string()) }),
  },
  async ({ specification, language }) => {
    const coderPrompt = ai.prompt('coder_multi_file_codegen');
    const { output } = await coderPrompt({ specification, language });

    // validate output.files with Zod instead of using `any`
    const filesSchema = z.array(z.object({ filename: z.string().min(1) })).default([]);
    const parsed = filesSchema.safeParse(output?.files);
    const filenames: string[] = parsed.success ? parsed.data.map((f) => f.filename) : [];

    return { filenames };
  }
);

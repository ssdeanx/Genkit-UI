import { ai } from '../config.js';
import { UserFacingError } from '../errors/UserFacingError.js';
import { ContentEditorInputSchema, ContentEditorOutputSchema } from '../schemas/contentEditorSchema.js';

export const contentEditorFlow = ai.defineFlow(
  {
    name: 'contentEditorFlow',
    inputSchema: ContentEditorInputSchema,
    outputSchema: ContentEditorOutputSchema,
  },
  async (input, { context }) => {
    const prompt = ai.prompt('content_editor');
    const resp = context ? await prompt(input, { context }) : await prompt(input);
    const output = resp?.output;

    if (typeof output === 'string') {
      return { edited: output };
    }

    if (output === null || output === undefined) {
      throw new UserFacingError('Invalid model output for contentEditorFlow', {
        details: { reason: 'No output returned from prompt', input },
      });
    }

    const parsed = ContentEditorOutputSchema.safeParse(output);
    if (!parsed.success) {
      throw new UserFacingError('Schema validation failed for contentEditorFlow output', {
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
);

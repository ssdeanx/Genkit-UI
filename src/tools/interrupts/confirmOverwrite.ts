import { ai } from '../../config.js';
import { z } from 'genkit';

/**
 * Interrupt tool to confirm dangerous file overwrites or destructive actions.
 * - If `resumed` metadata indicates approval, proceed.
 * - Otherwise trigger an interrupt with metadata the caller can use to ask the user.
 */
export const ResumedMetadataSchema = z.object({
  approved: z.boolean().optional(),
  approver: z.string().optional(),
  comments: z.string().optional(),
});

export const confirmOverwriteTool = ai.defineTool(
  {
    name: 'confirmOverwrite',
    description: 'Confirm potentially destructive file overwrites or destructive changes before proceeding.',
    inputSchema: z.object({
      filePath: z.string().describe('The path of the file to be modified'),
      summary: z.string().optional().describe('A short description of the change'),
      risk: z.enum(['low', 'medium', 'high']).default('medium').describe('Estimated risk level for this change'),
    }),
    outputSchema: z.object({ confirmed: z.boolean() }),
  },
  async (input, { interrupt, resumed }) => {
    // If resumed metadata contains explicit approval, honor it and proceed.
    if (resumed !== undefined && resumed !== null) {
      const parsed = ResumedMetadataSchema.safeParse(resumed);
      if (parsed.success && parsed.data.approved === true) {
        return { confirmed: true };
      }
      if (parsed.success && parsed.data.approved === false) {
        return { confirmed: false };
      }
      // if resumed existed but didn't include approved flag, fallthrough to request explicit confirmation
    }

    // Always interrupt to request explicit confirmation for safety.
    interrupt({
      message: `Confirm overwriting file: ${input.filePath}`,
      metadata: {
        filePath: input.filePath,
        summary: input.summary ?? '<no summary provided>',
        risk: input.risk,
      },
    });

    // Execution will pause here; when resumed, the tool will be called again with resumed metadata.
    // Returning a value is unused because interrupt throws control back to the caller.
    return { confirmed: false };
  }
);

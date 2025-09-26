import { ai } from '../../config.js';
import { z } from 'genkit';

export const ActionResumedSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
  approver: z.string().optional(),
  notes: z.string().optional(),
});

export const confirmActionTool = ai.defineTool(
  {
    name: 'confirmAction',
    description: 'Confirm a generic destructive action (e.g., delete, overwrite). Restartable interrupt pattern.',
    inputSchema: z.object({
      actionName: z.string().describe('Name of the action to perform'),
      target: z.string().describe('Target resource of the action'),
      reason: z.string().optional().describe('Why this action is needed'),
      risk: z.enum(['low', 'medium', 'high']).default('medium'),
    }),
    outputSchema: z.object({ status: z.string(), message: z.string().optional() }),
  },
  async (input, { interrupt, resumed }) => {
    // If we've been resumed, check the resumed metadata for approval/rejection.
    if (resumed !== undefined && resumed !== null) {
      const parsed = ActionResumedSchema.safeParse(resumed);
      if (parsed.success && parsed.data.status === 'APPROVED') {
        return { status: 'APPROVED', message: `Action ${input.actionName} approved by ${parsed.data.approver ?? 'unknown'}` };
      }
      if (parsed.success && parsed.data.status === 'REJECTED') {
        return { status: 'REJECTED', message: `Action ${input.actionName} rejected` };
      }
      // If resumed doesn't indicate approval, fallthrough to request explicit approval.
    }

    // Trigger an interrupt to ask for approval.
    interrupt({
      message: `Please confirm action: ${input.actionName} on ${input.target}`,
      metadata: {
        actionName: input.actionName,
        target: input.target,
        reason: input.reason ?? '<no reason provided>',
        risk: input.risk,
      },
    });

    // Execution will pause; return default in case the caller expects a shape.
    return { status: 'PENDING', message: 'Awaiting approval' };
  }
);

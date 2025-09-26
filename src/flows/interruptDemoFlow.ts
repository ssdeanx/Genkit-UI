import { ai } from '../config.js';
import { z } from 'genkit';
import { askClarifyingQuestion, confirmActionTool } from '../tools/interrupts/index.js';

export const interruptDemoFlow = ai.defineFlow(
  {
    name: 'interruptDemoFlow',
    inputSchema: z.object({
      promptTopic: z.string().describe('High-level topic to ask about'),
      requireConfirmation: z.boolean().optional(),
    }),
    outputSchema: z.object({
      finalText: z.string().optional(),
      interrupts: z.array(z.unknown()).optional(),
      status: z.string(),
    }),
  },
  async (input) => {
    // Demonstration flow: attempt to generate a short plan and allow the model
    // to call interrupts (askClarifyingQuestion / confirmAction). If interrupted
    // the flow returns the interrupts metadata so callers (Dev UI) can resume.

    const response = await ai.generate({
      prompt: `Create a short plan for: ${input.promptTopic}. If you need clarification, ask the clarifying question tool. If an irreversible action is suggested, call the confirmAction tool.`,
      tools: [askClarifyingQuestion, confirmActionTool],
    });

    // If an interrupt was called, surface interrupt metadata so the caller can resume.
    if (
      response.finishReason === 'interrupted' ||
      (Array.isArray(response.interrupts) && response.interrupts.length > 0)
    ) {
      return {
        status: 'interrupted',
        interrupts: Array.isArray(response.interrupts) ? response.interrupts : [],
      };
    }

    return {
      status: 'completed',
      finalText: response.text ?? '',
    };
  }
);

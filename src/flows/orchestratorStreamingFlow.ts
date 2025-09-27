import { ai } from '../config.js';
import { z } from 'genkit';

// Minimal schema for orchestration decision summary
export const OrchestrationDecisionSummarySchema = z.object({
  researchId: z.string().optional(),
  timestamp: z.string(),
  currentPhase: z.string(),
  nextActions: z.array(z.object({ action: z.string(), description: z.string().optional(), priority: z.number().optional() })).optional(),
});

export const orchestratorStreamingFlow = ai.defineFlow(
  {
    name: 'orchestratorStreamingFlow',
    inputSchema: z.object({ currentState: z.string().optional(), contextNotes: z.string().optional() }),
    streamSchema: z.string(),
    outputSchema: OrchestrationDecisionSummarySchema,
  },
  async ({ currentState, contextNotes }, { sendChunk }) => {
    const orchestratorPrompt = ai.prompt('orchestrator');
    const { stream, response } = orchestratorPrompt.stream({ currentState, contextNotes });

    for await (const chunk of stream) {
      // Normalize chunk to a string and send
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
      sendChunk(text);
    }

    // Once streaming ends, get final response and try to parse orchestration decision summary
    const final = await response;

    // Attempt to parse JSON from final aggregated text; fallback to summary object if parse fails
    const rawText = final.text ?? JSON.stringify(final.output ?? {});
    try {
      return OrchestrationDecisionSummarySchema.parse(JSON.parse(rawText));
    } catch {
      // Return a fallback summary containing the full text in 'nextActions' as a single description field
      return OrchestrationDecisionSummarySchema.parse({
        researchId: undefined,
        timestamp: new Date().toISOString(),
        currentPhase: 'execution',
        nextActions: [{ action: 'summary', description: String(rawText), priority: 3 }],
      });
    }
  }
);

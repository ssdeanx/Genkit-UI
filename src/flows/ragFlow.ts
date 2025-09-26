import { ai } from '../config.js';
import { z } from 'genkit';
import { devLocalRetrieverRef } from '@genkit-ai/dev-local-vectorstore';
import { VECTORSTORE_INDEX } from '../config.js';
import { googleAI } from '@genkit-ai/google-genai';
import type { Document } from 'genkit/retriever';

const retriever = devLocalRetrieverRef(VECTORSTORE_INDEX);

const RagInputSchema = z.object({ query: z.string(), k: z.number().optional() });

export const ragFlow = ai.defineFlow(
  {
    name: 'ragFlow',
    inputSchema: RagInputSchema,
    outputSchema: z.object({ answer: z.string(), citations: z.array(z.object({ id: z.string().optional(), score: z.number().optional() })).optional() }),
  },
  async (input: z.infer<typeof RagInputSchema>) => {
    const { query, k = 3 } = input;
    const docsRes = await ai.retrieve({ retriever, query, options: { k } });
    const docs = toDocumentArray(docsRes);

    const prompt = `Use the provided context documents to answer the question succinctly. If the answer is not contained in the documents, say "I don't know."\n\nQuestion: ${query}`;

    const { text } = await ai.generate({ model: googleAI.model('gemini-2.5-flash'), prompt, docs });

    const citations = docs.map((d) => {
      const dd = d as unknown as Record<string, unknown>;
      let id: string | undefined = undefined;
      let score: number | undefined = undefined;
      const meta = dd.metadata as Record<string, unknown> | undefined;
      if (meta && typeof meta === 'object') {
        if (typeof meta.sourceId === 'string') {
          id = meta.sourceId;
        }
        if (typeof meta.score === 'number') {
          score = meta.score;
        }
      }
      // Do not fallback to top-level id to avoid nullable-string handling; rely on metadata when present.
      return { id, score };
    });

    return { answer: text, citations };
  }
);

function toDocumentArray(value: unknown): Document[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is Document => typeof v === 'object' && v !== null);
}

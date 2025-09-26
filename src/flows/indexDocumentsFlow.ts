import { ai } from '../config.js';
import { z } from 'genkit';
import { readFile } from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
import { chunk } from 'llm-chunk';
import { Document } from 'genkit/retriever';
import { devLocalIndexerRef } from '@genkit-ai/dev-local-vectorstore';
import { VECTORSTORE_INDEX } from '../config.js';

const chunkingConfig: Record<string, number | string> = {
  minLength: 1000,
  maxLength: 2000,
  splitter: 'sentence',
  overlap: 100,
  delimiters: '',
};

const indexer = devLocalIndexerRef(VECTORSTORE_INDEX);

const IndexInputSchema = z
  .object({
    filePath: z.string().optional(),
    text: z.string().optional(),
    sourceId: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .describe('Ingest text or PDF into the configured vector index');

export const indexDocumentsFlow = ai.defineFlow(
  {
    name: 'indexDocuments',
    inputSchema: IndexInputSchema,
    outputSchema: z.object({ success: z.boolean(), documentsIndexed: z.number(), error: z.string().optional() }),
  },
  async (input: z.infer<typeof IndexInputSchema>) => {
    try {
      const { filePath, text, sourceId, metadata } = input;
      let content = typeof text === 'string' ? text : '';
      if (!content && typeof filePath === 'string' && filePath.trim().length > 0) {
        const resolved = path.resolve(filePath);
        const buffer = await readFile(resolved);
        const data = await pdf(buffer);
        content = typeof (data.text) === 'string' ? data.text : '';
      }

      if (!(typeof content === 'string') || content.trim().length === 0) {
        return { success: false, documentsIndexed: 0, error: 'No text to index' };
      }

      const chunksRes = await ai.run('chunk-it', async () => chunk(content, chunkingConfig));
      const chunks = toStringArray(chunksRes);

      const documents = chunks.map((c, idx) =>
        Document.fromText(c, { sourceId: sourceId ?? `doc-${Date.now()}-${idx}`, metadata: metadata ?? {} })
      );

      await ai.index({ indexer, documents });

      return { success: true, documentsIndexed: documents.length };
    } catch (err) {
      return { success: false, documentsIndexed: 0, error: err instanceof Error ? err.message : String(err) };
    }
  }
);

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [String(value)];
}

import { devLocalVectorstore } from '@genkit-ai/dev-local-vectorstore';
import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

// Initialize Genkit with the Google AI plugin
export const ai = genkit({
  // Ensure Dotprompt prompts in `src/prompts` are discovered at runtime
  promptDir: './src/prompts',
  plugins: [
    googleAI(),
    googleAI({ experimental_debugTraces: true }),
    devLocalVectorstore([
      {
        indexName: process.env.VECTORSTORE_INDEX ?? 'Based',
        embedder: googleAI.embedder('gemini-embedding-001'),
      },
    ]),
  ],
  model: googleAI.model('gemini-2.5-flash', {
    temperature: 0.8,
    maxOutputTokens: 65000,
    topK: 40,
    topP: 0.95,
    stopSequences: ['\n\n'],
    codeExecution: true,
    contextCache: true,
    functionCallingConfig: { mode: 'AUTO' },
    googleSearchRetrieval: true,
    groundedGeneration: true,
    toolConfig: { default: { mode: 'AUTO', allowParallelCalls: true } },
    structuredOutput: { enabled: true },
    stream: true,
    output: { format: 'json' },
    safetySettings: [],

    thinkingConfig: { thinkingBudget: -1, showThoughts: true }, // Enable thinking process for debugging
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
    responseMimeType: 'application/json',
    imageGenerationConfig: { maxImages: 1, imageSize: 'IMAGE_SIZE_512' },
    responseMedia: ['TEXT', 'IMAGE'],
    // This is a comment
    entityExtractionConfig: { enabled: true, modelVersion: 'ENTITY_EXTRACTION_MODEL_VERSION_V1' },
    // Another comment
  }),
});

// Export the configured index name so flows can reference it explicitly
export const VECTORSTORE_INDEX = process.env.VECTORSTORE_INDEX ?? 'Based';

// Context provider notes (see docs/runbook-context.md):
// - Provide `context.auth` with { uid, rawToken } when available
// - Attach `trace.requestId` to correlate traces across agents and flows

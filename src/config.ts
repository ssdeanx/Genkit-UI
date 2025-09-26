import { devLocalVectorstore, devLocalIndexerRef, } from '@genkit-ai/dev-local-vectorstore';
import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

// Initialize Genkit with the Google AI plugin
export const ai = genkit({
  plugins: [
    googleAI(),
    devLocalVectorstore([
      {
        indexName: 'menuQA',
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

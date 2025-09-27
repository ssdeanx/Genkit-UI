/* eslint-disable no-console */

import { startFlowServer } from '@genkit-ai/express';

// Import flows exported from src/index.ts
import {
  recipeGeneratorFlow,
  weatherFlow,
  orchestratorFlow,
  coderEvalFlow,
  planningFlow,
  coderStreamingFlow,
  orchestratorStreamingFlow,
  webResearchFlow,
  newsResearchFlow,
  academicResearchFlow,
  dataAnalysisFlow,
  contentEditorFlow,
} from './index.js';

const PORT = Number(process.env.FLOW_PORT ?? process.env.PORT ?? 3400);

const flows = [
  recipeGeneratorFlow,
  weatherFlow,
  orchestratorFlow,
  coderEvalFlow,
  planningFlow,
  coderStreamingFlow,
  orchestratorStreamingFlow,
  webResearchFlow,
  newsResearchFlow,
  academicResearchFlow,
  dataAnalysisFlow,
  contentEditorFlow,
];

async function main() {
  // Start the Genkit flow server exposing the flows over HTTP
  startFlowServer({
    flows,
    port: PORT,
    cors: { origin: '*' },
  });

  console.log(`[FlowServer] Flow server started on http://localhost:${PORT}`);
  const flowNames = flows
    .map((f) => ((f as unknown as { definition?: { name?: string } }).definition?.name) ?? (f as unknown as { name?: string }).name ?? 'unknown')
    .join(', ');
  console.log(`[FlowServer] Registered flows: ${flowNames}`);
}

main().catch((err) => {
  console.error('[FlowServer] Failed to start flow server:', err);
  process.exit(1);
});

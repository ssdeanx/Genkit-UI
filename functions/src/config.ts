import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import { gemini20FlashExp } from '@genkit-ai/googleai';

// Enable Firebase telemetry for observability in Cloud Functions
enableFirebaseTelemetry();

// Initialize Genkit ai instance for Functions (uses process.env for secrets)
export const ai = genkit({
  plugins: [
    googleAI({
      // API key from Functions secrets/env (set via firebase functions:secrets:set)
      apiKey: process.env.GOOGLE_API_KEY,
    }),
  ],
});

// Default model for flows/agents (Gemini 2.5 Flash for speed/balance)
export const defaultModel = gemini20FlashExp;

// Export for use in flows/tools/agents
export default ai;

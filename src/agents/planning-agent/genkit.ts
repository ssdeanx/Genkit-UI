import { googleAI } from "@genkit-ai/googleai";
import { genkit } from "genkit";
import { dirname } from "path";
import { fileURLToPath } from "url";

export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-flash", {
    temperature: 0.1,
    top_p: 0.5,
    max_tokens: 65000,
    thinkingConfig: {
        thinkingBudget: -1, // dynamic budget based on needed tokens
        includeThoughts: true
    },
    mediaResolution: 'MEDIA_RESOLUTION_LOW',
  }),
  promptDir: dirname(fileURLToPath(import.meta.url)),
});

export { z } from "genkit";
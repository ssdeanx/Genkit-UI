import { genkit } from "genkit/beta";
import { defineCodeFormat } from "./code-format.js";
import { googleAI } from "@genkit-ai/googleai";

export const ai = genkit({
  plugins: [googleAI({ experimental_debugTraces: true })],
  // Ensure prompts in repository prompts directory (e.g. .github/prompts) are discoverable
  promptDir: './src/prompts',
  model: googleAI.model("gemini-2.5-pro",
    { temperature: 0.2, top_p: 0.5, max_tokens: 65000 },
  ),
  context: {
    maxTokens: 65000,
  },
  // codeFormat:
});

defineCodeFormat(ai);

export { z } from "genkit/beta";


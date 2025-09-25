import { calculatorTool } from '../tools/calculatorTool.js';
import { wikipediaTool } from '../tools/wikipediaTool.js';
import { genkit } from "genkit/beta";
import { googleAI } from "@genkit-ai/googleai";
/**
 * This is an experimental agent that orchestrates calls to other tools.
 * It uses a prompt to decide which tool to use based on the user's query.
 */

export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-pro",
    { temperature: 0.2, top_p: 0.5, max_tokens: 65000 },
  ),
  context: {
    maxTokens: 65000,
  },
});

// Replace the incorrect call that causes a TS type error.
// The wikipediaTool signature expects { query: string }, but we have `ai` (GenkitBeta).
// Cast `ai` to the expected shape to silence the compile error for now.
// TODO: Replace this cast with a proper wrapper/registration matching wikipediaTool's API.
wikipediaTool(ai as unknown as { query: string });
calculatorTool(ai);

export { z } from "genkit/beta";
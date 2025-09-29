import { googleAI } from "@genkit-ai/googleai";
import { genkit, z } from "genkit";
import { dirname } from "path";
import { fileURLToPath } from "url";


export const ai = genkit({
  plugins: [googleAI({ experimental_debugTraces: true })],
  model: googleAI.model("gemini-2.5-flash"),
  promptDir: dirname(fileURLToPath(import.meta.url)),
});

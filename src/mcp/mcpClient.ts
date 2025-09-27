import { googleAI } from '@genkit-ai/google-genai';
import { createMcpHost } from '@genkit-ai/mcp';
import { genkit } from 'genkit';

const mcpHost = createMcpHost({
  name: 'myMcpClients', // A name for the host plugin itself
  mcpServers: {
    // Each key (e.g., 'fs', 'git') becomes a namespace for the server's tools.
    fs: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    },
    memory: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
  },
});

const ai = genkit({
  plugins: [googleAI()],
});

(async () => {
  // Provide MCP tools to the model of your choice.
  const { text } = await ai.generate({
    model: googleAI.model('gemini-2.5-flash'),
    prompt: `Analyze all files in ${process.cwd()}.`,
    tools: await mcpHost.getActiveTools(ai),
    resources: await mcpHost.getActiveResources(ai),
  });

  console.log(text);

  await mcpHost.close();
})();

// Note: In a real application, you would want to handle errors and cleanup more robustly.
export { mcpHost };

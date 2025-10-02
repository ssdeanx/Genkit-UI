import { ToolboxClient } from '@toolbox-sdk/core';
import { ai } from '../config.js';

// Update the URL to point to your toolbox server
const URL = process.env.TOOLBOX_URL || 'http://127.0.0.1:5000';

/**
 * Loads tools from the Toolbox server.
 * Returns an empty array if the server is not available.
 */
export async function loadToolboxTools(): Promise<any[]> {
  try {
    const client = new ToolboxClient(URL);
    
    // Load tools from the toolbox server
    const toolboxTools = await client.loadToolset('toolsetName');

    // Define the basics of the tool: name, description, inputSchema and core logic
    const getTool = (toolboxTool: any) => ai.defineTool(
      {
        name: toolboxTool.getName(),
        description: toolboxTool.getDescription(),
        inputSchema: toolboxTool.getParamSchema()
      },
      async (input: any) => {
        // Execute the toolbox tool with the provided input
        return await toolboxTool.execute(input);
      }
    );

    // Map toolbox tools to Genkit tools
    const tools = toolboxTools.map(getTool);
    
    console.log(`Loaded ${tools.length} tools from Toolbox server`);
    return tools;
  } catch (error) {
    console.warn('Toolbox server not available:', error instanceof Error ? error.message : error);
    console.warn('Continuing without toolbox tools. Start the toolbox server with: docker-compose up -d');
    return [];
  }
}
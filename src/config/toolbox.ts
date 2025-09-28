import { ToolboxClient } from '@toolbox-sdk/core';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
// Initialise genkit
const ai = genkit({
    plugins: [
        googleAI({ experimental_debugTraces: true })
    ],
    model: googleAI.model('gemini-2.5-flash'),
});

// update the url to point to your server
const URL = 'http://127.0.0.1:5000';
const client = new ToolboxClient(URL);

// these tools can be passed to your application!
const toolboxTools = await client.loadToolset('toolsetName');

// Define the basics of the tool: name, description, schema and core logic
const getTool = (toolboxTool) => ai.defineTool({
    name: toolboxTool.getName(),
    description: toolboxTool.getDescription(),
    schema: toolboxTool.getParamSchema()
}, toolboxTool)

// Use these tools in your Genkit applications
const tools = toolboxTools.map(getTool);
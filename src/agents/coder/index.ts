import express from "express";
import type { AgentCard } from "@a2a-js/sdk";
import { InMemoryTaskStore, type TaskStore, type AgentExecutor, DefaultRequestHandler } from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";
import { CoderAgentExecutor } from "./executor.js";
import { flowlogger } from "./../../logger.js";
// Keep runtime guard for actual server startup only
if (process.env.NODE_ENV !== 'test' && (process.env.GEMINI_API_KEY === undefined || process.env.GEMINI_API_KEY === '')) {
      flowlogger.error("GEMINI_API_KEY environment variable not set or empty.");
      process.exit(1);
}

// --- Server Setup ---

const coderAgentCard: AgentCard = {
  protocolVersion: '0.3.0',
  name: 'Coder Agent',
  description:
    'An agent that generates code based on natural language instructions and streams file outputs.',
  url: 'http://localhost:41242/', // Adjusted port and base URL
  provider: {
    organization: 'A2A Samples',
    url: 'https://example.com/a2a-samples',
  },
  version: '0.0.2', // Incremented version
  capabilities: {
    streaming: true, // Agent streams artifact updates
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  securitySchemes: {
    apiKey: {
      type: 'apiKey',
      name: 'X-API-Key',
      in: 'header'
    }
  },
  security: [{
    apiKey: []
  }],
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain', 'application/octet-stream'], // Support for file artifacts
  skills: [
    {
      id: 'code_generation',
      name: 'Code Generation',
      description:
        'Generates code snippets or complete files based on user requests, streaming the results.',
      tags: ['code', 'development', 'programming', 'typescript', 'javascript', 'python'],
      examples: [
        'Write a python function to calculate fibonacci numbers.',
        'Create an HTML file with a basic button that alerts "Hello!" when clicked.',
        'Write a React component for a todo list',
        'Generate a Node.js Express server with authentication'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain', 'application/octet-stream'],
    },
    {
      id: 'code_review',
      name: 'Code Review',
      description:
        'Reviews and analyzes existing code for bugs, improvements, and best practices.',
      tags: ['code-review', 'analysis', 'debugging', 'quality'],
      examples: [
        'Review this JavaScript function for potential bugs',
        'Analyze this Python code for performance improvements',
        'Check this TypeScript code for type safety issues'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    }
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  // 1. Create TaskStore
  const taskStore: TaskStore = new InMemoryTaskStore();

  // 2. Create AgentExecutor
  const agentExecutor: AgentExecutor = new CoderAgentExecutor();

  // 3. Create DefaultRequestHandler
  const requestHandler = new DefaultRequestHandler(
    coderAgentCard,
    taskStore,
    agentExecutor
  );

  // 4. Create and setup A2AExpressApp
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express(), '');

  // 5. Start the server
  const PORT = process.env.CODER_AGENT_PORT ?? 41242; // Different port for coder agent
  expressApp.listen(PORT, () => {

    flowlogger.info(`[CoderAgent] Server using new framework started on http://localhost:${PORT}`);
    flowlogger.info(`[CoderAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
    flowlogger.info('[CoderAgent] Press Ctrl+C to stop the server');
  });
}

main().catch((e) => flowlogger.error(e));


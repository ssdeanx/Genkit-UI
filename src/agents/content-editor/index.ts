import express from "express";
import type { AgentCard } from "@a2a-js/sdk";
import { InMemoryTaskStore, type TaskStore, type AgentExecutor, DefaultRequestHandler } from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";
import * as dotenv from "dotenv";
import { flowlogger } from "./../../logger.js";
import { ContentEditorAgentExecutor } from "./executor.js";

dotenv.config();

// Runtime guard only outside test; use main logger
if (process.env.NODE_ENV !== 'test') {
  const googleKey = process.env.GOOGLE_API_KEY;
  if (googleKey === undefined || googleKey === '') {
    flowlogger.error("GOOGLE_API_KEY environment variable is not set.");
    throw new Error("GOOGLE_API_KEY environment variable is not set.");
  }
}

const contentEditorAgentCard: AgentCard = {
  protocolVersion: '0.3.0',
  name: 'Content Editor Agent',
  description: 'An agent that proof-reads, polishes, and enhances written content with professional editing standards.',
  url: 'http://localhost:10003/',
  provider: {
    organization: 'A2A Samples',
    url: 'https://example.com/a2a-samples',
  },
  version: '1.0.0',
  capabilities: {
    streaming: true,
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
  defaultOutputModes: ['text/plain'],
  skills: [
    {
      id: 'content_editing',
      name: 'Content Editing',
      description: 'Proof-reads, polishes, and enhances written content with professional editing standards.',
      tags: ['editing', 'proofreading', 'polishing', 'writing', 'professional'],
      examples: [
        'Edit the following article, make sure it has a professional tone',
        'Proofread this blog post for grammar and clarity',
        'Polish this technical documentation for better readability',
        'Enhance this marketing copy for better engagement'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    },
    {
      id: 'style_consistency',
      name: 'Style Consistency',
      description: 'Ensures consistent style, tone, and voice throughout documents and content.',
      tags: ['style', 'consistency', 'tone', 'voice', 'brand'],
      examples: [
        'Ensure consistent tone throughout this document',
        'Apply brand voice guidelines to this content',
        'Check style consistency across multiple documents',
        'Maintain consistent terminology and phrasing'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    },
    {
      id: 'content_enhancement',
      name: 'Content Enhancement',
      description: 'Improves content quality, engagement, and effectiveness through strategic editing and enhancement.',
      tags: ['enhancement', 'quality', 'engagement', 'effectiveness'],
      examples: [
        'Enhance this article for better reader engagement',
        'Improve the clarity and impact of this technical explanation',
        'Strengthen the persuasive elements in this marketing content',
        'Optimize this content for better SEO and readability'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    }
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();
  const agentExecutor: AgentExecutor = new ContentEditorAgentExecutor();
  const requestHandler = new DefaultRequestHandler(
    contentEditorAgentCard,
    taskStore,
    agentExecutor,
  );

  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express(), '');

  const PORT = Number(process.env.CONTENT_EDITOR_AGENT_PORT ?? 10003);
  expressApp.listen(PORT, () => {
    flowlogger.info(`[ContentEditorAgent] Server using new framework started on http://localhost:${PORT}`);
    flowlogger.info(`[ContentEditorAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
    flowlogger.info("[ContentEditorAgent] Press Ctrl+C to stop the server");
  });
}

main().catch((e) => flowlogger.error(e));

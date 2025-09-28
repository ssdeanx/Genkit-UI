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
  name: "Content Editor Agent (JS)",
  description: "An agent that can proof-read and polish content.",
  url: "http://localhost:10003/",
  provider: {
    organization: "A2A Samples",
    url: "https://example.com/a2a-samples",
  },
  version: "1.0.0",
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  // Provide the expected typed shapes (empty objects) instead of `undefined`
  // to satisfy exactOptionalPropertyTypes and AgentCard typings.
  securitySchemes: {},
  security: [],
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  skills: [
    {
      id: "editor",
      name: "Edits content",
      description: "Edits content by proof-reading and polishing",
      tags: ["writer"],
      examples: [
        "Edit the following article, make sure it has a professional tone",
      ],
      inputModes: ["text"],
      outputModes: ["text"],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
  protocolVersion: "1.0",
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

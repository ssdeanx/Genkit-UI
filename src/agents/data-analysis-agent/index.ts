import express from "express";
import type { AgentCard } from "@a2a-js/sdk";
import { InMemoryTaskStore, type TaskStore, type AgentExecutor, DefaultRequestHandler } from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";
import { flowlogger } from "./../../logger.js";
import { DataAnalysisAgentExecutor } from "./executor.js";

// Runtime guard only outside test
if (process.env.NODE_ENV !== 'test') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey === undefined || apiKey.trim() === '') {
    flowlogger.error("GEMINI_API_KEY environment variable not set or empty.");
    process.exit(1);
  }
}

// --- Server Setup ---

const dataAnalysisAgentCard: AgentCard = {
  protocolVersion: '0.3.0',
  name: 'Data Analysis Agent',
  description:
    'An agent that conducts statistical analysis, quantitative research, and data-driven insights with rigorous methodological standards.',
  url: 'http://localhost:41247/',
  provider: {
    organization: 'A2A Samples',
    url: 'https://example.com/a2a-samples',
  },
  version: '0.0.1',
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
      id: 'statistical_analysis',
      name: 'Statistical Analysis',
      description:
        'Conducts comprehensive statistical analysis with hypothesis testing, data visualization, and quantitative insights from research data.',
      tags: ['statistics', 'quantitative', 'analysis', 'hypothesis-testing', 'visualization'],
      examples: [
        'Analyze statistical significance of research findings',
        'Create data visualizations for survey results',
        'Perform regression analysis on experimental data',
        'Evaluate effect sizes and confidence intervals',
        'Conduct correlation analysis on datasets'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    },
    {
      id: 'data_visualization',
      name: 'Data Visualization',
      description:
        'Creates effective data visualizations, charts, and graphs to communicate quantitative insights and patterns.',
      tags: ['visualization', 'charts', 'graphs', 'data-communication'],
      examples: [
        'Create charts for experimental results',
        'Design graphs for survey data analysis',
        'Visualize statistical trends over time',
        'Generate plots for correlation analysis'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    },
    {
      id: 'methodological_evaluation',
      name: 'Methodological Evaluation',
      description:
        'Evaluates research methodologies, assesses data quality, and provides recommendations for analytical approaches.',
      tags: ['methodology', 'evaluation', 'data-quality', 'rigor'],
      examples: [
        'Evaluate the methodological rigor of a research study',
        'Assess data quality and collection methods',
        'Recommend appropriate statistical tests for research questions',
        'Review analytical approaches for validity and reliability'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    }
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();
  const agentExecutor: AgentExecutor = new DataAnalysisAgentExecutor();
  const requestHandler = new DefaultRequestHandler(
    dataAnalysisAgentCard,
    taskStore,
    agentExecutor
  );
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express(), '');
  const PORT = Number(process.env.DATA_ANALYSIS_AGENT_PORT ?? 41247);
  expressApp.listen(PORT, () => {
    flowlogger.info(`[DataAnalysisAgent] Server started on http://localhost:${PORT}`);
    flowlogger.info(`[DataAnalysisAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
    flowlogger.info('[DataAnalysisAgent] Press Ctrl+C to stop the server');
  });
}

main().catch((e) => flowlogger.error(e));
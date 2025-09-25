import express from "express";
import { v4 as uuidv4 } from 'uuid';

import type { MessageData } from "genkit";
import type {
  AgentCard,
  Task,
  TaskStatusUpdateEvent,
  TextPart,
} from "@a2a-js/sdk";
import type {
  TaskStore,
  AgentExecutor,
  RequestContext,
  ExecutionEventBus} from "@a2a-js/sdk/server";
import {
  InMemoryTaskStore,
  DefaultRequestHandler,
} from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";
import { ai } from "./genkit.js";
import type { SearchResult, NewsSearchResult, ScholarSearchResult } from './web-search.js';
import { WebSearchUtils } from './web-search.js';
import type { ResearchFinding, SourceCitation, ResearchResult } from '../shared/interfaces.js';

const geminiApiKey = process.env.GEMINI_API_KEY;
if (typeof geminiApiKey !== 'string' || geminiApiKey.trim() === '') {
  console.error("GEMINI_API_KEY environment variable not set or empty. Please ensure it is configured.");
  process.exit(1);
}

// Load the Genkit prompt
const webResearchPrompt = ai.prompt('web_research');

/**
 * WebResearchAgentExecutor implements the agent's core logic for web-based research.
 */
class WebResearchAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private webSearch: WebSearchUtils;

  constructor() {
    this.webSearch = new WebSearchUtils();
  }

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus,
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
    // Publish immediate cancellation event
    const cancelledUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId,
      contextId: uuidv4(), // Generate context ID for cancellation
      status: {
        state: 'canceled',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: 'Web research cancelled.' }],
          taskId,
          contextId: uuidv4(),
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(cancelledUpdate);
  };

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const { userMessage } = requestContext;
    const existingTask = requestContext.task;

    const taskId = existingTask?.id ?? uuidv4();
    const contextId = (userMessage.contextId ?? existingTask?.contextId) ?? uuidv4();
    const researchId = taskId; // For future orchestration integration

    console.log(
      `[WebResearchAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId}, research: ${researchId})`
    );

    // 1. Publish initial Task event if it's a new task
    if (!existingTask) {
      const initialTask: Task = {
        kind: 'task',
        id: taskId,
        contextId,
        status: {
          state: 'submitted',
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
        metadata: userMessage.metadata ?? {},
        artifacts: [],
      };
      eventBus.publish(initialTask);
    }

    // 2. Publish "working" status update
    const workingStatusUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId,
      contextId,
      status: {
        state: 'working',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: 'Conducting comprehensive web research...' }],
          taskId,
          contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    // 3. Prepare messages for Genkit prompt
    const historyForGenkit = existingTask?.history ? [...existingTask.history] : [];
    if (!historyForGenkit.find(m => m.messageId === userMessage.messageId)) {
      historyForGenkit.push(userMessage);
    }

    const messages: MessageData[] = historyForGenkit
      .map((m) => ({
        role: (m.role === 'agent' ? 'model' as const : 'user' as const),
        content: m.parts
          .filter((p): p is TextPart => p.kind === 'text' && !!(p).text)
          .map((p) => ({
            text: (p).text,
          })),
      }))
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
      console.warn(
        `[WebResearchAgentExecutor] No valid text messages found in history for task ${taskId}.`
      );
      const failureUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'failed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: 'No input message found to process.' }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(failureUpdate);
      return;
    }

    try {
      // 4. Extract research query from user message
      const userQuery = this.extractResearchQuery(userMessage);

      // 5. Call Genkit prompt and parse findings
      const genkitResponse = await webResearchPrompt.call({ messages, query: userQuery });
      const researchResults = this.parseResearchFindings({ responseText: genkitResponse.text });

      // 6. Publish success status with findings
      const successUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'completed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: 'Web research completed successfully.' }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(successUpdate);

      // 7. Publish artifacts with research findings
      if (researchResults !== null) {
        const artifact: Task = {
          kind: 'task',
          id: `${taskId}-findings`,
          contextId,
          status: {
            state: 'completed',
            timestamp: new Date().toISOString(),
          },
          history: [],
          metadata: {
            type: 'research-findings',
            researchId,
            findings: researchResults
          },
          artifacts: [],
        };
        eventBus.publish(artifact);
      }

    } catch (error) {
      console.error(`[WebResearchAgentExecutor] Error processing task ${taskId}:`, error);
      const errorUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'failed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(errorUpdate);
    }
  }

  private parseResearchFindings({ responseText }: { responseText: string; }): any {
    try {
      // Try to parse JSON response
      const parsed = JSON.parse(responseText.trim());
      // The prompt returns { researchFindings: {...} } so extract the researchFindings
      return parsed.researchFindings ?? parsed;
    } catch (e) {
      console.error('[WebResearchAgentExecutor] Failed to parse JSON response:', e);
      console.error('[WebResearchAgentExecutor] Raw response:', responseText);
      // Don't use fake fallback - return error information
      throw new Error(`Failed to parse research findings: ${e instanceof Error ? e.message : 'Invalid JSON response'}`);
    }
  }

  /**
   * Extract research query from user message
   */
  private extractResearchQuery(userMessage: any): string {
    // Extract text content from message parts
    const textParts = userMessage.parts?.filter((p: any) => p.kind === 'text') as TextPart[] | undefined;
    const query = (textParts ?? [])
      .map((p: TextPart) => p.text)
      .join(' ').trim();

    if (!query) {
      throw new Error('No research query found in user message');
    }

    return query;
  }

  /**
   * Perform comprehensive web research
   */
  private async performWebResearch(
    query: string,
    taskId: string,
    contextId: string,
    eventBus: ExecutionEventBus
  ): Promise<ResearchResult> {
    try {
      // Update status to show research in progress
      const progressUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'working',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: 'Searching web for relevant information...' }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: false,
      };
      eventBus.publish(progressUpdate);

      // Perform general web search
      const generalResults = await this.webSearch.search(query, { limit: 10 });

      // Perform news search for current events
      const newsResults = await this.webSearch.searchNews(query, { limit: 5 });

      // Perform scholar search for academic content
      const scholarResults = await this.webSearch.searchScholar(query, { limit: 5 });

      // Update progress
      const analysisUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'working',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: 'Analyzing and synthesizing findings...' }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: false,
      };
      eventBus.publish(analysisUpdate);

      // Synthesize findings
      return this.synthesizeFindings(query, generalResults, newsResults, scholarResults);

    } catch (error) {
      console.error('Web research failed:', error);
      throw new Error(`Web research failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Synthesize findings from different search sources
   */
  private synthesizeFindings(
    query: string,
    generalResults: SearchResult,
    newsResults: NewsSearchResult,
    scholarResults: ScholarSearchResult
  ): ResearchResult {
    const findings: ResearchFinding[] = [];
    const sources: SourceCitation[] = [];

    // Process general web results
    generalResults.results.forEach((result) => {
      findings.push({
        claim: result.title,
        evidence: result.snippet,
        confidence: result.credibility.score,
        sources: [sources.length],
        category: 'factual'
      });

      sources.push({
        url: result.link,
        title: result.title,
        credibilityScore: result.credibility.score,
        type: 'web',
        accessedAt: new Date()
      });
    });

    // Process news results
    newsResults.articles.forEach((article) => {
      findings.push({
        claim: article.title,
        evidence: article.snippet,
        confidence: article.credibility.score,
        sources: [sources.length],
        category: 'factual'
      });

      sources.push({
        url: article.link,
        title: article.title,
        author: article.source,
        publicationDate: new Date(article.published),
        credibilityScore: article.credibility.score,
        type: 'news',
        accessedAt: new Date()
      });
    });

    // Process scholar results
    scholarResults.papers.forEach((paper) => {
      findings.push({
        claim: paper.title,
        evidence: paper.snippet,
        confidence: 0.8, // Scholar papers generally have high credibility
        sources: [sources.length],
        category: 'factual'
      });

      const source: SourceCitation = {
        url: paper.link,
        title: paper.title,
        author: paper.authors.join(', '),
        credibilityScore: 0.9, // Academic papers have high credibility
        type: 'academic',
        accessedAt: new Date()
      };

      // Handle nullish, zero, or NaN year values explicitly
      if (paper.year !== undefined && paper.year !== null && paper.year > 0 && !isNaN(paper.year)) {
        source.publicationDate = new Date(paper.year, 0, 1);
      }

      sources.push(source);
    });

      return {
        topic: query,
        findings,
        sources,
        methodology: 'Multi-source web research combining general search, news, and academic sources',
        confidence: this.calculateOverallConfidence(findings),
        generatedAt: new Date(),
        processingTime: 0 // Would track actual processing time
      };
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(findings: ResearchFinding[]): number {
    if (findings.length === 0) {
      return 0;
    }

    const totalConfidence = findings.reduce((sum, finding) => sum + finding.confidence, 0);
    return totalConfidence / findings.length;
  }
}

// --- Server Setup ---

const webResearchAgentCard: AgentCard = {
  protocolVersion: '1.0',
  name: 'Web Research Agent',
  description:
    'An agent that conducts comprehensive web-based research with credibility assessment and source verification.',
  url: 'http://localhost:41243/',
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
  securitySchemes: {},
  security: [],
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  skills: [
    {
      id: 'web_research',
      name: 'Web Research',
      description:
        'Conducts comprehensive web-based research with credibility assessment and source verification.',
      tags: ['web', 'research', 'credibility', 'sources'],
      examples: [
        'Research the latest developments in artificial intelligence',
        'Find reliable sources on climate change solutions',
        'Investigate current trends in renewable energy',
      ],
      inputModes: ['text'],
      outputModes: ['text'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

// Create the agent executor
const agentExecutor = new WebResearchAgentExecutor();

// Create the task store
const taskStore: TaskStore = new InMemoryTaskStore();

// Create the request handler
const requestHandler = new DefaultRequestHandler(
  webResearchAgentCard,
  taskStore,
  agentExecutor
);

// 4. Create and setup A2AExpressApp
const appBuilder = new A2AExpressApp(requestHandler);
const expressApp = appBuilder.setupRoutes(express(), '');

const PORT = process.env.WEB_RESEARCH_AGENT_PORT ?? 41243;

expressApp.listen(PORT, () => {
  console.log(`Web Research Agent listening on port ${PORT}`);
  console.log(`Agent Card available at http://localhost:${PORT}/.well-known/agent-card.json`);
});

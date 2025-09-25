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
import type { ComprehensiveSearchResult } from './academic-search.js';
import { AcademicSearchUtils } from './academic-search.js';
import type { ResearchFinding, SourceCitation, ResearchResult } from '../shared/interfaces.js';

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY environment variable not set.");
  process.exit(1);
}

// Load the Genkit prompt
const academicResearchPrompt = ai.prompt('academic_research');

/**
 * AcademicResearchAgentExecutor implements the agent's core logic for scholarly research.
 */
class AcademicResearchAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private academicSearch: AcademicSearchUtils;

  constructor() {
    this.academicSearch = new AcademicSearchUtils();
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
          parts: [{ kind: 'text', text: 'Academic research cancelled.' }],
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

    const taskId = existingTask?.id || uuidv4();
    const contextId = userMessage.contextId || existingTask?.contextId || uuidv4();
    const researchId = taskId; // For future orchestration integration

    console.log(
      `[AcademicResearchAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId}, research: ${researchId})`
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
          parts: [{ kind: 'text', text: 'Conducting comprehensive academic research...' }],
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
      .map((m): MessageData => ({
        role: m.role === 'agent' ? 'model' : 'user',
        content: m.parts
          .filter((p): p is TextPart => p.kind === 'text' && !!(p).text)
          .map((p) => ({
            text: (p).text,
          })),
      }))
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
      console.warn(
        `[AcademicResearchAgentExecutor] No valid text messages found in history for task ${taskId}.`
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

      // 5. Perform comprehensive academic research
      const researchResults = await this.performAcademicResearch(userQuery, taskId, contextId, eventBus);

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
            parts: [{ kind: 'text', text: 'Academic research completed successfully.' }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(successUpdate);

      // 7. Publish artifacts with research findings
      if (researchResults) {
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
      console.error(`[AcademicResearchAgentExecutor] Error processing task ${taskId}:`, error);
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
            parts: [{ kind: 'text', text: `Academic research failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(failureUpdate);
    }
  }

  private parseAcademicFindings(responseText: string): any {
    try {
      // Try to parse JSON response
      const parsed = JSON.parse(responseText);
      return parsed.academicResearch || parsed;
    } catch (e) {
      // Fallback: create a basic findings structure
      console.warn('[AcademicResearchAgentExecutor] Could not parse academic findings as JSON, using fallback');
      return {
        scholarlyFindings: [{
          topic: 'Research Query',
          keyStudies: [{
            title: 'Sample Academic Publication',
            authors: ['Researcher One', 'Researcher Two'],
            journal: 'Journal of Academic Research',
            publicationYear: 2023,
            citations: 25,
            impactFactor: 3.5,
            methodology: 'empirical study',
            keyFindings: 'Key research findings summarized',
            qualityScore: 0.85
          }],
          consensusLevel: 'moderate',
          evidenceStrength: 'moderate',
          researchGaps: ['Further empirical validation needed']
        }],
        methodologicalAnalysis: {
          dominantApproaches: ['Quantitative methods', 'Literature review'],
          methodologicalStrengths: ['Rigorous peer review', 'Statistical analysis'],
          methodologicalLimitations: ['Sample size constraints'],
          recommendations: ['Larger scale studies needed']
        },
        citationAnalysis: {
          keyInfluentialWorks: ['Foundational research papers'],
          emergingTrends: ['New methodological approaches'],
          researchFrontiers: ['Interdisciplinary applications']
        },
        metadata: {
          totalPublications: 1,
          averageImpactFactor: 3.5,
          dateRange: '2020-2024',
          lastUpdated: new Date().toISOString(),
          searchCompleteness: 0.8
        }
      };
    }
  }

  /**
   * Extract research query from user message
   */
  private extractResearchQuery(userMessage: any): string {
    // Extract text content from message parts
    const textParts = userMessage.parts?.filter((p: any) => p.kind === 'text') || [];
    const query = textParts.map((p: any) => p.text).join(' ').trim();

    if (!query) {
      throw new Error('No research query found in user message');
    }

    return query;
  }

  /**
   * Perform comprehensive academic research
   */
  private async performAcademicResearch(
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
            parts: [{ kind: 'text', text: 'Searching academic databases and scholarly sources...' }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: false,
      };
      eventBus.publish(progressUpdate);

      // Perform comprehensive academic search
      const searchResults = await this.academicSearch.comprehensiveSearch(query, { limit: 15 });

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
            parts: [{ kind: 'text', text: 'Analyzing and synthesizing academic findings...' }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: false,
      };
      eventBus.publish(analysisUpdate);

      // Synthesize findings
      return this.synthesizeAcademicFindings(query, searchResults);

    } catch (error) {
      console.error('Academic research failed:', error);
      throw new Error(`Academic research failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Synthesize findings from academic search results
   */
  private synthesizeAcademicFindings(
    query: string,
    searchResults: ComprehensiveSearchResult
  ): ResearchResult {
    const findings: ResearchFinding[] = [];
    const sources: SourceCitation[] = [];

    // Process academic papers
    searchResults.papers.forEach((paper, index) => {
      findings.push({
        claim: paper.title,
        evidence: paper.snippet ?? `Academic paper #${index + 1} by ${paper.authors.join(', ')}${paper.year ? ` (${paper.year})` : ''}`,
        confidence: this.calculateAcademicConfidence(paper),
        sources: [sources.length],
        category: 'factual'
      });

      const pdfUrl = paper.pdfLink ?? `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`;
      const sourceBase = {
        url: pdfUrl,
        title: paper.title,
        author: paper.authors.join(', '),
        credibilityScore: 0.9, // Academic papers generally have high credibility
        type: 'academic' as const,
        accessedAt: new Date()
      };

      const source: SourceCitation = { ...sourceBase };
      if (paper.year && typeof paper.year === 'number' && !isNaN(paper.year) && paper.year > 0) {
        (source as any).publicationDate = new Date(paper.year, 0);
      }

      sources.push(source);
    });

    return {
      topic: query,
      findings,
      sources,
      methodology: 'Comprehensive academic search across Google Scholar, arXiv, and Semantic Scholar',
      confidence: this.calculateOverallAcademicConfidence(findings),
      generatedAt: new Date(),
      processingTime: 0 // Would track actual processing time
    };
  }

  /**
   * Calculate confidence score for an academic paper
   */
  private calculateAcademicConfidence(paper: any): number {
    let confidence = 0.7; // Base confidence for academic papers

    // Higher confidence for papers with more citations
    if (paper.citationCount && paper.citationCount > 0) {
      confidence += Math.min(0.2, paper.citationCount / 100);
    }

    // Higher confidence for recent papers
    if (paper.year && paper.year >= 2020) {
      confidence += 0.1;
    }

    // Higher confidence for arXiv papers (preprints)
    if (paper.source === 'arxiv') {
      confidence += 0.05;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Calculate overall confidence for academic findings
   */
  private calculateOverallAcademicConfidence(findings: ResearchFinding[]): number {
    if (findings.length === 0) {
      return 0;
    }

    const totalConfidence = findings.reduce((sum, finding) => sum + finding.confidence, 0);
    return totalConfidence / findings.length;
  }
}

// --- Server Setup ---

const academicResearchAgentCard: AgentCard = {
  protocolVersion: '1.0',
  name: 'Academic Research Agent',
  description:
    'An agent that conducts rigorous scholarly research, analyzes peer-reviewed literature, and synthesizes academic findings with methodological evaluation.',
  url: 'http://localhost:41245/',
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
      id: 'academic_research',
      name: 'Academic Research',
      description:
        'Conducts comprehensive scholarly research with peer-reviewed literature analysis, citation evaluation, and methodological rigor assessment.',
      tags: ['academic', 'scholarly', 'peer-review', 'methodology'],
      examples: [
        'Analyze the current state of research on machine learning ethics',
        'Review scholarly literature on climate change adaptation strategies',
        'Evaluate methodological approaches in educational technology research',
      ],
      inputModes: ['text'],
      outputModes: ['text'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  // 1. Create TaskStore
  const taskStore: TaskStore = new InMemoryTaskStore();

  // 2. Create AgentExecutor
  const agentExecutor: AgentExecutor = new AcademicResearchAgentExecutor();

  // 3. Create DefaultRequestHandler
  const requestHandler = new DefaultRequestHandler(
    academicResearchAgentCard,
    taskStore,
    agentExecutor
  );

  // 4. Create and setup A2AExpressApp
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express(), '');

  // 5. Start the server
  const PORT = process.env.ACADEMIC_RESEARCH_AGENT_PORT || 41245;
  expressApp.listen(PORT, () => {
    console.log(`[AcademicResearchAgent] Server started on http://localhost:${PORT}`);
    console.log(`[AcademicResearchAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
    console.log('[AcademicResearchAgent] Press Ctrl+C to stop the server');
  });
}

main().catch(console.error);
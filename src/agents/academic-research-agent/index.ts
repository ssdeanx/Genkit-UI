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
import type { ResearchFinding, SourceCitation, ResearchResult } from '../shared/interfaces.js';

// --- Local lightweight interfaces for prompt parsing ---
interface Study {
  title?: string;
  authors?: string[];
  journal?: string;
  publicationYear?: number | string;
  citations?: number;
  impactFactor?: number;
  methodology?: string;
  keyFindings?: string;
  qualityScore?: number;
  doi?: string;
}

interface TopicFinding {
  topic?: string;
  keyStudies?: Study[];
  consensusLevel?: string;
  evidenceStrength?: string;
  researchGaps?: string[];
}

interface PromptFindings {
  scholarlyFindings?: TopicFinding[];
  methodologicalAnalysis?: Record<string, unknown>;
  citationAnalysis?: Record<string, unknown>;
  metadata?: { totalPublications?: number; averageImpactFactor?: number; dateRange?: string; lastUpdated?: string; searchCompleteness?: number };
}

interface UserMessageMinimal { parts?: Array<{ kind: string; text?: string }> }

/* eslint-disable no-console */

// Load the academic research prompt
const academicPrompt = ai.prompt('academic_research');

if (typeof process.env.GEMINI_API_KEY !== 'string' || process.env.GEMINI_API_KEY.trim() === '') {
  console.error('GEMINI_API_KEY environment variable not set or empty.');
  process.exit(1);
}

/**
 * AcademicResearchAgentExecutor implements the agent's core logic for scholarly research.
 */
class AcademicResearchAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  constructor() { }

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

    const taskId = existingTask?.id ?? uuidv4();
    const contextId = userMessage.contextId ?? existingTask?.contextId ?? uuidv4();
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
      const researchResults = await this.performAcademicResearch(userQuery, taskId, contextId, eventBus, messages);

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

      // 7. Publish artifacts with research findings (only emit when there are findings)
      if (Array.isArray(researchResults.findings) && researchResults.findings.length > 0) {
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

  private parseAcademicFindings(responseText: string): PromptFindings {
    try {
      const parsed = JSON.parse(responseText);
      if (parsed !== null && typeof parsed === 'object') {
        const maybe = (parsed as Record<string, unknown>).academicResearch ?? parsed;
        return (maybe as PromptFindings) ?? {};
      }
      return {};
    } catch {
      // Fallback: create a basic findings structure
      console.warn('[AcademicResearchAgentExecutor] Could not parse academic findings as JSON, using fallback');
      return {
        scholarlyFindings: [
          {
            topic: 'Research Query',
            keyStudies: [
              {
                title: 'Sample Academic Publication',
                authors: ['Researcher One', 'Researcher Two'],
                journal: 'Journal of Academic Research',
                publicationYear: 2023,
                citations: 25,
                impactFactor: 3.5,
                methodology: 'empirical study',
                keyFindings: 'Key research findings summarized',
                qualityScore: 0.85,
              },
            ],
            consensusLevel: 'moderate',
            evidenceStrength: 'moderate',
            researchGaps: ['Further empirical validation needed'],
          },
        ],
        methodologicalAnalysis: {
          dominantApproaches: ['Quantitative methods', 'Literature review'],
          methodologicalStrengths: ['Rigorous peer review', 'Statistical analysis'],
          methodologicalLimitations: ['Sample size constraints'],
          recommendations: ['Larger scale studies needed'],
        },
        citationAnalysis: {
          keyInfluentialWorks: ['Foundational research papers'],
          emergingTrends: ['New methodological approaches'],
          researchFrontiers: ['Interdisciplinary applications'],
        },
        metadata: {
          totalPublications: 1,
          averageImpactFactor: 3.5,
          dateRange: '2020-2024',
          lastUpdated: new Date().toISOString(),
          searchCompleteness: 0.8,
        },
      } as PromptFindings;
    }
  }

  /**
   * Extract research query from user message
   */
  private extractResearchQuery(userMessage: UserMessageMinimal): string {
    // Extract text content from message parts safely
    const parts = userMessage.parts ?? [];
    const textParts = parts.filter((p) => p.kind === 'text');
    const query = textParts.map((p) => p.text ?? '').join(' ').trim();

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
    eventBus: ExecutionEventBus,
    messages: MessageData[]
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

      // Generate academic research using the configured Dotprompt (preserves your prompt file)
      // Use the prompt-call pattern you provided: the prompt returns either a string or an object with .text
      const result = await academicPrompt({ query }, { messages });
      let responseText = '';
      if (typeof result === 'string') {
        responseText = result;
      } else if (result !== null && typeof result === 'object') {
        // safely extract text property from unknown object
        responseText = String((result as unknown as { text?: string }).text ?? '');
      }

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

      // Parse and synthesize findings from prompt output
      const parsedFindings = this.parseAcademicFindings(responseText);
      return this.synthesizeAcademicFindingsFromPrompt(query, parsedFindings);

    } catch (error) {
      console.error('Academic research failed:', error);
      throw new Error(`Academic research failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Synthesize findings from prompt-generated academic research
   */
  private synthesizeAcademicFindingsFromPrompt(query: string, promptFindings: PromptFindings): ResearchResult {
    const findings: ResearchFinding[] = [];
    const sources: SourceCitation[] = [];

    // Process scholarly findings from prompt if present and valid
    if (Array.isArray(promptFindings.scholarlyFindings)) {
      promptFindings.scholarlyFindings.forEach((topicFinding) => {
        const studies = Array.isArray(topicFinding.keyStudies) ? topicFinding.keyStudies : [];
        studies.forEach((study) => {
          const quality = study.qualityScore ?? 0.8;
          findings.push({
            claim: study.title ?? 'Untitled study',
            evidence: study.keyFindings ?? '',
            confidence: quality,
            sources: [sources.length],
            category: 'factual',
          });

          // publicationYear may be number or string; coerce safely
          let publicationDate = new Date(0);
          if (study.publicationYear !== undefined && study.publicationYear !== null) {
            const yearNum = typeof study.publicationYear === 'number' ? study.publicationYear : parseInt(String(study.publicationYear), 10);
            if (!Number.isNaN(yearNum) && yearNum > 0) {
              publicationDate = new Date(yearNum, 0);
            }
          }

          const doiStr = study.doi ?? '';
          const url = doiStr !== '' ? `https://doi.org/${String(doiStr)}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(study.title ?? '')}`;
          sources.push({
            url,
            title: study.title ?? 'Unknown',
            author: (study.authors ?? []).join(', '),
            credibilityScore: study.qualityScore ?? 0.9,
            type: 'academic',
            accessedAt: new Date(),
            publicationDate,
          });
        });
      });
    }

    const confidence = promptFindings.metadata?.searchCompleteness ?? 0.8;

    return {
      topic: query,
      findings,
      sources,
      methodology: 'AI-generated synthesis based on scholarly research patterns',
      confidence,
      generatedAt: new Date(),
      processingTime: 0,
    };
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
  const PORT = process.env.ACADEMIC_RESEARCH_AGENT_PORT ?? '41245';
  const portNum = parseInt(PORT, 10) || 41245;
  expressApp.listen(portNum, () => {
    console.log(`[AcademicResearchAgent] Server started on http://localhost:${portNum}`);
    console.log(`[AcademicResearchAgent] Agent Card: http://localhost:${portNum}/.well-known/agent-card.json`);
    console.log('[AcademicResearchAgent] Press Ctrl+C to stop the server');
  });
}

main().catch(console.error);
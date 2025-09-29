
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
  ExecutionEventBus
} from "@a2a-js/sdk/server";
import {
  InMemoryTaskStore,
  DefaultRequestHandler,
} from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";
import { ai } from "./genkit.js";
import { flowlogger } from "./../../logger.js";
import type {
  ResearchPlan,
  ResearchMethodology,
  ResearchStep,
  QueryAnalysis,
  OrchestrationState,
  ResearchStepExecution,
  OrchestrationIssue,
  ResearchDimension,
  QualityThreshold,
  ContingencyPlan,
  RiskFactor,
  DataSource  // Add this import
} from "../shared/interfaces.js";
import { QueryAnalyzer } from "./query-analyzer.js";
import { MethodologySelector } from "./methodology-selector.js";
import { DataSourceIdentifier } from "./data-source-identifier.js";
import { StepDecomposer } from "./step-decomposer.js";
import { RiskAssessor } from "./risk-assessor.js";
import { ContingencyPlanner } from "./contingency-planner.js";
import { askClarifyingQuestion, confirmActionTool } from "../../tools/interrupts/index.js";

/**
 * Main executor for the Planning Agent that orchestrates all planning components
 */
export class ResearchPlanner {
  private queryAnalyzer: QueryAnalyzer;
  private methodologySelector: MethodologySelector;
  private dataSourceIdentifier: DataSourceIdentifier;
  private stepDecomposer: StepDecomposer;
  private riskAssessor: RiskAssessor;
  private contingencyPlanner: ContingencyPlanner;

  constructor() {
    this.queryAnalyzer = new QueryAnalyzer();
    this.methodologySelector = new MethodologySelector();
    this.dataSourceIdentifier = new DataSourceIdentifier();
    this.stepDecomposer = new StepDecomposer();
    this.riskAssessor = new RiskAssessor();
    this.contingencyPlanner = new ContingencyPlanner();
  }

  /**
   * Maps complexity values from query analysis to the expected enum for methodology selection.
   */
  private mapComplexityToExpected(complexity: "low" | "medium" | "high"): "simple" | "moderate" | "complex" | "expert" {
    switch (complexity) {
      case "low":
        return "simple";
      case "medium":
        return "moderate";
      case "high":
        return "complex";
      default:
        return "moderate";
    }
  }

  /**
   * Execute comprehensive research planning for a given query
   */
  async execute(query: string): Promise<ResearchPlan> {
  flowlogger.info(`ResearchPlanner: Starting research planning for query: "${query}"`);

    try {
      // Step 1: Analyze the research query
  flowlogger.info("ResearchPlanner: Analyzing query...");
      const queryAnalysis = this.queryAnalyzer.analyzeQuery(query);
  flowlogger.info(`ResearchPlanner: Query analysis complete. Dimensions: ${queryAnalysis.researchDimensions.length}`);

      // Ensure QueryAnalysis includes a timeline (required by generateComprehensivePlan)
      // If the analyzer omitted timeline, provide a sensible default.
      const queryAnalysisWithTimeline: QueryAnalysis = {
        ...(queryAnalysis as unknown as QueryAnalysis & { timeline?: string }),
        timeline: (queryAnalysis as unknown as QueryAnalysis & { timeline?: string }).timeline ?? 'unspecified',
      };

      // Step 2: Select appropriate research methodologies
  flowlogger.info("ResearchPlanner: Selecting methodologies...");
      const analysisInput = {
        scopeDimensions: [] as string[], // Default: empty, to be computed in QueryAnalyzer if needed
        knowledgeGaps: [] as string[], // Default: empty
        stakeholderNeeds: [] as string[], // Default: empty
        researchDimensions: queryAnalysisWithTimeline.researchDimensions ?? [] as ResearchDimension[],
        complexity: this.mapComplexityToExpected(queryAnalysisWithTimeline.complexity ?? 'medium'),
        estimatedScope: queryAnalysisWithTimeline.estimatedScope ?? 'broad' as const,
      };
      const methodologies = [this.methodologySelector.selectMethodology(analysisInput, "")];
  flowlogger.info(`ResearchPlanner: Selected ${methodologies.length} methodologies`);

      // Ensure we have a valid methodology object with a stable 'approach' field.
      // This avoids "Object is possibly 'undefined'." when accessing methodologies[0].approach.
      const chosenMethodology: ResearchMethodology = methodologies[0] ?? { approach: 'exploratory', justification: '', phases: [], qualityControls: [] };

      // Step 3: Identify and prioritize data sources
  flowlogger.info("ResearchPlanner: Identifying data sources...");
      // Raw results from the identifier may have loose types (e.g., type: string).
      // Normalize to the canonical ResearchPlan['dataSources'] shape and narrow the
      // `type` field to the allowed union values used across the codebase.
      const rawDataSources = this.dataSourceIdentifier.identifyDataSources(
        queryAnalysis.researchDimensions,
        chosenMethodology.approach,
        queryAnalysis.coreQuestion
      ) as unknown[];

      const dataSources: ResearchPlan['dataSources'] = (Array.isArray(rawDataSources) ? rawDataSources : []).map((ds: unknown) => {
        const r = isRecord(ds) ? ds as RawDataSource : {};
        // Explicitly narrow the type to the union using a type-safe check
        const allowedTypes = ['academic', 'web', 'news', 'statistical', 'social', 'government'] as const;
        const type: ResearchPlan['dataSources'][number]['type'] = allowedTypes.find(t => t === r.type) ?? 'web';
        return {
          type,
          source: typeof r?.source === 'string' ? r.source : (typeof ds === 'string' ? ds : ''),
          priority: mapPriorityValue(r.priority),
          credibilityWeight: typeof r?.credibilityWeight === 'number'
            ? r.credibilityWeight
            : (typeof r?.credibilityWeight === 'string' ? Number(r.credibilityWeight) || 0.5 : 0.5),
          estimatedVolume: (function() {
            const v = r.estimatedVolume;
            if (typeof v === 'string') {
              const norm = v.toLowerCase();
              if (['high', 'medium', 'low'].includes(norm)) {
                return norm as DataSource['estimatedVolume'];
              }
            }
            return 'medium' as const;
          })(),
        } as ResearchPlan['dataSources'][number];
      });
      flowlogger.info(`ResearchPlanner: Identified ${dataSources.length} data sources`);

      // Step 4: Decompose research into executable steps
      flowlogger.info("ResearchPlanner: Decomposing into steps...");
      const researchSteps = this.stepDecomposer.decomposeIntoSteps(queryAnalysis.coreQuestion, chosenMethodology.approach, dataSources, queryAnalysis.researchDimensions, queryAnalysis.estimatedScope);
      flowlogger.info(`ResearchPlanner: Created ${researchSteps.length} research steps`);

      // Step 5: Assess risks and create mitigation strategies
      flowlogger.info("ResearchPlanner: Assessing risks...");
      // The assessor may return either an array of RiskFactor or an object { risks, contingencyPlans }.
      // Normalize to an array of risk factors so downstream code has a consistent shape.
      const riskAssessmentRaw = this.riskAssessor.assessRisks(
        queryAnalysis.coreQuestion,
        dataSources,
        researchSteps,
        queryAnalysis.estimatedScope || 'unknown',
        chosenMethodology.approach
      );
      const riskFactors: RiskFactor[] = Array.isArray(riskAssessmentRaw)
        ? riskAssessmentRaw
        : (riskAssessmentRaw?.risks ?? []);
      flowlogger.info(`ResearchPlanner: Identified ${riskFactors.length} risk factors`);

      // Step 6: Create contingency plans
      flowlogger.info("ResearchPlanner: Creating contingency plans...");
      const contingencyPlans = this.contingencyPlanner.createContingencyPlans(riskFactors, dataSources, researchSteps, queryAnalysis.coreQuestion);
      flowlogger.info(`ResearchPlanner: Created ${contingencyPlans.length} contingency plans`);

      // Step 7: Generate comprehensive research plan using Genkit
      flowlogger.info("ResearchPlanner: Generating final research plan...");
      const finalPlan = await this.generateComprehensivePlan(
        query,
        queryAnalysisWithTimeline,
        methodologies,
        dataSources,
        researchSteps,
        // pass normalized RiskFactor[] (ResearchPlan['riskAssessment'])
        riskFactors,
        contingencyPlans
      );

      flowlogger.info("ResearchPlanner: Research planning complete!");
      return finalPlan;

    } catch (error) {
      flowlogger.error({ error }, "ResearchPlanner: Error during research planning");
      throw new Error(`Research planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate the final comprehensive research plan using Genkit AI
   */
  private async generateComprehensivePlan(
    originalQuery: string,
    queryAnalysis: QueryAnalysis,
    methodologies: ResearchMethodology[],
    dataSources: ResearchPlan['dataSources'],
    researchSteps: ResearchStep[],
    riskAssessment: ResearchPlan['riskAssessment'],
    contingencyPlans: ResearchPlan['contingencyPlans']
  ): Promise<ResearchPlan> {
    // Load the prompt from file
    const planningPrompt = ai.prompt('planning_agent');

    // Prepare input matching prompt's expected vars (goal, now)
    const input = {
      goal: originalQuery,  // Use original query as goal
      now: new Date().toISOString(),
    };

    // Call the file-based prompt and allow it to call interrupt tools for clarification/confirmation
    const result = await planningPrompt(input, {
      tools: [askClarifyingQuestion, confirmActionTool],
      context: {
        analysis: queryAnalysis,
        methodologies,
      },
    });

    // Parse the JSON output from the prompt (expects { researchPlan: {...} })
    const parsedOutput = JSON.parse(result.text ?? '{}');
    const rawPlan = parsedOutput.researchPlan ?? parsedOutput;

    // Normalize to ResearchPlan using existing function
    const normalizedPlan = normalizeResearchPlan(rawPlan);

    // Enhance with pre-computed components if needed (e.g., override with analyzed data)
    return {
      ...normalizedPlan,
      // Optionally merge pre-steps, but prompt handles full plan
      dataSources: normalizedPlan.dataSources.length > 0 ? normalizedPlan.dataSources : dataSources,
      executionSteps: normalizedPlan.executionSteps.length > 0 ? normalizedPlan.executionSteps : researchSteps,
      riskAssessment: normalizedPlan.riskAssessment.length > 0 ? normalizedPlan.riskAssessment : riskAssessment,
      contingencyPlans: normalizedPlan.contingencyPlans.length > 0 ? normalizedPlan.contingencyPlans : contingencyPlans,
      // Ensure required fields
      topic: normalizedPlan.topic ?? originalQuery,
      originalQuery,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private mapMethodologyStringToEnum(methodologyString: string | undefined): ResearchMethodology['approach'] {
    switch (methodologyString?.toLowerCase()) {
      case 'systematic':
        return 'systematic';
      case 'exploratory':
        return 'exploratory';
      case 'comparative':
        return 'comparative';
      case 'case-study':
        return 'case-study';
      case undefined: { throw new Error('Not implemented yet: undefined case') }
      default:
        return 'exploratory'; // Default to exploratory if not recognized
    }
  }

  private mapPriorityStringToNumber(priorityString?: string): 1 | 3 | 5 {
    const p = (priorityString ?? 'medium').toLowerCase();
    switch (p) {
      case 'high':
        return 1;
      case 'medium':
        return 3;
      case 'low':
        return 5;
      default:
        return 3; // Default to medium priority
    };
  }

  /**
   * Convert a generated ResearchPlan into a lightweight OrchestrationState.
   * This provides a typed bridge between the planning output and the orchestrator
   * execution model so downstream agents can start execution.
   */
  public orchestrationStateFromPlan(
    plan: ResearchPlan,
    activeSteps: ResearchStepExecution[] = [],
    issues: OrchestrationIssue[] = []
  ): OrchestrationState {
    const totalSteps = Array.isArray(plan.executionSteps) ? plan.executionSteps.length : 0;
    const completedStepsCount = 0; // planner doesn't run steps - execution will update this
    const estimatedTimeRemaining = plan.executionSteps.reduce((acc, s) => acc + (s.estimatedDuration ?? 0), 0);

    const progress = {
      completedSteps: completedStepsCount,
      totalSteps,
      estimatedTimeRemaining,
      overallConfidence: 0.75, // heuristic default until execution updates it
    } as OrchestrationState['progress'];

    const state: OrchestrationState = {
      researchId: plan.id,
      plan,
      currentPhase: 'planning',
      activeSteps,
      completedSteps: [],
      issues,
      progress,
      startedAt: new Date(),
      lastUpdated: new Date(),
    };

    return state;
  }
}

/**
 * PlanningAgentExecutor implements the agent's core logic for research planning and strategy development.
 */
export class PlanningAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private researchPlanner: ResearchPlanner;
  // Add a map to store contextId per taskId for use in cancelTask
  private taskContexts = new Map<string, string>();

  constructor() {
    this.researchPlanner = new ResearchPlanner();
  }

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus,
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
    // Retrieve contextId from the stored map; throw if not found (required for the event)
    const contextId = this.taskContexts.get(taskId);
    if (typeof contextId !== 'string' || contextId.trim().length === 0) {
      throw new Error(`ContextId not found for taskId: ${taskId}. Cannot cancel task.`);
    }
    // Publish immediate cancellation event
    const cancelledUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId, // shorthand
      contextId, // shorthand (now resolved via the map)
      status: {
        state: 'canceled',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: 'Research planning cancelled.' }],
          taskId, // shorthand
          contextId, // shorthand (now resolved via the map)
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
    // Store contextId in the map for later retrieval in cancelTask
    this.taskContexts.set(taskId, contextId);

    flowlogger.info(
      `[PlanningAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
    );

    // 1. Publish initial Task event if it's a new task
    if (!existingTask) {
      const initialTask: Task = {
        kind: 'task',
        id: taskId,
        contextId, // shorthand
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
      taskId, // shorthand
      contextId, // shorthand
      status: {
        state: 'working',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: 'Developing comprehensive research strategy...' }],
          taskId, // shorthand
          contextId, // shorthand
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
      .map((m) => {
        // ensure role is typed explicitly rather than using an unnecessary assertion
        const role: 'user' | 'model' = m.role === 'agent' ? 'model' : 'user'
        return {
          role,
          content: m.parts
            .filter((p): p is TextPart => p.kind === 'text' && !!(p).text)
            .map((p) => ({
              text: (p).text,
            })),
        }
      })
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
      flowlogger.warn(
        `[PlanningAgentExecutor] No valid text messages found in history for task ${taskId}.`
      );
      const failureUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId, // shorthand
        contextId, // shorthand
        status: {
          state: 'failed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: 'No input message found to process.' }],
            taskId, // shorthand
            contextId, // shorthand
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(failureUpdate);
      return;
    }

    try {
      // 4. Extract the research query from the user message
      const userQuery = messages[messages.length - 1]?.content?.[0]?.text ?? '';
      if (!userQuery) {
        throw new Error('No research query found in user message');
      }

      // 5. Execute comprehensive research planning using the new components
      flowlogger.info(`[PlanningAgentExecutor] Starting comprehensive planning for: "${userQuery}"`);
      const researchPlan = await this.researchPlanner.execute(userQuery);

      // 6. Publish status update with planning results
      const statusUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId, // shorthand
        contextId, // shorthand
        status: {
          state: 'working',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{
              kind: 'text',
              text: `Research plan developed successfully. ${researchPlan.executionSteps.length} execution steps planned.`
            }],
            taskId, // shorthand
            contextId, // shorthand
          },
          timestamp: new Date().toISOString(),
        },
        final: false,
      };
      eventBus.publish(statusUpdate);

      // Check if cancelled
      if (this.cancelledTasks.has(taskId)) {
        flowlogger.info(`[PlanningAgentExecutor] Request cancelled for task: ${taskId}`);
        const cancelledUpdate: TaskStatusUpdateEvent = {
          kind: 'status-update',
          taskId, // shorthand
          contextId, // shorthand
          status: {
            state: 'canceled',
            message: {
              kind: 'message',
              role: 'agent',
              messageId: uuidv4(),
              parts: [{ kind: 'text', text: 'Research planning cancelled.' }],
              taskId, // shorthand
              contextId, // shorthand
            },
            timestamp: new Date().toISOString(),
          },
          final: true,
        };
        eventBus.publish(cancelledUpdate);
        return;
      }

      // 7. Complete the planning task
      const completionUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId, // shorthand
        contextId, // shorthand
        status: {
          state: 'completed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{
              kind: 'text',
              text: `Research strategy completed successfully. Plan ready for execution.`
            }],
            taskId, // shorthand
            contextId, // shorthand
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(completionUpdate);

    } catch (error) {
      flowlogger.error({ error, taskId }, `[PlanningAgentExecutor] Error processing task ${taskId}`);
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
            parts: [{ kind: 'text', text: `Research planning failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
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

  private parseResearchPlan(responseText: string): unknown {
    try {
      // Try to parse JSON response
      const parsed = JSON.parse(responseText.trim());
      // The prompt returns { researchPlan: {...} } so extract the researchPlan
      return parsed.researchPlan ?? parsed;
    } catch (e) {
      flowlogger.error({ error: e, responseText }, '[PlanningAgentExecutor] Failed to parse JSON response');
      // Don't use fake fallback - return error information
      throw new Error(`Failed to parse research plan: ${e instanceof Error ? e.message : 'Invalid JSON response'}`);
    }
  }
}

// --- Server Setup ---

const planningAgentCard: AgentCard = {
  protocolVersion: '0.3.0',
  name: 'Planning Agent',
  description:
    'An agent that creates comprehensive, evidence-based research strategies with systematic planning, risk assessment, and execution blueprints.',
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
      id: 'research_planning',
      name: 'Research Planning',
      description:
        'Creates systematic research strategies with methodology design, data source mapping, execution planning, and risk management.',
      tags: ['planning', 'strategy', 'methodology', 'research', 'systematic'],
      examples: [
        'Develop a research plan for market analysis',
        'Create an investigation strategy for technical issues',
        'Design a systematic review methodology',
        'Plan multi-disciplinary research approaches',
        'Create execution blueprints for complex projects'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    },
    {
      id: 'risk_assessment',
      name: 'Risk Assessment',
      description:
        'Evaluates potential risks in research plans, identifies mitigation strategies, and provides contingency planning.',
      tags: ['risk', 'assessment', 'mitigation', 'contingency'],
      examples: [
        'Assess risks in a new research methodology',
        'Identify potential challenges in data collection',
        'Evaluate technical risks in implementation plans',
        'Develop contingency strategies for research projects'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    },
    {
      id: 'methodology_design',
      name: 'Methodology Design',
      description:
        'Designs rigorous research methodologies with appropriate data collection, analysis methods, and validation approaches.',
      tags: ['methodology', 'design', 'rigor', 'validation'],
      examples: [
        'Design a mixed-methods research approach',
        'Create a statistical analysis methodology',
        'Develop qualitative research methods',
        'Design experimental protocols'
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
  const agentExecutor = new PlanningAgentExecutor();

  // 3. Create DefaultRequestHandler
  const requestHandler = new DefaultRequestHandler(
    planningAgentCard,
    taskStore,
    agentExecutor
  );

  // 4. Create and setup A2AExpressApp
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express(), '');

  // 5. Start the server
  const PORT = process.env.PLANNING_AGENT_PORT ?? 41245;
  expressApp.listen(PORT, () => {
    flowlogger.info(`[PlanningAgent] Server started on http://localhost:${PORT}`);
    flowlogger.info(`[PlanningAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
    flowlogger.info('[PlanningAgent] Press Ctrl+C to stop the server');
  });
}

main().catch((error) => flowlogger.error({ error }, 'PlanningAgent startup failed'));

/**
 * Raw shapes for incoming (untrusted) data used by normalizeResearchPlan.
 * Use unknown-backed fields and narrow them at runtime.
 */
type RawObject = Record<string, unknown>;

interface RawDataSource {
  [k: string]: unknown;
  type?: unknown;
  priority?: unknown;
  credibilityWeight?: unknown;
  estimatedVolume?: unknown;
}

interface RawExecutionStep {
  [k: string]: unknown;
  id?: unknown;
  name?: unknown;
  action?: unknown;
  description?: unknown;
  agentType?: unknown;
  dependencies?: unknown;
  estimatedDuration?: unknown;
  priority?: unknown;
  successCriteria?: unknown;
  fallbackStrategies?: unknown;
}

/** Narrowing helpers */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const asString = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : fallback);

const asNumber = (v: unknown, fallback = NaN): number =>
  typeof v === 'number' ? v : (typeof v === 'string' ? (Number(v) || fallback) : fallback);

const asStringOrNumber = (v: unknown): string | number | undefined =>
  typeof v === 'string' || typeof v === 'number' ? v : undefined;

const mapPriorityValue = (p: unknown): number => {
  const v = asStringOrNumber(p);
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.round(v);
  }
  if (typeof v === 'string') {
    const normalized = v.trim().toLowerCase();
    if (normalized === 'primary') {
      return 1;
    }
    if (normalized === 'secondary') {
      return 2;
    }
    if (normalized === 'tertiary') {
      return 3;
    }
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }
  return 3; // default (medium)
};

/**
 * Normalize a raw plan (e.g., from a planner model) into a ResearchPlan.
 * Accepts:
 *  - Partial<ResearchPlan> (already-typed)
 *  - string (JSON payload)
 *  - Record<string, unknown> (parsed untyped object)
 */
export function normalizeResearchPlan(raw: Partial<ResearchPlan> | string | Record<string, unknown>): ResearchPlan {
  let src: Record<string, unknown> | Partial<ResearchPlan>;
  if (typeof raw === 'string') {
    src = parseResearchPlan(raw);
  } else {
    src = raw;
  }

  const rawDataSources = Array.isArray((src as RawObject).dataSources) ? (src as RawObject).dataSources as unknown[] : [];
  const dataSources: DataSource[] = rawDataSources.length > 0
    ? rawDataSources.map((ds: unknown) => {
        const r = isRecord(ds) ? ds : {};
        const rawType = asString(r.type, 'web');
      const type: DataSource['type'] = isValidDataSourceType(rawType) ? rawType : 'web';
        return {
          type,
          source: asString(r.source, 'Unknown source'),
          priority: mapPriorityValue(r.priority),
          credibilityWeight: typeof r.credibilityWeight === 'number' 
            ? Math.max(0, Math.min(1, r.credibilityWeight)) 
            : 0.5,
          estimatedVolume: (() => {
            const v = r.estimatedVolume;
            if (typeof v === 'string') {
              const norm = v.toLowerCase();
              if (['high', 'medium', 'low'].includes(norm)) {
                return norm as DataSource['estimatedVolume'];
              }
            }
            return 'medium' as const;
          })()
        };
      })
    : [{
        type: 'web' as const,
        source: 'Default source',
        priority: 3,
        credibilityWeight: 0.5,
        estimatedVolume: 'medium' as const,
      }];

  const rawSteps = Array.isArray((src as RawObject).executionSteps) ? (src as RawObject).executionSteps as unknown[] : [];
  const executionSteps = rawSteps.map((s: unknown, i: number) => {
    const r = isRecord(s) ? s as RawExecutionStep : {};
    const id = asString(r.id, `step-${i}`);
    const name = asString(r.name, asString(r.action, `step-${i}`));
    const description = asString(r.description, name);
    const agentType = asString(r.agentType, 'web-research');
    const dependencies = Array.isArray(r.dependencies) ? r.dependencies : [];
    const estimatedDurationRaw = r.estimatedDuration;
    const estimatedDuration = asNumber(estimatedDurationRaw, 1);
    const priority = mapPriorityValue(r.priority);
    const successCriteria = Array.isArray(r.successCriteria)
      ? r.successCriteria.map((c) => asString(c, '')).filter(Boolean).join('; ')
      : asString(r.successCriteria, 'Valid response');
    const fallbackStrategies = Array.isArray(r.fallbackStrategies) ? r.fallbackStrategies : [];

    return {
      id,
      name,
      description,
      agentType: agentType as ResearchStep['agentType'],
      dependencies,
      estimatedDuration,
      priority,
      successCriteria,
      fallbackStrategies,
    } as ResearchStep;
  });

  const srcTyped = src;

  const methodologySrc = isRecord(srcTyped.methodology) ? srcTyped.methodology : undefined;

  const extractMethodologyArray = (field: string, srcTypedLocal: unknown, methodologySrcLocal?: Record<string, unknown>): string[] => {
    const toStringSafe = (v: unknown): string | undefined => {
      if (typeof v === 'string') {
        const t = v.trim();
        return t.length > 0 ? t : undefined;
      }
      if (typeof v === 'number' && Number.isFinite(v)) {
        return String(v);
      }
      return undefined;
    };

    if (methodologySrcLocal && Array.isArray(methodologySrcLocal[field])) {
      return (methodologySrcLocal[field] as unknown[])
        .map(toStringSafe)
        .filter((s): s is string => typeof s === 'string');
    }

    if (isRecord(srcTypedLocal)) {
      const maybeMethod = (srcTypedLocal).methodology;
      if (isRecord(maybeMethod) && Array.isArray(maybeMethod[field])) {
        return (maybeMethod[field] as unknown[])
          .map(toStringSafe)
          .filter((s): s is string => typeof s === 'string');
      }
    }

    return [];
  };

  const plan: ResearchPlan = {
    id: typeof srcTyped.id === 'string' && srcTyped.id.length > 0 ? srcTyped.id : uuidv4(),
    topic: asString(getFirstStringField(srcTyped, 'topic', 'title', 'originalQuery') ?? 'Untitled Research'),
    originalQuery: asString(getFirstStringField(srcTyped, 'originalQuery', 'topic', 'title') ?? ''),
    objectives: Array.isArray(srcTyped.objectives) && srcTyped.objectives.length > 0
      ? (srcTyped.objectives as unknown[]).map((o: unknown) => asString(o, String(o ?? '')))
      : [asString(getFirstStringField(srcTyped, 'objective', 'goal', 'purpose', 'summary') ?? 'Define research objectives')],
    methodology: {
      approach: (methodologySrc && typeof methodologySrc.approach === 'string'
        ? (methodologySrc.approach as ResearchMethodology['approach'])
        : (isRecord(srcTyped) && typeof (srcTyped as Record<string, unknown>).methodology === 'string'
          ? ((srcTyped as Record<string, unknown>).methodology as ResearchMethodology['approach'])
          : 'exploratory')
      ),
      justification: (() => {
        if (methodologySrc && typeof methodologySrc.justification !== 'undefined') {
          return asString(methodologySrc.justification, 'Generated by planner');
        }
        if (isRecord(srcTyped)) {
          const maybeMethodology = (srcTyped as Record<string, unknown>).methodology;
          if (isRecord(maybeMethodology) && typeof maybeMethodology.justification !== 'undefined') {
            return asString(maybeMethodology.justification, 'Generated by planner');
          }
        }
        return 'Generated by planner';
      })(),
      phases: extractMethodologyArray('phases', srcTyped, methodologySrc),
      qualityControls: extractMethodologyArray('qualityControls', srcTyped, methodologySrc),
    },
    dataSources,
    executionSteps,
    riskAssessment: Array.isArray((srcTyped as Record<string, unknown>).riskAssessment) ? (srcTyped as Record<string, unknown>).riskAssessment as RiskFactor[] : [],
    contingencyPlans: Array.isArray((srcTyped as Record<string, unknown>).contingencyPlans) ? (srcTyped as Record<string, unknown>).contingencyPlans as ContingencyPlan[] : [],
    qualityThresholds: Array.isArray((srcTyped as Record<string, unknown>).qualityThresholds) ? (srcTyped as Record<string, unknown>).qualityThresholds as QualityThreshold[] : [],
    estimatedTimeline: asString((srcTyped as Record<string, unknown>).estimatedTimeline ?? (srcTyped as Record<string, unknown>).timeline ?? 'unspecified'),
    version: asString((srcTyped as Record<string, unknown>).version, '1.0'),
    createdAt: (typeof (srcTyped as Record<string, unknown>).createdAt === 'string')
      ? new Date((srcTyped as Record<string, unknown>).createdAt as string)
      : ((srcTyped as Record<string, unknown>).createdAt instanceof Date ? (srcTyped as Record<string, unknown>).createdAt as Date : new Date()),
    updatedAt: (typeof (srcTyped as Record<string, unknown>).updatedAt === 'string')
      ? new Date((srcTyped as Record<string, unknown>).updatedAt as string)
      : ((srcTyped as Record<string, unknown>).updatedAt instanceof Date ? (srcTyped as Record<string, unknown>).updatedAt as Date : new Date()),
  };

  return plan;
}

// Move parseResearchPlan to module scope and return a typed Record rather than `any`
function parseResearchPlan(responseText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(responseText.trim());
    return isRecord(parsed) ? (parsed.researchPlan ?? parsed) as Record<string, unknown> : { researchPlan: parsed } as Record<string, unknown>;
  } catch (e) {
    flowlogger.error({ error: e, responseText }, '[PlanningAgentExecutor] Failed to parse JSON response');
    throw new Error(`Failed to parse research plan: ${e instanceof Error ? e.message : 'Invalid JSON response'}`);
  }
}

/**
 * Type guard for DataSource['type']
 */
function isValidDataSourceType(value: string): value is DataSource['type'] {
  const allowedTypes = ['web', 'academic', 'news', 'social', 'government', 'statistical'] as const;
  return allowedTypes.includes(value as DataSource['type']);
}

// Added helper: safely get the first non-empty string-ish field from an unknown record.
// Avoids casting to `any` and prevents 'Unexpected any' errors by using isRecord narrowing.
function getFirstStringField(obj: unknown, ...keys: string[]): string | undefined {
  if (!isRecord(obj)) {
    return undefined;
  }
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) {
      return v;
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      return String(v);
    }
  }
  return undefined;
}

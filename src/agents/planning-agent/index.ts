import express from "express";
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';  // Removed deprecated ZodTypeAny

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
  RiskFactor
} from "../shared/interfaces.js";
import { QueryAnalyzer } from "./query-analyzer.js";
import { MethodologySelector } from "./methodology-selector.js";
import { DataSourceIdentifier } from "./data-source-identifier.js";
import { StepDecomposer } from "./step-decomposer.js";
import { RiskAssessor } from "./risk-assessor.js";
import { ContingencyPlanner } from "./contingency-planner.js";

// Load the Genkit prompt
const planningPrompt = ai.prompt('planning_agent');

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
    console.log(`ResearchPlanner: Starting research planning for query: "${query}"`);

    try {
      // Step 1: Analyze the research query
      console.log("ResearchPlanner: Analyzing query...");
      const queryAnalysis = this.queryAnalyzer.analyzeQuery(query);
      console.log(`ResearchPlanner: Query analysis complete. Dimensions: ${queryAnalysis.researchDimensions.length}`);

      // Ensure QueryAnalysis includes a timeline (required by generateComprehensivePlan)
      // If the analyzer omitted timeline, provide a sensible default.
      const queryAnalysisWithTimeline: QueryAnalysis = {
        ...(queryAnalysis as unknown as QueryAnalysis & { timeline?: string }),
        timeline: (queryAnalysis as unknown as QueryAnalysis & { timeline?: string }).timeline ?? 'unspecified',
      };

      // Step 2: Select appropriate research methodologies
      console.log("ResearchPlanner: Selecting methodologies...");
      const analysisInput = {
        scopeDimensions: [] as string[], // Default: empty, to be computed in QueryAnalyzer if needed
        knowledgeGaps: [] as string[], // Default: empty
        stakeholderNeeds: [] as string[], // Default: empty
        researchDimensions: queryAnalysisWithTimeline.researchDimensions ?? [] as ResearchDimension[],
        complexity: this.mapComplexityToExpected(queryAnalysisWithTimeline.complexity ?? 'medium'),
        estimatedScope: queryAnalysisWithTimeline.estimatedScope ?? 'broad' as const,
      };
      const methodologies = [this.methodologySelector.selectMethodology(analysisInput, "")];
      console.log(`ResearchPlanner: Selected ${methodologies.length} methodologies`);

      // Ensure we have a valid methodology object with a stable 'approach' field.
      // This avoids "Object is possibly 'undefined'." when accessing methodologies[0].approach.
      const chosenMethodology: ResearchMethodology = methodologies[0] ?? { approach: 'exploratory', justification: '', phases: [], qualityControls: [] };

      // Step 3: Identify and prioritize data sources
      console.log("ResearchPlanner: Identifying data sources...");
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
          priority: typeof r?.priority === 'number' ? r.priority : this.mapPriorityStringToNumber(typeof r?.priority === 'string' ? r.priority : undefined),
          credibilityWeight: typeof r?.credibilityWeight === 'number'
            ? r.credibilityWeight
            : (typeof r?.credibilityWeight === 'string' ? Number(r.credibilityWeight) || 0.5 : 0.5),
          estimatedVolume: (r?.estimatedVolume && (typeof r.estimatedVolume === 'string' || typeof r.estimatedVolume === 'number')) ? r.estimatedVolume : 'medium',
        } as ResearchPlan['dataSources'][number];
      });
      console.log(`ResearchPlanner: Identified ${dataSources.length} data sources`);

      // Step 4: Decompose research into executable steps
      console.log("ResearchPlanner: Decomposing into steps...");
      const researchSteps = this.stepDecomposer.decomposeIntoSteps(queryAnalysis.coreQuestion, chosenMethodology.approach, dataSources, queryAnalysis.researchDimensions, queryAnalysis.estimatedScope);
      console.log(`ResearchPlanner: Created ${researchSteps.length} research steps`);

      // Step 5: Assess risks and create mitigation strategies
      console.log("ResearchPlanner: Assessing risks...");
      // The assessor may return either an array of RiskFactor or an object { risks, contingencyPlans }.
      // Normalize to an array of risk factors so downstream code has a consistent shape.
      const riskAssessmentRaw = this.riskAssessor.assessRisks(
        queryAnalysis.coreQuestion,
        dataSources,
        researchSteps,
        queryAnalysis.estimatedScope || 'unknown',
        chosenMethodology.approach
      );
      const riskFactors = Array.isArray(riskAssessmentRaw)
        ? riskAssessmentRaw
        : (riskAssessmentRaw?.risks ?? []);
      console.log(`ResearchPlanner: Identified ${riskFactors.length} risk factors`);

      // Step 6: Create contingency plans
      console.log("ResearchPlanner: Creating contingency plans...");
      const contingencyPlans = this.contingencyPlanner.createContingencyPlans(riskFactors, dataSources, researchSteps, queryAnalysis.coreQuestion);
      console.log(`ResearchPlanner: Created ${contingencyPlans.length} contingency plans`);

      // Step 7: Generate comprehensive research plan using Genkit
      console.log("ResearchPlanner: Generating final research plan...");
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

      console.log("ResearchPlanner: Research planning complete!");
      return finalPlan;

    } catch (error) {
      console.error("ResearchPlanner: Error during research planning:", error);
      throw new Error(`Research planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate the final comprehensive research plan using Genkit AI
   */
  private async generateComprehensivePlan(
    originalQuery: string,
    queryAnalysis: QueryAnalysis, // <- typed instead of `any`
    methodologies: ResearchMethodology[],
    dataSources: ResearchPlan['dataSources'],
    researchSteps: ResearchStep[],
    riskAssessment: ResearchPlan['riskAssessment'],
    contingencyPlans: ResearchPlan['contingencyPlans']
  ): Promise<ResearchPlan> {
    const comprehensivePlanPrompt = ai.definePrompt({
      name: "comprehensive-research-planning",
      input: {
        // Use explicit Zod shapes; allow extra properties via record
        schema: z.object({
          query: z.string(),
          analysis: z.record(z.string(), z.string()),
          methodologies: z.array(z.record(z.string(), z.string())),
          dataSources: z.array(z.object({
            type: z.enum(['academic', 'web', 'news', 'statistical', 'social', 'government']),
            source: z.string(),
            priority: z.number(),
            credibilityWeight: z.number(),
            estimatedVolume: z.union(z.string(), z.number()),
          })),
          steps: z.array(z.record(z.string(), z.any())), // Use z.any() for steps as they are complex objects
          risks: z.array(z.record(z.string(), z.string())),
          contingencies: z.array(z.record(z.string(), z.string()))
        }) as z.ZodSchema
      },
      output: {
        // Output schema matches the canonical ResearchPlan interface as closely as possible
        schema: z.object({
          id: z.string().optional(),
          topic: z.string().optional(),
          objectives: z.array(z.string()).optional(),
          methodology: z.object({
            approach: z.string(),
            justification: z.string().optional(),
            phases: z.array(z.any()).optional(),
            qualityControls: z.array(z.any()).optional(),
          }).optional(),
          dataSources: z.array(z.object({
            type: z.string(),
            source: z.string(),
            priority: z.number(),
            credibilityWeight: z.number(),
            estimatedVolume: z.union([z.string(), z.number()]),
          })),
          executionSteps: z.array(z.object({
            id: z.string(),
            description: z.string(),
            agentType: z.string(),
            dependencies: z.array(z.any()),
            estimatedDuration: z.union([z.string(), z.number()]),
            priority: z.number(),
            successCriteria: z.union([z.string(), z.array(z.string())]),
            fallbackStrategies: z.array(z.any()),
          })),
          riskAssessment: z.array(z.any()),
          contingencyPlans: z.array(z.any()),
          qualityThresholds: z.array(z.any()),
          estimatedTimeline: z.string(),
          version: z.string().optional(),
          createdAt: z.union([z.string(), z.date()]).optional(),
          updatedAt: z.union([z.string(), z.date()]).optional(),
          originalQuery: z.string().optional(),
        })
      },
      prompt: `
You are an expert research strategist. Based on the comprehensive analysis provided, create a detailed research execution plan.

Original Query: {{query}}

Analysis Summary:
- Dimensions: {{analysis.dimensions}}
- Complexity: {{analysis.complexity}}
- Timeline: {{analysis.timeline}}

Selected Methodologies: {{methodologies}}

Available Data Sources: {{dataSources}}

Research Steps: {{steps}}

Risk Assessment: {{risks}}

Contingency Plans: {{contingencies}}

Create a comprehensive research plan that integrates all this information into a cohesive execution strategy. Focus on:

1. Clear objective and success criteria
2. Logical step sequencing with dependencies
3. Agent assignments for each step
4. Risk mitigation strategies
5. Realistic timeline estimates
6. Quality assurance measures

Ensure the plan is actionable and accounts for parallel execution where possible.`
    });

    const result = await comprehensivePlanPrompt({
      query: originalQuery,
      analysis: queryAnalysis,
      methodologies,
      dataSources,
      steps: researchSteps,
      risks: riskAssessment,
      contingencies: contingencyPlans
    });

    // Transform the result into our ResearchPlan interface
    const title = result.output?.title ?? 'Untitled Research Plan';
    return {
      id: `plan-${Date.now()}`,
      objectives: [title, ...(result.output?.objectives ?? [])], // Prepend title to objectives for preservation
      methodology: {
        approach: this.mapMethodologyStringToEnum(result.output?.methodology), // Convert string to ResearchMethodology enum
        justification: 'Generated by AI',
        phases: [],
        qualityControls: []
      },
      dataSources: result.output?.dataSources?.map((ds: string) => ({
        type: 'web',
        source: ds,
        priority: 3,
        credibilityWeight: 0.7,
        estimatedVolume: 'medium'
      })) ?? [], // Convert string array to DataSource array (simplified)
      executionSteps: result.output?.executionSteps?.map((step: {
        id: string;
        description: string;
        agent: string;
        dependencies?: unknown[];
        estimatedDuration?: string | number;
        priority?: string;
        successCriteria?: string | string[];
        fallbackStrategies?: unknown[];
      }) => ({ // Map to ResearchStep interface
        id: step.id,
        description: step.description,
        agentType: step.agent as ResearchStep['agentType'], // Cast to correct agentType
        dependencies: step.dependencies ?? [], // Ensure dependencies is an array
        estimatedDuration: step.estimatedDuration,
        priority: step.priority, // Removed redundant assertion
        successCriteria: step.successCriteria ?? 'N/A', // Add missing property
        fallbackStrategies: step.fallbackStrategies ?? [], // Add missing property
      })) ?? [], // Ensure it's always an array of ResearchStep
      riskAssessment: [], // The prompt output 'riskMitigation' is not directly mapped to ResearchPlan's 'riskAssessment' which is an array of RiskFactor.
      contingencyPlans: [], // Placeholder
      qualityThresholds: [], // Placeholder
      // Added required fields from ResearchPlan type
      topic: result.output?.title ?? originalQuery,
      estimatedTimeline: typeof result.output?.timeline === 'string'
        ? result.output.timeline
        : (queryAnalysis?.timeline ?? 'unspecified'),
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      // Removed invalid 'status' property — ResearchPlan type does not include 'status'.
    };
  }

  /**
   * Maps a string methodology to a ResearchMethodology enum value.
   * @param methodologyString The methodology as a string.
   * @returns The corresponding ResearchMethodology enum value.
   */
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

  /**
   * Maps a string priority ('high', 'medium', 'low') to a number (1, 3, 5).
   * @param priorityString The priority as a string.
   * @returns The priority as a number.
   */
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
}

/**
 * PlanningAgentExecutor implements the agent's core logic for research planning and strategy development.
 */
class PlanningAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private researchPlanner: ResearchPlanner;

  constructor() {
    this.researchPlanner = new ResearchPlanner();
  }

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus,
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
    // Publish immediate cancellation event
    const cancelledUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId, // shorthand
      contextId: uuidv4(), // generated value stays as-is
      status: {
        state: 'canceled',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: 'Research planning cancelled.' }],
          taskId, // shorthand
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
      `[PlanningAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId}, research: ${researchId})`
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
      console.warn(
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
      console.log(`[PlanningAgentExecutor] Starting comprehensive planning for: "${userQuery}"`);
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
        console.log(`[PlanningAgentExecutor] Request cancelled for task: ${taskId}`);
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
      console.error(`[PlanningAgentExecutor] Error processing task ${taskId}:`, error);
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
      console.error('[PlanningAgentExecutor] Failed to parse JSON response:', e);
      console.error('[PlanningAgentExecutor] Raw response:', responseText);
      // Don't use fake fallback - return error information
      throw new Error(`Failed to parse research plan: ${e instanceof Error ? e.message : 'Invalid JSON response'}`);
    }
  }
}

// --- Server Setup ---

const planningAgentCard: AgentCard = {
  protocolVersion: '1.0',
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
  securitySchemes: {},
  security: [],
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  skills: [
    {
      id: 'research_planning',
      name: 'Research Planning',
      description:
        'Creates systematic research strategies with methodology design, data source mapping, execution planning, and risk management.',
      tags: ['planning', 'strategy', 'methodology', 'research'],
      examples: [
        'Develop a research plan for market analysis',
        'Create an investigation strategy for technical issues',
        'Design a systematic review methodology',
        'Plan multi-disciplinary research approaches',
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
    console.log(`[PlanningAgent] Server started on http://localhost:${PORT}`);
    console.log(`[PlanningAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
    console.log('[PlanningAgent] Press Ctrl+C to stop the server');
  });
}

main().catch(console.error);

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
  if (typeof p === 'number' && Number.isFinite(p)) {
    return Math.round(p);
  }
  if (typeof p === 'string') {
    const normalized = p.trim().toLowerCase();
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

// Added helper: safely get the first non-empty string-ish field from an unknown record.
// Avoids casting to `any` and prevents "Unexpected any" errors by using isRecord narrowing.
const getFirstStringField = (obj: unknown, ...keys: string[]): string | undefined => {
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
};

/**
 * Normalize a raw plan (e.g., from a planner model) into a ResearchPlan.
 * Accepts:
 *  - Partial<ResearchPlan> (already-typed)
 *  - string (JSON payload)
 *  - Record<string, unknown> (parsed untyped object)
 */
export function normalizeResearchPlan(raw: Partial<ResearchPlan> | string | Record<string, unknown>): ResearchPlan {
  // If the input is a string, parse it using the module-scoped parser.
  let src: Record<string, unknown> | Partial<ResearchPlan>;
  if (typeof raw === 'string') {
    src = parseResearchPlan(raw);
  } else {
    src = raw;
  }

  // Normalize dataSources
  const rawDataSources = Array.isArray((src as RawObject).dataSources) ? (src as RawObject).dataSources as unknown[] : [];
  const dataSources = rawDataSources.length > 0
    ? rawDataSources.map((ds: unknown) => {
      const r = isRecord(ds) ? ds as RawDataSource : {};
      const allowedTypes = ['academic', 'web', 'news', 'statistical', 'social', 'government'] as const;
      const type = allowedTypes.includes(asString(r.type, 'web') as any) ? asString(r.type, 'web') as ResearchPlan['dataSources'][number]['type'] : 'web';
      return { // Cast to ResearchPlan['dataSources'][number]
        type: asString(r.type, 'web'),
        priority: mapPriorityValue(r.priority),
        credibilityWeight: typeof r.credibilityWeight === 'number' ? r.credibilityWeight : (typeof r.credibilityWeight === 'string' ? Number(r.credibilityWeight) || 0.5 : 0.5),
        estimatedVolume: (() => {
          const v = r.estimatedVolume;
          if (typeof v === 'number') {
            return v;
          }
          if (typeof v === 'string') {
            const n = Number(v);
            return Number.isFinite(n) ? n : v;
          }
          return 'unknown';
        })(),
      };
    })
    : [{
      type: 'web',
      priority: 3,
      credibilityWeight: 0.5,
      estimatedVolume: 'unknown',
    }];

  // Normalize executionSteps
  const rawSteps = Array.isArray((src as RawObject).executionSteps) ? (src as RawObject).executionSteps as unknown[] : [];
  const executionSteps = rawSteps.map((s: unknown, i: number) => {
    const r = isRecord(s) ? s as RawExecutionStep : {};
    const id = asString(r.id, `step-${i}`);
    const name = asString(r.name, asString(r.action, `step-${i}`));
    const description = asString(r.description, name);
    const agentType = asString(r.agentType, 'web-research');
    const dependencies = Array.isArray(r.dependencies) ? r.dependencies : [];
    const estimatedDurationRaw = r.estimatedDuration;
    const estimatedDuration = typeof estimatedDurationRaw === 'number'
      ? estimatedDurationRaw
      : (typeof estimatedDurationRaw === 'string' ? (Number(estimatedDurationRaw) || estimatedDurationRaw) : 1);
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
      priority, // Removed redundant assertion
      successCriteria,
      fallbackStrategies,
    } as ResearchStep;
  });

  // Build final ResearchPlan with safe coercions
  const srcTyped = src;

  // If methodology is a loose object, narrow it with isRecord()
  const methodologySrc = isRecord((Boolean((src as unknown))) && (src as Record<string, unknown>).methodology)
    ? (src as Record<string, unknown>).methodology as Record<string, unknown>
    : undefined;

  // Added helper: safely extract an array field from a loose `methodology` object
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

    // Priority: explicitly-parsed methodology record (methodologySrcLocal)
    if (methodologySrcLocal && Array.isArray(methodologySrcLocal[field])) {
      return (methodologySrcLocal[field] as unknown[])
        .map(toStringSafe)
        .filter((s): s is string => typeof s === 'string');
    }

    // Fallback: check if top-level src has a methodology record with the field
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
    // Use the typed helper to avoid `any` casts when reading loose fields like `title`.
    topic: asString(getFirstStringField(srcTyped, 'topic', 'title', 'originalQuery') ?? 'Untitled Research'),
    originalQuery: asString(getFirstStringField(srcTyped, 'originalQuery', 'topic', 'title') ?? ''),
    objectives: Array.isArray(srcTyped.objectives) && srcTyped.objectives.length > 0
      ? (srcTyped.objectives as unknown[]).map((o: unknown) => asString(o, String(o ?? '')))
      : [asString(getFirstStringField(srcTyped, 'objective', 'goal', 'purpose', 'summary') ?? 'Define research objectives')],
    methodology: {
      approach: (methodologySrc && typeof methodologySrc.approach === 'string'
        ? (methodologySrc.approach as ResearchMethodology['approach'])
        : (
          // Safe narrowing: ensure srcTyped is a record before reading .methodology as string.
          isRecord(srcTyped) && typeof (srcTyped as Record<string, unknown>).methodology === 'string'
            ? ((srcTyped as Record<string, unknown>).methodology as ResearchMethodology['approach'])
            : 'exploratory'
        )
      ),
      // Changed: avoid `any` by narrowing possible shapes and using asString helper
      justification: (() => {
        // If methodologySrc is a record and has a justification, use it
        if (methodologySrc && typeof methodologySrc.justification !== 'undefined') {
          return asString(methodologySrc.justification, 'Generated by planner');
        }
        // If srcTyped.methodology is a record, try to read justification from there
        if (isRecord(srcTyped)) {
          const maybeMethodology = (srcTyped as Record<string, unknown>).methodology;
          if (isRecord(maybeMethodology) && typeof maybeMethodology.justification !== 'undefined') {
            return asString(maybeMethodology.justification, 'Generated by planner');
          }
        }
        // Fallback
        return 'Generated by planner';
      })(),
      // Use safe extractor to avoid `any` casts and rely on `isRecord` narrowing.
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
    createdAt: (srcTyped as Record<string, unknown>).createdAt ? new Date((srcTyped as Record<string, unknown>).createdAt as string) : new Date(),
    updatedAt: (srcTyped as Record<string, unknown>).updatedAt ? new Date((srcTyped as Record<string, unknown>).updatedAt as string) : new Date(),
  };

  return plan;
}

// Move parseResearchPlan to module scope and return a typed Record rather than `any`
function parseResearchPlan(responseText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(responseText.trim());
    return isRecord(parsed) ? (parsed.researchPlan ?? parsed) as Record<string, unknown> : { researchPlan: parsed } as Record<string, unknown>;
  } catch (e) {
    console.error('[PlanningAgentExecutor] Failed to parse JSON response:', e);
    console.error('[PlanningAgentExecutor] Raw response:', responseText);
    throw new Error(`Failed to parse research plan: ${e instanceof Error ? e.message : 'Invalid JSON response'}`);
  }
}

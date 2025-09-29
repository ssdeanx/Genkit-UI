import express from "express";
import { v4 as uuidv4 } from 'uuid';

import type { MessageData } from "genkit";
import type {
  AgentCard,
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  TextPart,
} from "@a2a-js/sdk";
import {
  InMemoryTaskStore,
  type TaskStore,
  type AgentExecutor,
  type RequestContext,
  type ExecutionEventBus,
  DefaultRequestHandler,
} from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";
import { ai } from "./genkit.js";
import type {
  OrchestrationState,
  ResearchPlan,
  OrchestrationDecision,
  ResearchStepResult
} from "../shared/interfaces.js";
import { TaskDelegator } from "./task-delegator.js";
import { A2ACommunicationManager } from "./a2a-communication.js";
import { ErrorRecovery } from "./error-recovery.js";
import { log } from './logger.js';

/* use centralized logger */

function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}
if (process.env.GEMINI_API_KEY === undefined || process.env.GEMINI_API_KEY === '') {
  if (isTestEnvironment()) {
    log('warn', 'GEMINI_API_KEY not set; continuing in test environment.');
    // Early return: do not exit in test environment
  } else {
    log('error', "GEMINI_API_KEY environment variable not set.");
    process.exit(1);
  }
}

// Load the Genkit prompt
const orchestratorPrompt = ai.prompt('orchestrator');

/**
 * OrchestratorAgentExecutor implements the agent's core logic for coordinating research tasks.
 */
class OrchestratorAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private researchStates = new Map<string, OrchestrationState>();
  private taskDelegator: TaskDelegator;
  private taskStore: TaskStore;
  private errorRecovery: ErrorRecovery;

  constructor(taskDelegator: TaskDelegator, taskStore: TaskStore) {
    this.taskDelegator = taskDelegator;
    this.taskStore = taskStore;
    this.errorRecovery = new ErrorRecovery(taskDelegator);
  }



  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus,
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
    // Update research state to cancelled
    const state = this.researchStates.get(taskId);
    if (state) {
      state.activeSteps.forEach(step => {
        if (step.status === 'running') {
          step.status = 'cancelled';
          step.completedAt = new Date();
        }
      });
      this.researchStates.set(taskId, state);
    }
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
          parts: [{ kind: 'text', text: 'Research orchestration cancelled.' }],
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
    const researchId = taskId;

    log('log',
      `Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
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
        // Ensure metadata is never undefined to satisfy Task type with strict optional typing
        metadata: (userMessage.metadata ?? {}) as { [k: string]: unknown },
        artifacts: [],
      };
      eventBus.publish(initialTask);
      // Store the initial task in the task store for persistence
      await this.taskStore.save(initialTask);
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
          parts: [{ kind: 'text', text: 'Coordinating research execution...' }],
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
      .map((m) => {
        const role = m.role === 'agent' ? 'model' : 'user';
        return {
          role,
          content: m.parts
            .filter((p): p is TextPart => p.kind === 'text' && p.text !== null && p.text !== undefined)
            .map((p) => ({
              text: p.text,
            })),
        } as MessageData;
      })
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
      log('warn',
        `No valid text messages found in history for task ${taskId}.`
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
      // 4. Initialize or load research state
      let researchState = this.researchStates.get(researchId) ?? await this.loadOrchestrationState(existingTask?.metadata);
      if (!researchState) {
        // This is the first message - expect a research plan from planning agent
        // For now, create a basic state structure
        researchState = {
          researchId,
          plan: {} as ResearchPlan, // Will be populated from planning agent
          currentPhase: 'planning',
          activeSteps: [],
          completedSteps: [],
          issues: [],
          progress: {
            completedSteps: 0,
            totalSteps: 0,
            estimatedTimeRemaining: 0,
            overallConfidence: 0.5,
          },
          startedAt: new Date(),
          lastUpdated: new Date(),
        };
        this.researchStates.set(researchId, researchState);
      }

      // 5. Run the Genkit prompt for orchestration decisions
      const currentStateSummary = JSON.stringify({
        currentPhase: researchState.currentPhase,
        activeTasks: researchState.activeSteps.map(s => ({
          id: s.stepId,
          agentType: s.agentId,
          status: s.status,
        })),
        completedTasks: researchState.completedSteps.length,
        issues: researchState.issues.length,
        progress: researchState.progress,
      });

      const response = await orchestratorPrompt(
        {
          currentState: currentStateSummary,
          pendingTasks: 'Analyze current research needs and assign appropriate agents',
          now: new Date().toISOString()
        },
        { messages }
      );

      // 6. Parse orchestration decision from response
      let orchestrationDecision = this.parseOrchestrationDecision(response.text);

      // 7. Update research state based on decision
      this.updateResearchState(researchState, orchestrationDecision);

      // Persist updated state
      if (existingTask?.metadata) {
        this.persistOrchestrationState(existingTask.metadata as Record<string, unknown>, researchState);
      }

      // 8. Publish status update with orchestration results
      const statusUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'working',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{
              kind: 'text',
              text: `Orchestration update: ${orchestrationDecision.nextActions?.length ?? 0} actions planned, ${orchestrationDecision.activeTasks?.length ?? 0} tasks active`
            }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: false,
      };
      eventBus.publish(statusUpdate);

      // Check if cancelled
      if (this.cancelledTasks.has(taskId)) {
        log('log', `Request cancelled for task: ${taskId}`);
        const cancelledUpdate: TaskStatusUpdateEvent = {
          kind: 'status-update',
          taskId,
          contextId,
          status: {
            state: 'canceled',
            message: {
              kind: 'message',
              role: 'agent',
              messageId: uuidv4(),
              parts: [{ kind: 'text', text: 'Research orchestration cancelled.' }],
              taskId,
              contextId,
            },
            timestamp: new Date().toISOString(),
          },
          final: true,
        };
        eventBus.publish(cancelledUpdate);
        return;
      }

      // 9. Orchestration loop: Process decisions and delegate actions
      let cycleCount = 0;
      const maxCycles = 5; // Limit to prevent infinite loops
      let shouldContinue = true;

      while (shouldContinue && cycleCount < maxCycles) {
        cycleCount++;

        // Delegate nextActions if present
        if (orchestrationDecision.nextActions?.length > 0) {
          // Simulate a basic research plan if not yet available (for initial testing)
          if (Object.keys(researchState.plan).length === 0) {
            const firstPartText = (userMessage.parts[0] as TextPart)?.text ?? 'Unknown query';
            researchState.plan = {
              id: researchId,
              originalQuery: firstPartText,
              topic: 'Sample research topic', // Extract from prompt or user message in full impl
              objectives: ['Gather initial data'],
              methodology: {
                approach: 'exploratory',
                justification: 'Initial exploration for broad coverage',
                phases: ['data collection', 'analysis'],
                qualityControls: ['source validation', 'cross-reference']
              },
              // Conform to DataSource.estimatedVolume : 'high' | 'medium' | 'low'
              dataSources: [{
                type: 'web',
                priority: 1, // numeric priority (1-5)
                credibilityWeight: 0.6,
                estimatedVolume: 'medium'
              }],
              executionSteps: orchestrationDecision.nextActions.map((action, index) => ({
                // Match ResearchStep interface shape
                id: `step-${cycleCount}-${index}`,
                description: action.description ?? action.action,
                agentType: 'web-research' as const,
                dependencies: [],
                estimatedDuration: action.priority ?? 1,
                successCriteria: 'Valid response',
                fallbackStrategies: [],
                priority: action.priority ?? 3
              })),
              riskAssessment: [],
              contingencyPlans: [],
              qualityThresholds: [], // conforms to QualityThreshold[]
              estimatedTimeline: '10 minutes',
              updatedAt: new Date(),
              createdAt: new Date(),
              version: '1.0',
            };
          }

          // Delegate steps from plan based on nextActions
          const executableSteps = researchState.plan.executionSteps.filter(step =>
            orchestrationDecision.nextActions?.some(action => action.action.includes(step.description)) ?? false
          );

          if (executableSteps.length > 0) {
            const executions = await this.taskDelegator.delegateResearchSteps(
              executableSteps,
              researchState
            );

            // Update active steps
            researchState.activeSteps.push(...executions);
            researchState.progress.totalSteps = researchState.plan.executionSteps.length;

            // Publish delegation update
            const delegationUpdate: TaskStatusUpdateEvent = {
              kind: 'status-update',
              taskId,
              contextId,
              status: {
                state: 'working',
                message: {
                  kind: 'message',
                  role: 'agent',
                  messageId: uuidv4(),
                  parts: [{
                    kind: 'text',
                    text: `Delegated ${executions.length} actions: ${executions.map(e => e.agentId).join(', ')}`
                  }],
                  taskId,
                  contextId,
                },
                timestamp: new Date().toISOString(),
              },
              final: false,
            };
            eventBus.publish(delegationUpdate);
          }
        }

        // Check for completion conditions
        const completedPercentage = researchState.progress.totalSteps > 0 
          ? (researchState.progress.completedSteps / researchState.progress.totalSteps) * 100 
          : 0;
        if (completedPercentage >= 100 || (orchestrationDecision.nextActions?.length ?? 0) === 0) {
          shouldContinue = false;
        } else {
          // Re-run prompt for next decision (simplified; in full, wait for agent responses)
          const updatedSummary = JSON.stringify({
            currentPhase: researchState.currentPhase,
            activeTasks: researchState.activeSteps,
            completedTasks: researchState.completedSteps.length,
            issues: researchState.issues,
            progress: researchState.progress,
          });

          const nextResponse = await orchestratorPrompt(
            {
              currentState: updatedSummary,
              pendingTasks: 'Review progress and plan next actions',
              now: new Date().toISOString()
            },
            { messages: [...messages, { role: 'model' as const, content: [{ text: response.text }] }] }
          );

          orchestrationDecision = this.parseOrchestrationDecision(nextResponse.text);
          this.updateResearchState(researchState, orchestrationDecision);

          // Publish cycle update
          const cycleUpdate: TaskStatusUpdateEvent = {
            kind: 'status-update',
            taskId,
            contextId,
            status: {
              state: 'working',
              message: {
                kind: 'message',
                role: 'agent',
                messageId: uuidv4(),
                parts: [{
                  kind: 'text',
                  text: `Cycle ${cycleCount}: ${completedPercentage.toFixed(1)}% complete, ${orchestrationDecision.issues?.length ?? 0} issues`
                }],
                taskId,
                contextId,
              },
              timestamp: new Date().toISOString(),
            },
            final: false,
          };
          eventBus.publish(cycleUpdate);
        }
      }

      // 9.5. Aggregate artifacts from completed delegated tasks
      await this.aggregateTaskArtifacts(taskId, contextId, researchState, eventBus);

      // 10. Final completion (or timeout)
      const finalProgress = researchState.progress.totalSteps > 0 
        ? (researchState.progress.completedSteps / researchState.progress.totalSteps) * 100 
        : 0;
      const completionUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'completed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{
              kind: 'text',
              text: `Orchestration complete after ${cycleCount} cycles. Final progress: ${finalProgress.toFixed(1)}%, Phase: ${researchState.currentPhase}`
            }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(completionUpdate);

      // Store the completed task in the task store for persistence
      const completedTask: Task = {
        kind: 'task',
        id: taskId,
        contextId,
        status: {
          state: 'completed',
          timestamp: new Date().toISOString(),
        },
        history: existingTask?.history ?? [userMessage],
        metadata: existingTask?.metadata ?? {},
        artifacts: [],
      };
      await this.taskStore.save(completedTask);

    } catch (error) {
      log('error', `Error processing task ${taskId}:`, error);

      // Classify the error for better reporting
      const failureType = this.errorRecovery['classifyFailure'](error);

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
            parts: [{ kind: 'text', text: `Orchestration failed (${failureType}): ${error instanceof Error ? error.message : 'Unknown error'}` }],
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

  /**
   * Persist orchestration state in task metadata for recovery
   */
  private persistOrchestrationState(taskMetadata: Record<string, unknown>, researchState: OrchestrationState): void {
    try {
      taskMetadata.orchestrationState = JSON.stringify(researchState);
      taskMetadata.lastOrchestrationUpdate = new Date().toISOString();
      log('log', `Persisted orchestration state in metadata`);
    } catch (error) {
      log('warn', `Failed to persist orchestration state:`, error);
    }
  }

  /**
   * Load orchestration state from task metadata
   */
  private loadOrchestrationState(taskMetadata: Record<string, unknown> | undefined): OrchestrationState | null {
    try {
      const orchestrationState = taskMetadata?.orchestrationState;
      if (typeof orchestrationState === 'string') {
        const parsed = JSON.parse(orchestrationState) as unknown as Record<string, unknown>;
        // Reconstruct dates from strings
        if ((Boolean(parsed.startedAt)) && typeof parsed.startedAt === 'string') {
          parsed.startedAt = new Date(parsed.startedAt);
        }
        if ((Boolean(parsed.lastUpdated)) && typeof parsed.lastUpdated === 'string') {
          parsed.lastUpdated = new Date(parsed.lastUpdated);
        }
        if ((Boolean(parsed.plan)) && typeof parsed.plan === 'object' && parsed.plan !== null) {
          const plan = parsed.plan as Record<string, unknown>;
          if ((Boolean(plan.createdAt)) && typeof plan.createdAt === 'string') {
            plan.createdAt = new Date(plan.createdAt);
          }
          if ((Boolean(plan.updatedAt)) && typeof plan.updatedAt === 'string') {
            plan.updatedAt = new Date(plan.updatedAt);
          }
        }

        log('log', `Loaded orchestration state from metadata`);
        return parsed as unknown as OrchestrationState;
      }
    } catch (error) {
      log('warn', `Failed to load orchestration state from metadata:`, error);
    }
    return null;
  }
  private async aggregateTaskArtifacts(
    taskId: string,
    contextId: string,
    researchState: OrchestrationState,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    for (const stepResult of researchState.completedSteps) {
      try {
        // Extract artifacts from the step result data
        const artifacts = this.extractArtifactsFromStepResult(stepResult);

        // Publish each artifact
        for (const artifact of artifacts) {
          const artifactUpdate: TaskArtifactUpdateEvent = {
            kind: 'artifact-update',
            taskId,
            contextId,
            artifact: {
              artifactId: `${stepResult.stepId}-${artifact.name}`,
              name: artifact.name,
              parts: artifact.parts,
            },
            append: false,
            lastChunk: true,
          };
          eventBus.publish(artifactUpdate);
        }

        log('log', `Published ${artifacts.length} artifacts from step ${stepResult.stepId}`);
      } catch (error) {
        log('warn', `Failed to aggregate artifacts from step ${stepResult.stepId}:`, error);
      }
    }
  }

  /**
   * Extract artifacts from a research step result
   */
  private extractArtifactsFromStepResult(stepResult: ResearchStepResult): Array<{name: string, parts: TextPart[]}> {
    const artifacts: Array<{name: string, parts: TextPart[]}> = [];

    try {
      const { data, stepId } = stepResult;

      if (data === null) {
        return artifacts;
      }

      // Handle different result types based on the data structure
      if (typeof data === 'object' && data !== null) {
        const dataObj = data as Record<string, unknown>;

        // Handle code generation results (files array)
        if ('files' in dataObj && Array.isArray(dataObj.files)) {
          for (const file of dataObj.files) {
            if (file !== null && typeof file === 'object' && 'filename' in file && 'content' in file) {
              const fileObj = file as Record<string, unknown>;
              artifacts.push({
                name: String(fileObj.filename ?? `file-${artifacts.length}`),
                parts: [{ kind: 'text', text: String(fileObj.content ?? '') }],
              });
            }
          }
        }
        // Handle research findings
        else if ('findings' in dataObj && Array.isArray(dataObj.findings)) {
          artifacts.push({
            name: `research-findings-${stepId}`,
            parts: [{ kind: 'text', text: JSON.stringify(dataObj.findings, null, 2) }],
          });
        }
        // Handle data analysis results
        else if ('data' in dataObj) {
          artifacts.push({
            name: `analysis-data-${stepId}`,
            parts: [{ kind: 'text', text: JSON.stringify(dataObj.data, null, 2) }],
          });
        }
        // Handle synthesis results
        else if ('synthesis' in dataObj) {
          artifacts.push({
            name: `synthesis-${stepId}`,
            parts: [{ kind: 'text', text: String(dataObj.synthesis) }],
          });
        }
        // Handle sources
        else if ('sources' in dataObj && Array.isArray(dataObj.sources)) {
          artifacts.push({
            name: `sources-${stepId}`,
            parts: [{ kind: 'text', text: JSON.stringify(dataObj.sources, null, 2) }],
          });
        }
      }

      // If no specific structure matched, create a generic artifact
      if (artifacts.length === 0) {
        artifacts.push({
          name: `result-${stepId}`,
          parts: [{ kind: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
        });
      }

    } catch (error) {
      log('warn', `Error extracting artifacts from step result ${stepResult.stepId}:`, error);
    }

    return artifacts;
  }

  private parseOrchestrationDecision(responseText: string): OrchestrationDecision {
    try {
      // Try to parse JSON response
      const parsed = JSON.parse(responseText);
      return parsed.orchestrationDecision ?? (parsed as unknown as OrchestrationDecision);
    } catch (error) {
      // Fallback: create a basic decision structure
      log('warn', 'Could not parse orchestration decision as JSON, using fallback', error);
      return {
        researchId: '',
        timestamp: new Date().toISOString(),
        currentPhase: 'execution',
        activeTasks: [],
        completedTasks: [],
        issues: [],
        progressMetrics: {
          completedSteps: 0,
          totalSteps: 1,
          estimatedTimeRemaining: 30,
          overallConfidence: 0.5,
          qualityScore: 0.8,
        },
        nextActions: [{
          action: 'monitor-progress',
          description: 'Continue monitoring research progress',
          priority: 3,
          estimatedImpact: 'Maintain research momentum',
        }],
      } as OrchestrationDecision;
    }
  }

  private updateResearchState(state: OrchestrationState, decision: OrchestrationDecision): void {
    state.currentPhase = decision.currentPhase ?? state.currentPhase;
    state.lastUpdated = new Date();

    if ('progressMetrics' in decision && decision.progressMetrics !== null && decision.progressMetrics !== undefined) {
      state.progress = {
        completedSteps: decision.progressMetrics.completedSteps ?? state.progress.completedSteps,
        totalSteps: decision.progressMetrics.totalSteps ?? state.progress.totalSteps,
        estimatedTimeRemaining: decision.progressMetrics.estimatedTimeRemaining ?? state.progress.estimatedTimeRemaining,
        overallConfidence: decision.progressMetrics.overallConfidence ?? state.progress.overallConfidence,
      };
    }

    if ('issues' in decision && decision.issues !== null && decision.issues !== undefined && Array.isArray(decision.issues)) {
      decision.issues.forEach((issue) => {
        state.issues.push({
          id: uuidv4(),
          type: (issue.type as "agent-failure" | "data-quality" | "dependency-blocked" | "resource-exhausted" | "timeout") ?? 'agent-failure',
          severity: issue.severity ?? 'medium',
          description: issue.description ?? 'Issue detected',
          affectedSteps: issue.affectedTasks ?? [],
          createdAt: new Date(),
        });
      });
    }
  }
}

// --- Server Setup ---

const orchestratorAgentCard: AgentCard = {
  // A2A protocol version must match the SDK major/minor we target
  // Aligning to @a2a-js/sdk v0.3.4
  protocolVersion: '0.3.0',
  name: 'Research Orchestrator Agent',
  description:
    'An agent that coordinates multi-agent research execution, manages research state, and optimizes task distribution across specialized research agents.',
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
      id: 'research_orchestration',
      name: 'Research Orchestration',
      description:
        'Coordinates complex research tasks across multiple specialized agents, managing dependencies, quality assurance, and progress tracking.',
      tags: ['research', 'coordination', 'multi-agent', 'planning', 'orchestration'],
      examples: [
        'Execute this research plan across web, academic, and news research agents.',
        'Monitor research progress and reassign tasks based on agent performance.',
        'Synthesize findings from multiple research streams into coherent results.',
        'Coordinate parallel research tasks with dependency management.'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    },
    {
      id: 'task_delegation',
      name: 'Task Delegation',
      description:
        'Intelligently delegates research tasks to appropriate specialized agents based on task requirements and agent capabilities.',
      tags: ['delegation', 'task-management', 'optimization', 'routing'],
      examples: [
        'Delegate web research tasks to the web research agent',
        'Assign academic paper analysis to the academic research agent',
        'Route news monitoring tasks to the news research agent'
      ],
      inputModes: ['text/plain'],
      outputModes: ['text/plain'],
    },
    {
      id: 'quality_assurance',
      name: 'Quality Assurance',
      description:
        'Validates research outputs, ensures consistency across agents, and provides quality metrics for research tasks.',
      tags: ['quality', 'validation', 'metrics', 'assurance'],
      examples: [
        'Validate the quality of research findings from multiple sources',
        'Check consistency across different research agent outputs',
        'Generate quality metrics for completed research tasks'
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

  // 2. Create A2A Communication Manager
  const a2aManager = new A2ACommunicationManager();

  // 3. Create Task Delegator
  const taskDelegator = new TaskDelegator(a2aManager);

  // 4. Create AgentExecutor
  const agentExecutor: AgentExecutor = new OrchestratorAgentExecutor(taskDelegator, taskStore);

  // 5. Create DefaultRequestHandler
  const requestHandler = new DefaultRequestHandler(
    orchestratorAgentCard,
    taskStore,
    agentExecutor
  );

  // 6. Create and setup A2AExpressApp
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express(), '');

  // 7. Start the server
  const PORT = process.env.ORCHESTRATOR_AGENT_PORT ?? 41243;
  expressApp.listen(PORT, () => {
    log('log', `Server started on http://localhost:${PORT}`);
    log('log', `Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
    log('log', 'Press Ctrl+C to stop the server');
  });
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    log('error', 'Failed to start server:', error);
  });
}

export { OrchestratorAgentExecutor };
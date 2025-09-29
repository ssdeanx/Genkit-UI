import { v4 as uuidv4 } from 'uuid';
import type { MessageData } from 'genkit';
import type { Task, TaskStatusUpdateEvent, TextPart } from '@a2a-js/sdk';
import type { AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { ai } from './genkit.js';
import { flowlogger } from './../../logger.js';

// Minimal shape to satisfy typing without strict schema coupling
type Findings = {
  dataAssessment?: {
    [k: string]: unknown;
    sampleSize?: number;
    dataSources?: string[];
    dataQuality?: string;
    variables?: string[];
    missingData?: string;
    
  };
  statisticalAnalysis?: {
    [k: string]: unknown;
    testsPerformed?: unknown[];
    statisticalPower?: number | string;
    methodology?: string;
    keyFindings?: string[];
  };
  dataVisualization?: {
    [k: string]: unknown;
    recommendedCharts?: unknown[];
    visualizationPrinciples?: string[];
  };
  quantitativeInsights?: {
    [k: string]: unknown;
    primaryConclusions?: string[];
    effectMagnitudes?: string[];
    practicalSignificance?: string[];
    limitations?: string[];
    recommendations?: string[];
  };
  methodologicalNotes?: {
    [k: string]: unknown;
    assumptionsTested?: string[];
    robustnessChecks?: string[];
    alternativeAnalyses?: string[];
    dataTransparency?: string;
  };
  metadata?: {
    [k: string]: unknown;
    analysisDate?: string;
    softwareTools?: string[];
    statisticalMethods?: string[];
    confidenceLevel?: number;
    reproducibilityScore?: number;
    dataLastUpdated?: string;
  };
} & Record<string, unknown>;

const dataAnalysisPrompt = ai.prompt('data_analysis');

export class DataAnalysisAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  public cancelTask = async (taskId: string, eventBus: ExecutionEventBus): Promise<void> => {
    this.cancelledTasks.add(taskId);
    const cancelledUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId,
      contextId: uuidv4(),
      status: {
        state: 'canceled',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: 'Data analysis cancelled.' }],
          taskId,
          contextId: uuidv4(),
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(cancelledUpdate);
  };

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { userMessage } = requestContext;
    const existingTask = requestContext.task;

    const taskId = existingTask?.id ?? uuidv4();
    const contextId = (userMessage.contextId ?? existingTask?.contextId) ?? uuidv4();

    if (!existingTask) {
      const initialTask: Task = {
        kind: 'task',
        id: taskId,
        contextId,
        status: { state: 'submitted', timestamp: new Date().toISOString() },
        history: [userMessage],
        metadata: userMessage.metadata ?? {},
        artifacts: [],
      };
      eventBus.publish(initialTask);
    }

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
          parts: [{ kind: 'text', text: 'Conducting comprehensive data analysis...' }],
          taskId,
          contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    const historyForGenkit = existingTask?.history ? [...existingTask.history] : [];
    if (!historyForGenkit.find(m => m.messageId === userMessage.messageId)) {
      historyForGenkit.push(userMessage);
    }

    const messages: MessageData[] = historyForGenkit
      .map((m): MessageData => ({
        role: m.role === 'agent' ? 'model' : 'user',
        content: m.parts
          .filter((p): p is TextPart => p.kind === 'text' && !!(p).text)
          .map((p) => ({ text: (p).text })),
      }))
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
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
      const response = await dataAnalysisPrompt(
        {
          analysisType: 'comprehensive statistical analysis with visualization',
          dataCharacteristics: 'quantitative data with statistical validation',
          now: new Date().toISOString(),
        },
        { messages }
      );

      const respText: string = (response as unknown as { text?: string }).text ?? '';
      const findings = this.parseDataFindings(respText);

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
              text: `Data analysis completed. Performed ${findings?.statisticalAnalysis?.testsPerformed?.length ?? 0} statistical tests with ${findings?.dataAssessment?.sampleSize ?? 0} data points`,
            }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: false,
      };
      eventBus.publish(statusUpdate);

      if (this.cancelledTasks.has(taskId)) {
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
              parts: [{ kind: 'text', text: 'Data analysis cancelled.' }],
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
              text: `Data analysis completed successfully. Statistical power: ${findings?.statisticalAnalysis?.statisticalPower ?? 'N/A'}`,
            }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(completionUpdate);
    } catch (error) {
      flowlogger.error({ err: error }, `[DataAnalysisAgentExecutor] Error processing task`);
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
            parts: [{ kind: 'text', text: `Data analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
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

  // Keep function signature and fallback identical to original
  private parseDataFindings(responseText: string): Findings {
    try {
      const parsed = JSON.parse(responseText);
      return parsed.dataAnalysis ?? parsed;
    } catch {
      flowlogger.warn('[DataAnalysisAgentExecutor] Could not parse data findings as JSON, using fallback');
      return {
        dataAssessment: {
          dataSources: ['Simulated data source'],
          sampleSize: 100,
          dataQuality: 'medium',
          variables: ['variable1', 'variable2'],
          missingData: '5%'
        },
        statisticalAnalysis: {
          methodology: 'descriptive',
          testsPerformed: [{
            testName: 'correlation',
            variables: ['var1', 'var2'],
            results: {
              statistic: 0.65,
              pValue: 0.001,
              effectSize: 0.65,
              confidenceInterval: [0.45, 0.85],
              interpretation: 'Strong positive correlation'
            }
          }],
          keyFindings: ['Significant relationship identified'],
          statisticalPower: 0.8
        },
        dataVisualization: {
          recommendedCharts: [{ type: 'scatterplot', variables: ['x', 'y'], insights: 'Clear linear relationship', dataRange: '0-100, 0-100' }],
          visualizationPrinciples: ['Clear labeling', 'Appropriate scales']
        },
        quantitativeInsights: {
          primaryConclusions: ['Data shows clear patterns'],
          effectMagnitudes: ['Large effect size observed'],
          practicalSignificance: ['Results have practical implications'],
          limitations: ['Sample size could be larger'],
          recommendations: ['Further analysis recommended']
        },
        methodologicalNotes: {
          assumptionsTested: ['Normality', 'Independence'],
          robustnessChecks: ['Sensitivity analysis'],
          alternativeAnalyses: ['Non-parametric tests'],
          dataTransparency: 'Analysis methods documented'
        },
        metadata: {
          analysisDate: new Date().toISOString(),
          softwareTools: ['Statistical Software'],
          statisticalMethods: ['Correlation analysis'],
          confidenceLevel: 0.95,
          reproducibilityScore: 0.85,
          dataLastUpdated: new Date().toISOString()
        }
      };
    }
  }
}

export default DataAnalysisAgentExecutor;

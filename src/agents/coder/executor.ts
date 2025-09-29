import type {
  Artifact,
  Message,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
  TextPart,
} from '@a2a-js/sdk';
import type {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from '@a2a-js/sdk/server';
import type { MessageData } from '@genkit-ai/ai/model';
import { v4 as uuidv4 } from 'uuid';
import { ai } from './genkit.js';
import { UserFacingError } from '../../errors/UserFacingError.js';
import { flowlogger } from '../../logger.js';
import type { CodeMessageData } from './code-format.js';
import { CodeMessageSchema } from './code-format.js';

export class CoderAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  async cancelTask(
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    this.cancelledTasks.add(taskId);
    const cancelledStatusUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId,
      contextId: '', // Context might not be available here
      status: {
        state: 'canceled',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: 'Task was cancelled by request.' }],
          taskId,
          contextId: '',
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(cancelledStatusUpdate);
  }

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    if (!requestContext.task) {
      flowlogger.error('Task is missing in request context');
      return;
    }
    const { task, userMessage } = requestContext;
    const taskId = task.id;
    const contextId = task.contextId;

    const taskHistory: Message[] = task.history ?? [];
    const taskMetadata = task.metadata ?? {};

    // Ensure user message is in history (avoid duplicates by messageId)
    const messageExists = taskHistory.some(
      (m: Message) => m.messageId === userMessage.messageId
    );
    if (!messageExists) {
      taskHistory.push(userMessage);
    }

    // Update task metadata with execution context
    taskMetadata.lastExecutionStarted = new Date().toISOString();
    taskMetadata.executionCount =
      ((taskMetadata.executionCount as number) ?? 0) + 1;

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
          parts: [{ kind: 'text', text: 'Generating code...' }],
          taskId,
          contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    try {
      if (this.cancelledTasks.has(taskId)) {
        throw new Error('Task was cancelled');
      }
      const genkitHistory: MessageData[] = taskHistory.map((m: Message) => ({
        role: m.role === 'agent' ? 'model' : 'user',
        content: m.parts
          .filter((p): p is TextPart => p.kind === 'text')
          .map((p: TextPart) => ({ text: p.text })),
      }));

      const stream = await ai.generateStream({
        messages: genkitHistory,
        prompt: (userMessage.parts[0] as TextPart).text,
      });

      let fullResponse = '';
      for await (const chunk of stream.stream) {
        if (this.cancelledTasks.has(taskId)) {
          this.cancelledTasks.delete(taskId);
          throw new Error('Task was cancelled during generation');
        }
        const text = chunk.text;
        if (typeof text === 'string') {
          fullResponse += text;
        }
      }

      const codeMessageData: CodeMessageData = {
        files: [
          {
            filename: 'generated.js',
            content: fullResponse,
            done: true,
          },
        ],
      };

      const validation = CodeMessageSchema.safeParse(codeMessageData);

      if (!validation.success) {
        throw new UserFacingError(
          'Code generation failed to produce a valid format.'
        );
      }

      const artifact: Artifact = {
        artifactId: 'generated.js',
        name: 'generated.js',
        parts: [{ kind: 'data', data: validation.data }],
      };

      const artifactUpdate: TaskArtifactUpdateEvent = {
        kind: 'artifact-update',
        taskId,
        contextId,
        artifact,
      };
      eventBus.publish(artifactUpdate);

      const completedStatusUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'completed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: 'Code generation complete.' }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(completedStatusUpdate);
    } catch (err) {
      const error = err as Error;
      flowlogger.error({ err: error }, '[CoderAgent] Execution error');
      let errorMessage =
        error instanceof UserFacingError
          ? error.message
          : 'An unexpected error occurred during code generation.';

      if (error.message.includes('Task was cancelled')) {
        errorMessage = error.message;
      }

      const fallbackArtifact: Artifact = {
        artifactId: 'error.txt',
        name: 'error.txt',
        parts: [
          {
            kind: 'data',
            data: {
              files: [
                {
                  filename: 'error.txt',
                  content: `Code generation failed: ${errorMessage}`,
                },
              ],
            },
          },
        ],
      };

      const artifactUpdate: TaskArtifactUpdateEvent = {
        kind: 'artifact-update',
        taskId,
        contextId,
        artifact: fallbackArtifact,
      };
      eventBus.publish(artifactUpdate);

      const failedStatusUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'failed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: errorMessage }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(failedStatusUpdate);
    }
  }
}

export default CoderAgentExecutor;

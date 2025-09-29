import type {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from '@a2a-js/sdk/server';
import type {
  Artifact,
  Message,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
  TextPart,
} from '@a2a-js/sdk';
import type { MessageData } from '@genkit-ai/ai/model';
import { loadPrompt } from 'genkit';
import { v4 as uuidv4 } from 'uuid';
import { ai } from './genkit.js';
import { flowlogger } from '../../logger.js';

export class ContentEditorExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  async cancelTask(
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> {
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
          parts: [{ kind: 'text', text: 'Content editing cancelled.' }],
          taskId,
          contextId: uuidv4(),
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(cancelledUpdate);
  }

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    if (!requestContext.task) {
      // In a real app, you'd want to publish a failure state to the event bus.
      // logging is set up to use flowlogger
      flowlogger.error('Task is missing in request context');
      return;
    }
    const { task, userMessage } = requestContext;
    const taskId = task.id;
    const contextId = task.contextId;

    const historyForGenkit: Message[] = task.history ?? [];

    // Ensure user message is in history
    const messageExists = historyForGenkit.some(
      (m) => m.messageId === userMessage.messageId
    );
    if (!messageExists) {
      historyForGenkit.push(userMessage);
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
          parts: [{ kind: 'text', text: 'Editing content...' }],
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

      const contentEditorPrompt = await loadPrompt({
        name: 'content_editor',
      });

      const llmResponse = await ai.generate({
        prompt: await contentEditorPrompt.render({
          context: {
            input: (userMessage.parts[0] as TextPart).text,
          },
        }),
      });

      const editedText = llmResponse.text;

      const artifact: Artifact = {
        artifactId: 'edited-content.txt',
        name: 'edited-content.txt',
        parts: [{ kind: 'text', text: editedText }],
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
            parts: [{ kind: 'text', text: 'Content editing complete.' }],
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
      const errorMessage =
        'An unexpected error occurred during content editing.';

      flowlogger.error(`Content editing failed: ${error.message}`);

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

export default ContentEditorExecutor;

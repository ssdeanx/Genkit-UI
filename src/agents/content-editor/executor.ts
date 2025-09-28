import { v4 as uuidv4 } from 'uuid';
import type { MessageData } from 'genkit';
import type { Task, TaskStatusUpdateEvent, TextPart, Message } from '@a2a-js/sdk';
import type { AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { ai } from './genkit.js';

const contentEditorPrompt = ai.prompt('content_editor');

export class ContentEditorAgentExecutor implements AgentExecutor {
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
          parts: [{ kind: 'text', text: 'Content editing cancelled.' }],
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
          parts: [{ kind: 'text', text: 'Editing content...' }],
          taskId,
          contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    const historyForGenkit = existingTask?.history ? [...existingTask.history] : [];
    if (!historyForGenkit.find((m) => m.messageId === userMessage.messageId)) {
      historyForGenkit.push(userMessage);
    }

    // Replace mapping to satisfy MessageData typing: explicitly type role and content
    const messages: MessageData[] = historyForGenkit
      .map((m) => {
        const role: MessageData['role'] = m.role === 'agent' ? 'model' : 'user';
        const content = m.parts
          .filter((p): p is TextPart => p.kind === 'text' && !!(p).text)
          .map((p) => ({ text: p.text })) as MessageData['content'];
        return { role, content } as MessageData;
      })
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
            parts: [{ kind: 'text', text: 'No message found to process.' }],
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
      const response = await contentEditorPrompt({}, { messages });

      if (this.cancelledTasks.has(taskId)) {
        const cancelledUpdate: TaskStatusUpdateEvent = {
          kind: 'status-update',
          taskId,
          contextId,
          status: { state: 'canceled', timestamp: new Date().toISOString() },
          final: true,
        };
        eventBus.publish(cancelledUpdate);
        return;
      }

      // Helper: safely extract a text string from various possible response shapes
      const extractTextFromResponse = (resp: unknown): string | undefined => {
        if (typeof resp === 'string') {
          return resp;
        }
        if (resp === null || typeof resp !== 'object') {
          return undefined;
        }
        const obj = resp as Record<string, unknown>;

        // common shapes
        if (typeof obj.text === 'string') {
          return obj.text;
        }
        if (typeof obj.output === 'string') {
          return obj.output;
        }

        // nested output.text
        const out = obj.output;
        // Explicitly check for undefined/null before using typeof to avoid implicit any in the conditional
        if (out !== undefined && out !== null && typeof out === 'object') {
          const outObj = out as Record<string, unknown>;
          if (typeof outObj.text === 'string') {
            return outObj.text;
          }
        }

        // OpenAI style
        const {choices} = obj;
        if (Array.isArray(choices) && choices.length > 0) {
          const first = choices[0];
          if (typeof first === 'string') {
            return first;
          }
          if ((Boolean(first)) && typeof first === 'object') {
            const firstObj = first as Record<string, unknown>;
            if (typeof firstObj.text === 'string') {
              return firstObj.text;
            }
            if (typeof firstObj.message === 'string') {
              return firstObj.message;
            }
            if ((Boolean(firstObj.message)) && typeof firstObj.message === 'object') {
              const m = firstObj.message as Record<string, unknown>;
              if (typeof m.text === 'string') {
                return m.text;
              }
            }
          }
        }

        return undefined;
      };

      const responseText = extractTextFromResponse(response);
      const agentMessage: Message = {
        kind: 'message',
        role: 'agent',
        messageId: uuidv4(),
        parts: [{ kind: 'text', text: responseText ?? 'Completed.' }],
        taskId,
        contextId,
      };

      const finalUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: { state: 'completed', message: agentMessage, timestamp: new Date().toISOString() },
        final: true,
      };
      eventBus.publish(finalUpdate);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
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
            parts: [{ kind: 'text', text: `Agent error: ${errorMessage}` }],
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
}

export default ContentEditorAgentExecutor;

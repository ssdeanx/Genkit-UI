import { v4 as uuidv4 } from 'uuid';
import type { MessageData } from 'genkit';
import type {
  Artifact,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
  TextPart,
} from '@a2a-js/sdk';
import type { AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { ai } from './genkit.js';
import { CodeMessageSchema } from './code-format.js';
import type { CodeMessage } from './code-format.js';
import { UserFacingError } from '../../errors/UserFacingError.js';
import { flowlogger } from '../../logger.js'; // added: log instead of empty catch

/**
 * Exported CoderAgentExecutor for testability.
 * Contains no server start or env var exits.
 */
export class CoderAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus,
  ): Promise<void> => {
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
          parts: [{ kind: 'text', text: 'Code generation cancelled.' }],
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

    // Enhanced task history management with proper state preservation
    const taskHistory = existingTask?.history ? [...existingTask.history] : [];
    const taskArtifacts = existingTask?.artifacts ? [...existingTask.artifacts] : [];
    const taskMetadata = existingTask?.metadata ? { ...existingTask.metadata } : {};

    // Ensure user message is in history (avoid duplicates by messageId)
    const messageExists = taskHistory.some(m => m.messageId === userMessage.messageId);
    if (!messageExists) {
      taskHistory.push(userMessage);
    }

    // Update task metadata with execution context
    taskMetadata.lastExecutionStarted = new Date().toISOString();
    taskMetadata.executionCount = (taskMetadata.executionCount as number || 0) + 1;

    // Publish initial Task event if it's a new task
    if (!existingTask) {
      const initialTask: Task = {
        kind: 'task',
        id: taskId,
        contextId,
        status: { state: 'submitted', timestamp: new Date().toISOString() },
        history: taskHistory,
        metadata: taskMetadata,
        artifacts: taskArtifacts,
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
          parts: [{ kind: 'text', text: 'Generating code...' }],
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

    const messages: MessageData[] = historyForGenkit
      .map((m): MessageData => ({
        role: m.role === 'agent' ? 'model' : 'user',
        content: m.parts
          .filter((p): p is TextPart => p.kind === 'text' && !!p.text)
          .map((p) => ({ text: p.text })),
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
      const CODER_IDLE_TIMEOUT_MS = Number(process.env.CODER_IDLE_TIMEOUT_MS ?? '5000');
      const CODER_MAX_DURATION_MS = Number(process.env.CODER_MAX_DURATION_MS ?? '120000');

      const systemText = 'You are an expert coding assistant. Provide a high-quality code sample according to the output instructions provided below. You may generate multiple files as needed.';
      const promptBody = messages.map((m) => m.content.map((c) => c.text).join('\n')).join('\n\n');
      const promptText = `${systemText}\n\n${promptBody}`;

      const { stream, response } = ai.generateStream({
        prompt: promptText,
        model: 'gemini-2.5-flash',
        config: { output: { format: 'code' }, stream: true },
      });

      const fileContents = new Map<string, string>();
      const fileOrder: string[] = [];

      let idleTimer: NodeJS.Timeout | undefined;
      let maxTimer: NodeJS.Timeout | undefined;

      const startIdleTimer = () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
        idleTimer = setTimeout(() => {
          if (this.cancelledTasks.has(taskId)) {
            try {
              if (idleTimer) {
                clearTimeout(idleTimer);
              }
            } catch (err: unknown) {
              // changed: stringify unknown before logging
              flowlogger.warn('[CoderAgentExecutor] clearing idleTimer failed: %s', String(err));
            }
            try {
              if (maxTimer) {
                clearTimeout(maxTimer);
              }
            } catch (err: unknown) {
              // changed: stringify unknown before logging
              flowlogger.warn('[CoderAgentExecutor] clearing maxTimer failed: %s', String(err));
            }
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
        }, CODER_IDLE_TIMEOUT_MS);
      };

      const startMaxTimer = () => {
        if (maxTimer) {
          clearTimeout(maxTimer);
        }
        maxTimer = setTimeout(() => {
          if (this.cancelledTasks.has(taskId)) {
            try {
              if (idleTimer) {
                clearTimeout(idleTimer);
              }
            } catch (err: unknown) {
              // changed: stringify unknown before logging
              flowlogger.warn('[CoderAgentExecutor] clearing idleTimer failed: %s', String(err));
            }
            try {
              if (maxTimer) {
                clearTimeout(maxTimer);
              }
            } catch (err: unknown) {
              // changed: stringify unknown before logging
              flowlogger.warn('[CoderAgentExecutor] clearing maxTimer failed: %s', String(err));
            }
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
        }, CODER_MAX_DURATION_MS);
      };

      startIdleTimer();
      startMaxTimer();

      for await (const chunk of stream as AsyncIterable<{ output?: unknown }>) {
        startIdleTimer();
        const codeChunk = chunk.output as CodeMessage | undefined;
        if (!codeChunk?.files) {
          continue;
        }
        for (const fileUpdate of codeChunk.files) {
          const filename = fileUpdate.filename ?? `file-${fileOrder.length + 1}`;
          const prev = fileContents.get(filename) ?? '';
          fileContents.set(filename, fileUpdate.content ?? prev);
          if (!fileOrder.includes(filename)) {
            fileOrder.push(filename);
          }
        }
        if (this.cancelledTasks.has(taskId)) {
          try {
            if (idleTimer) {
              clearTimeout(idleTimer);
            }
          } catch (err: unknown) {
            // changed: stringify unknown before logging
            flowlogger.warn('[CoderAgentExecutor] clearing idleTimer failed: %s', String(err));
          }
          try {
            if (maxTimer) {
              clearTimeout(maxTimer);
            }
          } catch (err: unknown) {
            // changed: stringify unknown before logging
            flowlogger.warn('[CoderAgentExecutor] clearing maxTimer failed: %s', String(err));
          }
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
      }

      try {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
      } catch (err: unknown) {
        // changed: stringify unknown before logging
        flowlogger.warn('[CoderAgentExecutor] clearing idleTimer failed: %s', String(err));
      }
      try {
        if (maxTimer) {
          clearTimeout(maxTimer);
        }
      } catch (err: unknown) {
        // changed: stringify unknown before logging
        flowlogger.warn('[CoderAgentExecutor] clearing maxTimer failed: %s', String(err));
      }

      const fullMessage = (await response).output as CodeMessage | undefined;
      let finalData: unknown = undefined;
      if (fullMessage) {
        const maybeWithToJson = fullMessage as { toJSON?: unknown };
        if (typeof maybeWithToJson.toJSON === 'function') {
          finalData = (maybeWithToJson.toJSON as () => unknown)();
        } else {
          finalData = fullMessage;
        }
      } else {
        const files = fileOrder.map((fn) => ({ filename: fn, content: fileContents.get(fn) ?? '', done: true }));
        finalData = { files, postamble: '' };
      }

      const safe = CodeMessageSchema.safeParse(finalData);
      if (!safe.success) {
        const userError = new UserFacingError('Invalid code output — parse failed', { details: JSON.stringify(safe.error.format()) });
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
              parts: [{ kind: 'text', text: `Validation error: ${userError.message}` }],
              taskId,
              contextId,
            },
            timestamp: new Date().toISOString(),
          },
          final: true,
        };
        eventBus.publish(errorUpdate);
        return;
      }

      const validated = safe.data;
      const generatedFiles = (validated.files ?? []).map((f) => f.filename ?? 'untitled');
      for (const f of validated.files) {
        const filename = f.filename ?? 'untitled';
        const content = f.content ?? '';
        const artifact: Artifact = { artifactId: filename, name: filename, parts: [{ kind: 'text', text: content }] };
        const artifactUpdate: TaskArtifactUpdateEvent = {
          kind: 'artifact-update',
          taskId,
          contextId,
          artifact,
          append: false,
          lastChunk: true,
        };
        eventBus.publish(artifactUpdate);
      }

      const finalUpdate: TaskStatusUpdateEvent = {
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'completed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: generatedFiles.length > 0 ? `Generated files: ${generatedFiles.join(', ')} ` : 'Completed, but no files were generated.' }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(finalUpdate);
    } catch (error: unknown) {
      const errorMessage = error instanceof UserFacingError ? error.message : 'Agent error';
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
            parts: [{ kind: 'text', text: `${errorMessage}` }],
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

export default CoderAgentExecutor;

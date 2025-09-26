/* eslint-disable no-console */
import express from "express";
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

import type { MessageData } from "genkit";
import type {
  AgentCard,
  Task,
  TaskArtifactUpdateEvent,
  TaskState,
  TaskStatusUpdateEvent,
  TextPart,
  Artifact, // <-- added Artifact type
} from "@a2a-js/sdk";
import type {
  RequestContext} from "@a2a-js/sdk/server";
import {
  InMemoryTaskStore,
  type TaskStore,
  type AgentExecutor,
  type ExecutionEventBus,
  DefaultRequestHandler,
} from "@a2a-js/sdk/server"; // Import server components
import { A2AExpressApp } from "@a2a-js/sdk/server/express";
import { ai } from "./genkit.js";
import { CodeMessageSchema } from "./code-format.js";
import { UserFacingError } from "../../errors/UserFacingError.js";
import type { CodeMessage } from "./code-format.js"; // CodeMessage used only for typings here

if (process.env.GEMINI_API_KEY === undefined || process.env.GEMINI_API_KEY === '') {

  console.error("GEMINI_API_KEY environment variable not set or empty.");
  process.exit(1);
}

/**
 * CoderAgentExecutor implements the agent's core logic for code generation.
 */
class CoderAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

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

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const {userMessage} = requestContext;
    const existingTask = requestContext.task;

    const taskId = existingTask?.id ?? uuidv4();
    const contextId = (userMessage.contextId ?? existingTask?.contextId) ?? uuidv4();

    console.log(
      `[CoderAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
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
        // Ensure metadata is always a object (Task expects a non-undefined object)
        metadata: userMessage.metadata ?? {},
        // Provide an explicitly typed empty Artifact[] to satisfy the Task type
        artifacts: [] as Artifact[],
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
          parts: [{ kind: 'text', text: 'Generating code...' }],
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
        `[CoderAgentExecutor] No valid text messages found in history for task ${taskId}.`
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
      // 4. Run the Genkit prompt
      const CODER_IDLE_TIMEOUT_MS = Number(process.env.CODER_IDLE_TIMEOUT_MS ?? '5000');
      const CODER_MAX_DURATION_MS = Number(process.env.CODER_MAX_DURATION_MS ?? '120000');

      // Build a single prompt text combining system prompt + history messages
      const systemText = 'You are an expert coding assistant. Provide a high-quality code sample according to the output instructions provided below. You may generate multiple files as needed.';
      const promptBody = messages
        .map((m) => m.content.map((c) => c.text).join('\n'))
        .join('\n\n');
      const promptText = `${systemText}\n\n${promptBody}`;

      // NOTE: ai.generateStream accepts either a prompt string or parts array.
      const { stream, response } = ai.generateStream({
        prompt: promptText,
        model: 'gemini-2.5-flash',
        config: { output: { format: 'code' }, stream: true },
      });

      const fileContents = new Map<string, string>(); // Stores latest content per file
      const fileOrder: string[] = []; // Store order of file appearance
      // Buffer per-file content; we will validate the final structured output before emitting artifacts

      // Idle and max-duration timers
      let idleTimer: NodeJS.Timeout | undefined = undefined;
      let maxTimer: NodeJS.Timeout | undefined = undefined;

      const startIdleTimer = () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
        idleTimer = setTimeout(() => {
          // eslint-disable-next-line no-console
          console.log(`[CoderAgentExecutor] Idle timeout reached for task ${taskId}`);
          // Cancellation check
          if (this.cancelledTasks.has(taskId)) {
            console.log(`[CoderAgentExecutor] Request cancelled for task: ${taskId}`);
            try {
              if (typeof idleTimer !== 'undefined') {
                clearTimeout(idleTimer);
              }
            } catch {
              // ignore
            }
            try {
              if (typeof maxTimer !== 'undefined') {
                clearTimeout(maxTimer);
              }
            } catch {
              // ignore
            }
            const cancelledUpdate: TaskStatusUpdateEvent = {
              kind: 'status-update',
              taskId,
              contextId,
              status: {
                state: 'canceled',
                timestamp: new Date().toISOString(),
              },
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
          // eslint-disable-next-line no-console
          console.log(`[CoderAgentExecutor] Max duration reached for task ${taskId}`);
          // Cancellation check
          if (this.cancelledTasks.has(taskId)) {
            console.log(`[CoderAgentExecutor] Request cancelled for task: ${taskId}`);
            try {
              if (typeof idleTimer !== 'undefined') {
                clearTimeout(idleTimer);
              }
            } catch {
              // ignore
            }
            try {
              if (typeof maxTimer !== 'undefined') {
                clearTimeout(maxTimer);
              }
            } catch {
              // ignore
            }
            const cancelledUpdate: TaskStatusUpdateEvent = {
              kind: 'status-update',
              taskId,
              contextId,
              status: {
                state: 'canceled',
                timestamp: new Date().toISOString(),
              },
              final: true,
            };
            eventBus.publish(cancelledUpdate);
            return;
          }
        }, CODER_MAX_DURATION_MS);
      };

      // Start timers
      startIdleTimer();
      startMaxTimer();

      // Helper that always returns a string (never undefined) for a filename.
      const getFileContent = (fn: string): string => fileContents.get(fn) ?? "";

      for await (const chunk of stream) {
        // Reset idle timer on any incoming activity
        startIdleTimer();

        const codeChunk = chunk.output as CodeMessage | undefined;
        if (!codeChunk?.files) {
          continue;
        }

        // Buffer file fragments; do NOT emit artifacts until final validation
        for (const fileUpdate of codeChunk.files) {
          const filename = fileUpdate.filename ?? `file-${fileOrder.length + 1}`;
          // Update content (accumulate latest content)
          const prev = fileContents.get(filename) ?? '';
          fileContents.set(filename, fileUpdate.content ?? prev);
          if (!fileOrder.includes(filename)) { fileOrder.push(filename); }
        }

        // Cancellation check
        if (this.cancelledTasks.has(taskId)) {
          // eslint-disable-next-line no-console
          console.log(`[CoderAgentExecutor] Request cancelled for task: ${taskId}`);
          try {
            if (typeof idleTimer !== 'undefined') {
              clearTimeout(idleTimer);
            }
          } catch {
            // ignore
          }
          try {
            if (typeof maxTimer !== 'undefined') {
              clearTimeout(maxTimer);
            }
          } catch {
          // ignore
          }
          const cancelledUpdate: TaskStatusUpdateEvent = {
            kind: 'status-update',
            taskId,
            contextId,
            status: {
              state: 'canceled',
              timestamp: new Date().toISOString(),
            },
            final: true,
          };
          eventBus.publish(cancelledUpdate);
          return;
        }
      }

      // Clear timers now we've exited streaming
      try {
        if (typeof idleTimer !== 'undefined') {
          clearTimeout(idleTimer);
        }
      } catch {
        // ignore
      }
      try {
        if (typeof maxTimer !== 'undefined') {
          clearTimeout(maxTimer);
        }
      } catch {
      // ignore
      }

      // Build an aggregated CodeMessageData from buffers (fallback) or use final response
      const fullMessage = (await response).output as CodeMessage | undefined;
      let finalData: unknown = undefined;
      if (fullMessage) {
        // Prefer the structured output if the model returned the format
        if (fullMessage) {
          const maybeWithToJson = fullMessage as { toJSON?: unknown };
          if (typeof maybeWithToJson.toJSON === 'function') {
            finalData = (maybeWithToJson.toJSON as () => unknown)();
          } else {
            finalData = fullMessage;
          }
        } else {
          // Construct from buffered fileContents
          const files = fileOrder.map((fn) => ({
            filename: fn,
            content: getFileContent(fn),
            done: true,
          }));
          finalData = { files, postamble: '' };
        }
      }

      // Validate finalData using CodeMessageSchema
      const safe = CodeMessageSchema.safeParse(finalData);
      if (!safe.success) {
        // Validation failed: publish a user-facing failure and do NOT emit artifacts
        const errDetails = JSON.stringify(safe.error.format(), null, 2);
        // eslint-disable-next-line no-console
        console.warn(`[CoderAgentExecutor] Validation failed for task ${taskId}: ${errDetails}`);
        const userError = new UserFacingError('Invalid code output — parse failed', { details: errDetails });
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
        // eslint-disable-next-line no-console
        console.log(`[CoderAgentExecutor] Task ${taskId} failed validation and was marked failed.`);
        return;
      }

      // Emit artifacts only after successful validation
      const validated = safe.data;
      const generatedFiles = (validated.files ?? []).map((f) => f.filename ?? 'untitled');
      for (const f of validated.files) {
        const filename = f.filename ?? 'untitled';
        const content = f.content ?? '';
        const artifactUpdate: TaskArtifactUpdateEvent = {
          kind: 'artifact-update',
          taskId,
          contextId,
          artifact: {
            artifactId: filename,
            name: filename,
            parts: [{ kind: 'text', text: content }],
          },
          append: false,
          lastChunk: true,
        };
        eventBus.publish(artifactUpdate);
      }

      // 5. Publish final task status update
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
            parts: [
              {
                kind: 'text',
                text:
                  generatedFiles.length > 0
                    ? `Generated files: ${generatedFiles.join(', ')} `
                    : 'Completed, but no files were generated.',
              },
            ],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(finalUpdate);

      // eslint-disable-next-line no-console
      console.log(`[CoderAgentExecutor] Task ${taskId} finished with state: completed`);

    } catch (error: unknown) {
      // Convert unknown error to string safely
      const errorText = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(`[CoderAgentExecutor] Error processing task ${taskId}: ${errorText}`);
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

// --- Server Setup ---

const coderAgentCard: AgentCard = {
  protocolVersion: '1.0',
  name: 'Coder Agent',
  description:
    'An agent that generates code based on natural language instructions and streams file outputs.',
  url: 'http://localhost:41242/', // Adjusted port and base URL
  provider: {
    organization: 'A2A Samples',
    url: 'https://example.com/a2a-samples',
  },
  version: '0.0.2', // Incremented version
  capabilities: {
    streaming: true, // Agent streams artifact updates
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  securitySchemes: {},
  security: [],
  defaultInputModes: ['text'],
  defaultOutputModes: ['text', 'file'], // 'file' implies artifacts
  skills: [
    {
      id: 'code_generation',
      name: 'Code Generation',
      description:
        'Generates code snippets or complete files based on user requests, streaming the results.',
      tags: ['code', 'development', 'programming'],
      examples: [
        'Write a python function to calculate fibonacci numbers.',
        'Create an HTML file with a basic button that alerts "Hello!" when clicked.',
      ],
      inputModes: ['text'],
      outputModes: ['text', 'file'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

async function main() {
  // 1. Create TaskStore
  const taskStore: TaskStore = new InMemoryTaskStore();

  // 2. Create AgentExecutor
  const agentExecutor: AgentExecutor = new CoderAgentExecutor();

  // 3. Create DefaultRequestHandler
  const requestHandler = new DefaultRequestHandler(
    coderAgentCard,
    taskStore,
    agentExecutor
  );

  // 4. Create and setup A2AExpressApp
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express(), '');

  // 5. Start the server
  const PORT = process.env.CODER_AGENT_PORT ?? 41242; // Different port for coder agent
  expressApp.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[CoderAgent] Server using new framework started on http://localhost:${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`[CoderAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
    // eslint-disable-next-line no-console
    console.log('[CoderAgent] Press Ctrl+C to stop the server');
  });
}

// eslint-disable-next-line no-console
main().catch((e) => console.error(e));


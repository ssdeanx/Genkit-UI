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
import type { CodeMessage } from "./code-format.js"; // CodeMessageSchema might not be needed here

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
        // Ensure metadata is always an object (Task expects a non-undefined object)
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
      const { stream, response } = ai.generateStream({
        system: 'You are an expert coding assistant. Provide a high-quality code sample according to the output instructions provided below. You may generate multiple files as needed.',
        output: { format: 'code' },
        messages,
        tools: [], // No tools for now
        model: 'gemini-2.5-flash', // Ensure the model is specified
      });

      const fileContents = new Map<string, string>(); // Stores latest content per file
      const fileOrder: string[] = []; // Store order of file appearance
      let emittedFileCount = 0;

      // Helper that always returns a string (never undefined) for a filename.
      const getFileContent = (fn: string): string => fileContents.get(fn) ?? "";

      for await (const chunk of stream) {
        const codeChunk = chunk.output as CodeMessage | undefined;
        if (!codeChunk?.files) {
          continue;
        }

        let currentFileOrderIndex = -1;

        for (const fileUpdate of codeChunk.files) {
          if (fileUpdate.filename) {
            fileContents.set(fileUpdate.filename, fileUpdate.content);

            if (!fileOrder.includes(fileUpdate.filename)) {
              fileOrder.push(fileUpdate.filename);
              currentFileOrderIndex = fileOrder.length - 1;

              if (currentFileOrderIndex > 0 && emittedFileCount < currentFileOrderIndex) {
                const prevFileIndex = currentFileOrderIndex - 1;
                const prevFilename = fileOrder[prevFileIndex];
                if (!prevFilename) {
                  // Skip if undefined to satisfy TS and avoid emitting invalid artifacts
                  continue;
                }
                // Use helper so the value is always a string
                const prevFileContent: string = getFileContent(prevFilename);

                console.log(
                  `[CoderAgentExecutor] Emitting completed file artifact (index ${prevFileIndex}): ${prevFilename}`
                );
                const artifactUpdate: TaskArtifactUpdateEvent = {
                  kind: 'artifact-update',
                  taskId,
                  contextId,
                  artifact: {
                    artifactId: prevFilename,
                    name: prevFilename,
                    parts: [{ kind: 'text', text: prevFileContent }],
                  },
                  append: false, // Each emission is a complete file snapshot
                  lastChunk: true, // True for this file artifact
                };
                eventBus.publish(artifactUpdate);
                emittedFileCount++;
              }
            }

            // Check if the request has been cancelled
            if (this.cancelledTasks.has(taskId)) {
              console.log(`[CoderAgentExecutor] Request cancelled for task: ${taskId}`);

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
        }

      }

      // After the loop, emit any remaining files that haven't been yielded
      for (let i = emittedFileCount; i < fileOrder.length; i++) {
        const filename = fileOrder[i];
        if (!filename) {
          // Skip undefined indices; narrows type so artifactId/name are strings
          continue;
        }
        // Use helper to guarantee a string
        const content: string = getFileContent(filename);
        console.log(
          `[CoderAgentExecutor] Emitting final file artifact(index ${i}): ${filename} `
        );
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

      const fullMessage = (await response).output as CodeMessage | undefined;
      const generatedFiles = fullMessage?.files.map((f) => f.filename) ?? [];

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

      console.log(
        `[CoderAgentExecutor] Task ${taskId} finished with state: completed `
      );

    } catch (error: any) {
      console.error(
        `[CoderAgentExecutor] Error processing task ${taskId}: `,
        error
      );
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
            parts: [{ kind: 'text', text: `Agent error: ${error.message} ` }],
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
    console.log(`[CoderAgent] Server using new framework started on http://localhost:${PORT}`);
    console.log(`[CoderAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`);
    console.log('[CoderAgent] Press Ctrl+C to stop the server');
  });
}

main().catch(console.error);


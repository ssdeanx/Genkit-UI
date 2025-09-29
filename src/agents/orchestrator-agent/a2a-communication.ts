import type { A2AMessage, TaskRequest, TaskResponse, AgentType } from '../shared/interfaces.js';
import { A2AClient } from '@a2a-js/sdk/client';
import type { Message, Task, TaskStatusUpdateEvent, TaskArtifactUpdateEvent } from '@a2a-js/sdk';
import { flowlogger } from '../../logger.js';

/**
 * A2A Communication Manager for orchestrating inter-agent messaging
 * Handles task delegation, result collection, and status monitoring
 */
export class A2ACommunicationManager {
  private agentEndpoints: Map<AgentType, string> = new Map();
  private pendingTasks: Map<string, TaskRequest> = new Map();
  private taskTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private useA2AClient: boolean;
  private useStreaming: boolean;
  private clients: Map<AgentType, A2AClient> = new Map();
  private clientFactory?: (url: string) => A2AClient;

  constructor(options?: {
    endpoints?: Partial<Record<AgentType, string>>;
    useA2AClient?: boolean;
    useStreaming?: boolean;
    clientFactory?: (url: string) => A2AClient;
  }) {
    // Initialize agent endpoints from environment or configuration
    this.initializeAgentEndpoints();
    if (options?.endpoints) {
      for (const [k, v] of Object.entries(options.endpoints)) {
        if (v) {
          this.agentEndpoints.set(k as AgentType, v);
        }
      }
    }
    // Allow opting into proper A2A JSON-RPC transport progressively
    this.useA2AClient = options?.useA2AClient ?? ((process.env.USE_A2A_CLIENT ?? 'false').toLowerCase() === 'true');
    this.useStreaming = options?.useStreaming ?? ((process.env.USE_A2A_STREAMING ?? 'false').toLowerCase() === 'true');
    if (options?.clientFactory) {
      this.clientFactory = options.clientFactory;
    }
    if (this.useA2AClient) {
      this.bootstrapClients();
    }
  }

  private initializeAgentEndpoints(): void {
    // These would typically come from environment variables or service discovery
    this.agentEndpoints.set('web-research', process.env.WEB_RESEARCH_AGENT_URL ?? 'http://localhost:41246');
    this.agentEndpoints.set('academic-research', process.env.ACADEMIC_RESEARCH_AGENT_URL ?? 'http://localhost:41247');
    this.agentEndpoints.set('news-research', process.env.NEWS_RESEARCH_AGENT_URL ?? 'http://localhost:41248');
    this.agentEndpoints.set('data-analysis', process.env.DATA_ANALYSIS_AGENT_URL ?? 'http://localhost:41249');
  }

  private bootstrapClients(): void {
    // Build A2A clients from configured endpoints
    for (const [agentType, endpoint] of this.agentEndpoints.entries()) {
      if (endpoint && endpoint.trim() !== '') {
        try {
          const client = this.clientFactory ? this.clientFactory(endpoint) : new A2AClient(endpoint);
          this.clients.set(agentType, client);
        } catch {
          // Fallback silently; fetch path will be used
        }
      }
    }
  }

  /**
   * Send a task to the appropriate research agent
   */
  async sendTask(agentType: AgentType, taskRequest: TaskRequest): Promise<TaskResponse> {
    const endpoint = this.agentEndpoints.get(agentType);
    if (endpoint === null || endpoint === undefined || endpoint.trim() === '') {
      throw new Error(`No endpoint configured for agent type: ${agentType}`);
    }

    // Store pending task
    this.pendingTasks.set(taskRequest.taskId, taskRequest);

    // Set timeout for task completion
    const timeout = taskRequest.timeout ?? 300000; // 5 minutes default
    const timeoutHandle = setTimeout(() => {
      this.handleTaskTimeout(taskRequest.taskId);
    }, timeout);
    this.taskTimeouts.set(taskRequest.taskId, timeoutHandle);

    try {
      let taskResponse: TaskResponse;

      if (this.useA2AClient && this.clients.has(agentType)) {
        // Use JSON-RPC message/send with a minimal mapping from our TaskRequest
        const client = this.clients.get(agentType)!;
        const message: Message = {
          kind: 'message',
          role: 'user',
          messageId: taskRequest.taskId,
          taskId: taskRequest.taskId,
          parts: [
            { kind: 'text', text: JSON.stringify({ type: taskRequest.type, parameters: taskRequest.parameters, metadata: taskRequest.metadata }) }
          ],
        };
        // Fire-and-wait single response (non-streaming) to preserve current contract
        const res: unknown = await client.sendMessage({ message });
        // We don't assume shape here; just wrap in our TaskResponse result
        taskResponse = {
          taskId: taskRequest.taskId,
          status: 'success',
          result: res,
          processingTime: 0,
        } as TaskResponse;
      } else {
        const response = await fetch(`${endpoint}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(taskRequest),
        });

        if (!response.ok) {
          throw new Error(`Agent request failed: ${response.status} ${response.statusText}`);
        }

        const raw = await response.json();
        if (!isTaskResponse(raw)) {
          throw new Error('Invalid TaskResponse received from agent');
        }
        taskResponse = raw;
      }

      // Clear timeout and pending task
      clearTimeout(timeoutHandle);
      this.taskTimeouts.delete(taskRequest.taskId);
      this.pendingTasks.delete(taskRequest.taskId);

      return taskResponse;
    } catch (error) {
      // Clear timeout and pending task on error
      clearTimeout(timeoutHandle);
      this.taskTimeouts.delete(taskRequest.taskId);
      this.pendingTasks.delete(taskRequest.taskId);

      throw new Error(`Failed to send task to ${agentType} agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Experimental: stream a task using A2AClient when enabled.
   * Returns a controller with a cancel() method and a done promise that resolves when the stream finishes.
   * If streaming is disabled or A2AClient is unavailable, falls back to sendTask and emits a single synthetic event.
   */
  async sendTaskStream(
    agentType: AgentType,
    taskRequest: TaskRequest,
    onEvent: (event: A2AStreamEvent) => void
  ): Promise<{ cancel: () => Promise<boolean>; done: Promise<void> }> {
    const endpoint = this.agentEndpoints.get(agentType);
    if (!endpoint || endpoint.trim() === '') {
      throw new Error(`No endpoint configured for agent type: ${agentType}`);
    }

    // Track pending + timeout similar to non-streaming path
    this.pendingTasks.set(taskRequest.taskId, taskRequest);
    const timeout = taskRequest.timeout ?? 300000; // 5 minutes default
    const timeoutHandle = setTimeout(() => this.handleTaskTimeout(taskRequest.taskId), timeout);
    this.taskTimeouts.set(taskRequest.taskId, timeoutHandle);

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      this.taskTimeouts.delete(taskRequest.taskId);
      this.pendingTasks.delete(taskRequest.taskId);
    };

    if (!(this.useA2AClient && this.useStreaming && this.clients.has(agentType))) {
      // Fallback: perform a single request and surface as a message event
      try {
        const single = await this.sendTask(agentType, taskRequest);
        const synthetic: Message = {
          kind: 'message',
          role: 'agent',
          messageId: `${taskRequest.taskId}-result`,
          taskId: taskRequest.taskId,
          parts: [{ kind: 'text', text: JSON.stringify(single) }]
        };
        onEvent(synthetic);
      } finally {
        cleanup();
      }
      return {
        cancel: async () => {
          // Nothing to cancel in fallback path beyond local cleanup
          return true;
        },
        done: Promise.resolve()
      };
    }

    const client = this.clients.get(agentType)!;
    const message: Message = {
      kind: 'message',
      role: 'user',
      messageId: taskRequest.taskId,
      taskId: taskRequest.taskId,
      parts: [
        { kind: 'text', text: JSON.stringify({ type: taskRequest.type, parameters: taskRequest.parameters, metadata: taskRequest.metadata }) }
      ],
    };

    let finished = false;
    const done = (async () => {
      try {
        for await (const event of client.sendMessageStream({ message })) {
          onEvent(event);
          // Stop criteria align with ExecutionEventQueue: final status or a message result
          if (event.kind === 'message') {
            finished = true;
            break;
          }
          if (event.kind === 'status-update' && (event as TaskStatusUpdateEvent).final) {
            finished = true;
            break;
          }
        }
      } catch (err) {
        flowlogger.error(`Streaming error for task ${taskRequest.taskId}:`, err);
      } finally {
        cleanup();
      }
    })();

    const cancel = async (): Promise<boolean> => {
      try {
        if (this.clients.has(agentType)) {
          await client.cancelTask({ taskId: taskRequest.taskId } as any);
        }
        finished = true;
        cleanup();
        return true;
      } catch (err) {
        flowlogger.warn(`Cancel failed for task ${taskRequest.taskId}:`, err);
        return false;
      }
    };

    return { cancel, done };
  }

  /**
   * Send tasks to multiple agents in parallel
   */
  async sendParallelTasks(tasks: Array<{ agentType: AgentType; taskRequest: TaskRequest }>): Promise<TaskResponse[]> {
    const promises = tasks.map(({ agentType, taskRequest }) =>
      this.sendTask(agentType, taskRequest)
    );

    try {
      return await Promise.all(promises);
    } catch (error) {
      // Log partial failures but continue with successful responses
      flowlogger.error('Some parallel tasks failed:', error);
      throw error;
    }
  }

  /**
   * Check status of a pending task
   */
  async checkTaskStatus(taskId: string): Promise<'pending' | 'completed' | 'failed' | 'not-found'> {
    if (this.pendingTasks.has(taskId)) {
      return 'pending';
    }

    // In a real implementation, this would query the agent for status
    // For now, assume tasks are either pending or completed
    return 'not-found';
  }

  /**
   * Cancel a pending task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const timeoutHandle = this.taskTimeouts.get(taskId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.taskTimeouts.delete(taskId);
    }

    const task = this.pendingTasks.get(taskId);
    if (task) {
      this.pendingTasks.delete(taskId);

      // If JSON-RPC transport is enabled and we have a client for the agent type, attempt remote cancel
      if (this.useA2AClient) {
        // Find which agent this task likely belongs to by simple heuristic (first matching pending earlier)
        // Since we don't store reverse index, attempt cancel on all clients; ignore failures.
        for (const [, client] of this.clients.entries()) {
          try {
            await client.cancelTask({ taskId } as any);
            break;
          } catch {
            // try next
          }
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskId: string): void {
    flowlogger.warn(`Task ${taskId} timed out`);
    this.pendingTasks.delete(taskId);
    this.taskTimeouts.delete(taskId);

    // In a real implementation, this would trigger error handling
    // For now, just log the timeout
  }

  /**
   * Update agent endpoint configuration
   */
  updateAgentEndpoint(agentType: AgentType, endpoint: string): void {
    this.agentEndpoints.set(agentType, endpoint);
  }

  /**
   * Get current agent endpoints for debugging
   */
  getAgentEndpoints(): Record<AgentType, string> {
    const endpoints: Record<string, string> = {};
    for (const [agentType, endpoint] of this.agentEndpoints.entries()) {
      endpoints[agentType] = endpoint;
    }
    return endpoints as Record<AgentType, string>;
  }
}

// Re-exported union type to help consumers handle stream events without importing from SDK everywhere
export type A2AStreamEvent = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

/**
 * Message Router for handling A2A protocol messages
 */
export class MessageRouter {
  private communicationManager: A2ACommunicationManager;

  constructor(communicationManager: A2ACommunicationManager) {
    this.communicationManager = communicationManager;
  }

  /**
   * Route a message to the appropriate handler
   */
  async routeMessage(message: A2AMessage): Promise<TaskResponse | void | boolean> {
    switch (message.type) {
      case 'task-request':
        return await this.handleTaskRequest(message);
      case 'status-update':
        return await this.handleStatusUpdate(message);
      case 'error':
        return await this.handleError(message);
      case 'cancel':
        return await this.handleCancel(message);
      case "task-response": { throw new Error('Not implemented yet: "task-response" case') }
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  private async handleTaskRequest(message: A2AMessage): Promise<TaskResponse> {
    const payload = message.payload as TaskRequest;
    // Determine agent type from task parameters
    const agentType = this.determineAgentType(payload);

    return await this.communicationManager.sendTask(agentType, payload);
  }

  private async handleStatusUpdate(message: A2AMessage): Promise<void> {
    // Handle status updates from agents
    flowlogger.info(`Status update from ${message.from}:`, message.payload);
    // In a real implementation, this would update orchestration state
  }

  private async handleError(message: A2AMessage): Promise<void> {
    // Handle error messages from agents
    flowlogger.error(`Error from ${message.from}:`, message.payload);
    // In a real implementation, this would trigger error recovery
  }

  private async handleCancel(message: A2AMessage): Promise<boolean> {
    // Validate payload shape at runtime since message.payload is typed as unknown
    const {payload} = message;
    if (typeof payload !== 'object' || payload === null) {
      flowlogger.warn(`Cancel message from ${message.from} has invalid payload:`, payload);
      return false;
    }
    const maybe = payload as { taskId?: unknown };
    if (typeof maybe.taskId !== 'string') {
      flowlogger.warn(`Cancel message from ${message.from} missing valid taskId:`, payload);
      return false;
    }

    return await this.communicationManager.cancelTask(maybe.taskId);
  }

  private determineAgentType(taskRequest: TaskRequest): AgentType {
    // Determine agent type based on task parameters
    // This is a simplified implementation
    const taskType = taskRequest.type;

    if (taskType.includes('web') || taskType.includes('search')) {
      return 'web-research';
    } else if (taskType.includes('academic') || taskType.includes('scholar')) {
      return 'academic-research';
    } else if (taskType.includes('news') || taskType.includes('current')) {
      return 'news-research';
    } else if (taskType.includes('data') || taskType.includes('analysis') || taskType.includes('statistics')) {
      return 'data-analysis';
    }

    // Default to web research for general tasks
    return 'web-research';
  }
}

/**
 * Lightweight runtime validator for TaskResponse
 * Adjust the checks here if TaskResponse shape changes (e.g. add artifact checks)
 */
function isTaskResponse(obj: unknown): obj is TaskResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  interface PartialTaskResponse {
    taskId?: string;
    status?: string | object;
  }
  const { taskId, status } = obj as PartialTaskResponse;
  // Basic required shape checks - adjust fields to match your TaskResponse interface
  if (typeof taskId !== 'string') {
    return false;
  }
  if (typeof status !== 'string' && typeof status !== 'object') {
    // allow string statuses or structured status objects depending on your interface
    return false;
  }
  return true;
}

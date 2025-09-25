import type { A2AMessage, TaskRequest, TaskResponse, AgentType } from '../shared/interfaces.js';

/**
 * A2A Communication Manager for orchestrating inter-agent messaging
 * Handles task delegation, result collection, and status monitoring
 */
export class A2ACommunicationManager {
  private agentEndpoints: Map<AgentType, string> = new Map();
  private pendingTasks: Map<string, TaskRequest> = new Map();
  private taskTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Initialize agent endpoints from environment or configuration
    this.initializeAgentEndpoints();
  }

  private initializeAgentEndpoints(): void {
    // These would typically come from environment variables or service discovery
    this.agentEndpoints.set('web-research', process.env.WEB_RESEARCH_AGENT_URL ?? 'http://localhost:41246');
    this.agentEndpoints.set('academic-research', process.env.ACADEMIC_RESEARCH_AGENT_URL ?? 'http://localhost:41247');
    this.agentEndpoints.set('news-research', process.env.NEWS_RESEARCH_AGENT_URL ?? 'http://localhost:41248');
    this.agentEndpoints.set('data-analysis', process.env.DATA_ANALYSIS_AGENT_URL ?? 'http://localhost:41249');
  }

  /**
   * Send a task to the appropriate research agent
   */
  async sendTask(agentType: AgentType, taskRequest: TaskRequest): Promise<TaskResponse> {
    const endpoint = this.agentEndpoints.get(agentType);
    if (!endpoint) {
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

      const taskResponse: TaskResponse = await response.json();

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
      console.error('Some parallel tasks failed:', error);
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

      // In a real implementation, this would send a cancel request to the agent
      // For now, just remove from local tracking
      return true;
    }

    return false;
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskId: string): void {
    console.warn(`Task ${taskId} timed out`);
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
  async routeMessage(message: A2AMessage): Promise<any> {
    switch (message.type) {
      case 'task-request':
        return await this.handleTaskRequest(message);
      case 'status-update':
        return await this.handleStatusUpdate(message);
      case 'error':
        return await this.handleError(message);
      case 'cancel':
        return await this.handleCancel(message);
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
    console.log(`Status update from ${message.from}:`, message.payload);
    // In a real implementation, this would update orchestration state
  }

  private async handleError(message: A2AMessage): Promise<void> {
    // Handle error messages from agents
    console.error(`Error from ${message.from}:`, message.payload);
    // In a real implementation, this would trigger error recovery
  }

  private async handleCancel(message: A2AMessage): Promise<boolean> {
    const { taskId } = message.payload;
    return await this.communicationManager.cancelTask(taskId);
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
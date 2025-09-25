import type { OrchestrationState, A2AMessage } from '../shared/interfaces.js';
import { ResearchStepExecution, TaskResponse } from '../shared/interfaces.js';
import type { TaskDelegator } from './task-delegator.js';

/**
 * Message Router for the Orchestrator Agent
 * Handles A2A message routing, agent discovery, and communication coordination
 */
export class MessageRouter {
  private agentRegistry: Map<string, AgentInfo> = new Map();
  private messageQueue: A2AMessage[] = [];
  private routingRules: Map<string, RoutingRule[]> = new Map();

  constructor(private taskDelegator: TaskDelegator) {
    this.initializeRoutingRules();
  }

  /**
   * Register an agent with the router
   */
  registerAgent(agentId: string, info: AgentInfo): void {
    this.agentRegistry.set(agentId, {
      ...info,
      registeredAt: new Date(),
      lastSeen: new Date(),
      status: 'active'
    });
  }

  /**
   * Unregister an agent from the router
   */
  unregisterAgent(agentId: string): void {
    this.agentRegistry.delete(agentId);
    // Clean up routing rules for this agent
    this.routingRules.delete(agentId);
  }

  /**
   * Route a message to the appropriate agent(s)
   */
  async routeMessage(message: A2AMessage, orchestrationState: OrchestrationState): Promise<RoutingResult> {
    const routingDecision = await this.determineRouting(message, orchestrationState);

    if (routingDecision.targets.length === 0) {
      return {
        success: false,
        error: 'No suitable routing targets found',
        messageId: message.id
      };
    }

    const results: RouteResult[] = [];

    for (const target of routingDecision.targets) {
      try {
        const result = await this.sendToAgent(message, target);
        results.push(result);

        // Update agent status based on response
        this.updateAgentStatus(target.agentId, result.success);

      } catch (error) {
        results.push({
          agentId: target.agentId,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const success = results.some(r => r.success);
    const errors = results.filter(r => !r.success).map(r => r.error);

    return {
      success,
      messageId: message.id,
      results,
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  }

  /**
   * Determine the best routing targets for a message
   */
  private async determineRouting(message: A2AMessage, orchestrationState: OrchestrationState): Promise<RoutingDecision> {
    const targets: RouteTarget[] = [];
    const rules = this.routingRules.get(message.type) || [];

    // Apply routing rules
    for (const rule of rules) {
      if (await this.evaluateRule(rule, message, orchestrationState)) {
        const agent = this.agentRegistry.get(rule.targetAgentId);
        if (agent && agent.status === 'active') {
          targets.push({
            agentId: rule.targetAgentId,
            priority: rule.priority,
            timeout: rule.timeout
          });
        }
      }
    }

    // If no rules matched, use default routing
    if (targets.length === 0) {
      targets.push(...this.getDefaultTargets(message, orchestrationState));
    }

    // Sort by priority and limit to max targets
    targets.sort((a, b) => b.priority - a.priority);

    return {
      targets: targets.slice(0, 3), // Max 3 targets
      strategy: targets.length > 1 ? 'parallel' : 'single'
    };
  }

  /**
   * Send a message to a specific agent
   */
  private async sendToAgent(message: A2AMessage, target: RouteTarget): Promise<RouteResult> {
    const agent = this.agentRegistry.get(target.agentId);
    if (!agent) {
      throw new Error(`Agent ${target.agentId} not found in registry`);
    }

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), target.timeout);
      });

      // Send the message (this would integrate with actual A2A transport)
      const responsePromise = this.sendMessageToAgent(message, agent);

      const response = await Promise.race([responsePromise, timeoutPromise]);

      return {
        agentId: target.agentId,
        success: true,
        response,
        responseTime: Date.now()
      };

    } catch (error) {
      return {
        agentId: target.agentId,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Send message to agent (placeholder for actual A2A transport)
   */
  private async sendMessageToAgent(message: A2AMessage, agent: AgentInfo): Promise<any> {
    // This would be replaced with actual A2A communication
    // For now, simulate agent response based on message type

    switch (message.type) {
      case 'task-request':
        // For task requests, we would delegate through the task delegator
        // Since delegateStep is private, we'll simulate the delegation
        return { status: 'delegated', taskId: message.payload?.taskId };

      case 'status-update':
        return { status: 'acknowledged' };

      case 'error':
        return { status: 'error-received' };

      default:
        return { status: 'processed' };
    }
  }

  /**
   * Evaluate a routing rule against a message
   */
  private async evaluateRule(rule: RoutingRule, message: A2AMessage, orchestrationState: OrchestrationState): Promise<boolean> {
    // Check message type match
    if (rule.messageType && rule.messageType !== message.type) {
      return false;
    }

    // Check agent capability match
    if (rule.requiredCapability) {
      const agent = this.agentRegistry.get(rule.targetAgentId);
      if (!agent?.capabilities.includes(rule.requiredCapability)) {
        return false;
      }
    }

    // Check orchestration state conditions
    if (rule.condition) {
      return this.evaluateCondition(rule.condition, orchestrationState);
    }

    return true;
  }

  /**
   * Evaluate a routing condition
   */
  private evaluateCondition(condition: RoutingCondition, orchestrationState: OrchestrationState): boolean {
    switch (condition.type) {
      case 'step-status':
        { const step = orchestrationState.activeSteps.find(e => e.stepId === condition.stepId);
        return step?.status === condition.expectedStatus; }

      case 'agent-availability':
        { if (!condition.agentId) {
          return false;
        }
        const agent = this.agentRegistry.get(condition.agentId);
        return agent?.status === 'active'; }

      case 'load-threshold':
        { if (!condition.agentId || condition.threshold === undefined) {
          return false;
        }
        const load = this.getAgentLoad(condition.agentId);
        return load < condition.threshold; }

      default:
        return true;
    }
  }

  /**
   * Get default routing targets when no rules match
   */
  private getDefaultTargets(message: A2AMessage, orchestrationState: OrchestrationState): RouteTarget[] {
    const targets: RouteTarget[] = [];

    // For task execution messages, route to appropriate agent types
    if (message.type === 'task-request') {
      const step = message.payload?.step;
      if (step) {
        const { agentType } = step;
        const agents = Array.from(this.agentRegistry.values())
          .filter(agent => agent.type === agentType && agent.status === 'active')
          .map(agent => ({
            agentId: agent.id,
            priority: 1,
            timeout: 30000
          }));

        targets.push(...agents);
      }
    }

    // For other messages, route to orchestrator agents
    if (targets.length === 0) {
      const orchestrators = Array.from(this.agentRegistry.values())
        .filter(agent => agent.type === 'orchestrator' && agent.status === 'active')
        .map(agent => ({
          agentId: agent.id,
          priority: 1,
          timeout: 30000
        }));

      targets.push(...orchestrators);
    }

    return targets;
  }

  /**
   * Initialize default routing rules
   */
  private initializeRoutingRules(): void {
    // Task execution routing
    this.routingRules.set('task-execution', [
      {
        id: 'web-research-routing',
        messageType: 'task-execution',
        targetAgentId: 'web-research-agent',
        requiredCapability: 'web-search',
        priority: 2,
        timeout: 60000,
        condition: {
          type: 'step-status',
          stepId: '${step.id}',
          expectedStatus: 'pending'
        }
      },
      {
        id: 'academic-research-routing',
        messageType: 'task-execution',
        targetAgentId: 'academic-research-agent',
        requiredCapability: 'academic-search',
        priority: 2,
        timeout: 120000,
        condition: {
          type: 'step-status',
          stepId: '${step.id}',
          expectedStatus: 'pending'
        }
      }
    ]);

    // Status update routing
    this.routingRules.set('status-update', [
      {
        id: 'orchestrator-status',
        messageType: 'status-update',
        targetAgentId: 'orchestrator-agent',
        priority: 1,
        timeout: 10000
      }
    ]);

    // Health check routing
    this.routingRules.set('health-check', [
      {
        id: 'health-check-all',
        messageType: 'health-check',
        targetAgentId: 'all',
        priority: 1,
        timeout: 5000
      }
    ]);
  }

  /**
   * Update agent status based on routing result
   */
  private updateAgentStatus(agentId: string, success: boolean): void {
    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.lastSeen = new Date();
      if (!success) {
        agent.consecutiveFailures = (agent.consecutiveFailures || 0) + 1;
        if (agent.consecutiveFailures >= 3) {
          agent.status = 'unhealthy';
        }
      } else {
        agent.consecutiveFailures = 0;
        agent.status = 'active';
      }
    }
  }

  /**
   * Get current load for an agent
   */
  private getAgentLoad(agentId: string): number {
    // Simplified load calculation - would be more sophisticated in real implementation
    const agent = this.agentRegistry.get(agentId);
    return agent?.activeTasks || 0;
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): RoutingStats {
    const agents = Array.from(this.agentRegistry.values());
    const activeAgents = agents.filter(a => a.status === 'active').length;
    const totalMessages = this.messageQueue.length;

    return {
      totalAgents: agents.length,
      activeAgents,
      queuedMessages: totalMessages,
      averageResponseTime: 0 // Would track this in real implementation
    };
  }

  /**
   * Clean up inactive agents
   */
  cleanupInactiveAgents(maxAge = 300000): void { // 5 minutes default
    const now = Date.now();
    for (const [agentId, agent] of this.agentRegistry.entries()) {
      if (now - agent.lastSeen.getTime() > maxAge) {
        this.unregisterAgent(agentId);
      }
    }
  }
}

/**
 * Type definitions for message routing
 */
export interface AgentInfo {
  id: string;
  type: string;
  capabilities: string[];
  endpoint: string;
  status: 'active' | 'inactive' | 'unhealthy';
  registeredAt: Date;
  lastSeen: Date;
  consecutiveFailures?: number;
  activeTasks?: number;
}

export interface RoutingRule {
  id: string;
  messageType?: string;
  targetAgentId: string;
  requiredCapability?: string;
  priority: number;
  timeout: number;
  condition?: RoutingCondition;
}

export interface RoutingCondition {
  type: 'step-status' | 'agent-availability' | 'load-threshold';
  stepId?: string;
  expectedStatus?: string;
  agentId?: string;
  threshold?: number;
}

export interface RouteTarget {
  agentId: string;
  priority: number;
  timeout: number;
}

export interface RoutingDecision {
  targets: RouteTarget[];
  strategy: 'single' | 'parallel' | 'fallback';
}

export interface RouteResult {
  agentId: string;
  success: boolean;
  response?: any;
  responseTime?: number;
  error?: string;
}

export interface RoutingResult {
  success: boolean;
  messageId: string;
  results?: RouteResult[];
  error?: string;
}

export interface RoutingStats {
  totalAgents: number;
  activeAgents: number;
  queuedMessages: number;
  averageResponseTime: number;
}
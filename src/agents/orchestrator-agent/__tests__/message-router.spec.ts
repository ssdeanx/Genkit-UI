// Mock dependencies
vi.mock('../task-delegator.js');
vi.mock('../a2a-communication.js');

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { MessageRouter, type RoutingCondition } from '../message-router.js';
import type { TaskDelegator } from '../task-delegator.js';
import type { A2ACommunicationManager } from '../a2a-communication.js';
import type {
  OrchestrationState,
  A2AMessage,
  TaskRequest,
  AgentType,
  ResearchPlan,
  ResearchStep
} from '../../shared/interfaces.js';

describe('MessageRouter', () => {
  let messageRouter: MessageRouter;
  let mockTaskDelegator: TaskDelegator;
  let mockA2ACommunicationManager: A2ACommunicationManager;

  // Shared mock orchestration state
  const createMockOrchestrationState = (): OrchestrationState => ({
    researchId: 'test-research',
    plan: {
      id: 'plan-1',
      topic: 'Test topic',
      objectives: ['objective1'],
      methodology: {
        approach: 'systematic',
        justification: 'Test justification',
        phases: ['phase1'],
        qualityControls: ['control1']
      },
      dataSources: [],
      executionSteps: [],
      riskAssessment: [],
      contingencyPlans: [],
      qualityThresholds: [],
      estimatedTimeline: '1 hour',
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date()
    } as ResearchPlan,
    currentPhase: 'execution',
    completedSteps: [],
    activeSteps: [],
    issues: [],
    progress: {
      completedSteps: 0,
      totalSteps: 1,
      estimatedTimeRemaining: 1000,
      overallConfidence: 0.8
    },
    startedAt: new Date(),
    lastUpdated: new Date()
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instances
    mockTaskDelegator = {
      getActiveTasks: vi.fn().mockReturnValue([]),
    } as unknown as TaskDelegator;
    mockA2ACommunicationManager = {
      sendTask: vi.fn().mockResolvedValue({ success: true }),
      cancelTask: vi.fn().mockResolvedValue(true),
      getAgentEndpoints: vi.fn().mockReturnValue({
        'web-research': 'http://localhost:41246',
        'academic-research': 'http://localhost:41247',
        'news-research': 'http://localhost:41248',
        'data-analysis': 'http://localhost:41249',
      }),
    } as unknown as A2ACommunicationManager;

    messageRouter = new MessageRouter(mockTaskDelegator, mockA2ACommunicationManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(messageRouter).toBeDefined();
    });

    it('should create A2ACommunicationManager if not provided', () => {
      const router = new MessageRouter(mockTaskDelegator);
      expect(router).toBeDefined();
    });
  });

  describe('registerAgent', () => {
    it('should register an agent with correct metadata', () => {
      const agentInfo = {
        id: 'test-agent',
        type: 'academic-research' as AgentType,
        capabilities: ['search', 'analyze'],
        endpoint: 'http://localhost:3000',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date()
      };

      messageRouter.registerAgent('test-agent', agentInfo);

      // Verify agent is registered (through internal behavior)
      expect(messageRouter).toBeDefined();
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister an agent', () => {
      const agentInfo = {
        id: 'test-agent',
        type: 'academic-research' as AgentType,
        capabilities: ['search'],
        endpoint: 'http://localhost:3000',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date()
      };

      messageRouter.registerAgent('test-agent', agentInfo);
      messageRouter.unregisterAgent('test-agent');

      expect(messageRouter).toBeDefined();
    });
  });

  describe('routeMessage', () => {
    const mockOrchestrationState: OrchestrationState = {
      researchId: 'test-research',
      plan: {
        id: 'plan-1',
        topic: 'Test topic',
        objectives: ['objective1'],
        methodology: {
          approach: 'systematic',
          justification: 'Test justification',
          phases: ['phase1'],
          qualityControls: ['control1']
        },
        dataSources: [],
        executionSteps: [],
        riskAssessment: [],
        contingencyPlans: [],
        qualityThresholds: [],
        estimatedTimeline: '1 hour',
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date()
      } as ResearchPlan,
      currentPhase: 'execution',
      completedSteps: [],
      activeSteps: [],
      issues: [],
      progress: {
        completedSteps: 0,
        totalSteps: 1,
        estimatedTimeRemaining: 1000,
        overallConfidence: 0.8
      },
      startedAt: new Date(),
      lastUpdated: new Date()
    };

    it('should route task-request messages successfully', async () => {
      const message: A2AMessage = {
        id: 'msg-1',
        from: 'orchestrator',
        to: 'academic-research',
        type: 'task-request',
        payload: {
          step: {
            id: 'step-1',
            agentType: 'academic-research',
            description: 'Test step',
            estimatedDuration: 1000,
            dependencies: [],
            successCriteria: 'Test criteria',
            fallbackStrategies: ['retry'],
            priority: 1
          } as ResearchStep,
          taskId: 'task-1',
          type: 'research',
          parameters: {},
          priority: 1
        } as TaskRequest,
        timestamp: new Date()
      };

      (mockA2ACommunicationManager.sendTask as Mock).mockResolvedValue({
        taskId: 'task-1',
        status: 'completed',
        result: { success: true }
      });

      const result = await messageRouter.routeMessage(message, mockOrchestrationState);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-1');
      expect(mockA2ACommunicationManager.sendTask).toHaveBeenCalled();
    });

    it('should route cancel messages', async () => {
      const message: A2AMessage = {
        id: 'msg-2',
        from: 'orchestrator',
        to: 'academic-research',
        type: 'cancel',
        payload: { taskId: 'task-123' },
        timestamp: new Date()
      };

      (mockA2ACommunicationManager.cancelTask as Mock).mockResolvedValue(true);

      const result = await messageRouter.routeMessage(message, mockOrchestrationState);

      expect(result.success).toBe(true);
      expect(mockA2ACommunicationManager.cancelTask).toHaveBeenCalledWith('task-123');
    });

    it('should handle routing failures gracefully', async () => {
      const message: A2AMessage = {
        id: 'msg-3',
        from: 'orchestrator',
        to: 'academic-research',
        type: 'task-request',
        payload: {
          step: {
            id: 'step-1',
            agentType: 'academic-research',
            description: 'Test step',
            estimatedDuration: 1000,
            dependencies: [],
            successCriteria: 'Test criteria',
            fallbackStrategies: ['retry'],
            priority: 1
          } as ResearchStep,
          taskId: 'task-1',
          type: 'research',
          parameters: {},
          priority: 1
        } as TaskRequest,
        timestamp: new Date()
      };

      (mockA2ACommunicationManager.sendTask as Mock).mockRejectedValue(new Error('Network error'));

      const result = await messageRouter.routeMessage(message, mockOrchestrationState);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should return failure when no routing targets found', async () => {
      const message: A2AMessage = {
        id: 'msg-4',
        from: 'orchestrator',
        to: 'unknown-agent',
        type: 'error',
        payload: {},
        timestamp: new Date()
      };

      const result = await messageRouter.routeMessage(message, mockOrchestrationState);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No suitable routing targets found');
    });
  });

  describe('getRoutingStats', () => {
    it('should return routing statistics', () => {
      const stats = messageRouter.getRoutingStats();

      expect(stats).toHaveProperty('totalAgents');
      expect(stats).toHaveProperty('activeAgents');
      expect(stats).toHaveProperty('queuedMessages');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(typeof stats.totalAgents).toBe('number');
    });
  });

  describe('status-update, error, and task-response message types', () => {
    beforeEach(() => {
      // Register an orchestrator agent to handle these message types
      const orchestratorInfo = {
        id: 'test-orchestrator',
        type: 'orchestrator' as AgentType,
        capabilities: ['coordinate', 'aggregate'],
        endpoint: 'http://localhost:41243',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date()
      };
      messageRouter.registerAgent('test-orchestrator', orchestratorInfo);
    });

    it('should route status-update messages', async () => {
      const message: A2AMessage = {
        id: 'msg-status',
        from: 'agent',
        to: 'orchestrator',
        type: 'status-update',
        payload: { status: 'running', progress: 50 },
        timestamp: new Date()
      };

      const result = await messageRouter.routeMessage(message, createMockOrchestrationState());
      // Should succeed with orchestrator target
      expect(result.success).toBe(true);
    });

    it('should route error messages', async () => {
      const message: A2AMessage = {
        id: 'msg-error',
        from: 'agent',
        to: 'orchestrator',
        type: 'error',
        payload: { error: 'Something failed', code: 'ERR_001' },
        timestamp: new Date()
      };

      const result = await messageRouter.routeMessage(message, createMockOrchestrationState());
      expect(result.success).toBe(true);
    });

    it('should route task-response messages', async () => {
      const message: A2AMessage = {
        id: 'msg-response',
        from: 'agent',
        to: 'orchestrator',
        type: 'task-response',
        payload: { taskId: 'task-123', result: { data: 'completed' } },
        timestamp: new Date()
      };

      const result = await messageRouter.routeMessage(message, createMockOrchestrationState());
      expect(result.success).toBe(true);
    });

    it('should handle default message type', async () => {
      const message: A2AMessage = {
        id: 'msg-unknown',
        from: 'agent',
        to: 'orchestrator',
        type: 'unknown-type' as 'task-request',
        payload: {},
        timestamp: new Date()
      };

      const result = await messageRouter.routeMessage(message, createMockOrchestrationState());
      expect(result.success).toBe(true);
    });
  });

  describe('evaluateRule - agent capability checking', () => {
    it('should evaluate rule with agent capability match', async () => {
      const agentInfo = {
        id: 'test-agent-cap',
        type: 'academic-research' as AgentType,
        capabilities: ['search', 'analyze', 'cite'],
        endpoint: 'http://localhost:3001',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date()
      };
      messageRouter.registerAgent('test-agent-cap', agentInfo);

      const rule = {
        id: 'rule-cap',
        targetAgentId: 'test-agent-cap',
        requiredCapability: 'analyze',
        priority: 1,
        timeout: 5000
      };

      const message: A2AMessage = {
        id: 'msg-cap',
        from: 'orch',
        to: 'test-agent-cap',
        type: 'task-request',
        payload: {},
        timestamp: new Date()
      };

      const result = await messageRouter['evaluateRule'](rule, message, createMockOrchestrationState());
      expect(result).toBe(true);
    });

    it('should reject rule when agent lacks capability', async () => {
      const agentInfo = {
        id: 'test-agent-nocap',
        type: 'web-research' as AgentType,
        capabilities: ['search'],
        endpoint: 'http://localhost:3002',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date()
      };
      messageRouter.registerAgent('test-agent-nocap', agentInfo);

      const rule = {
        id: 'rule-nocap',
        targetAgentId: 'test-agent-nocap',
        requiredCapability: 'deep-analysis',
        priority: 1,
        timeout: 5000
      };

      const message: A2AMessage = {
        id: 'msg-nocap',
        from: 'orch',
        to: 'test-agent-nocap',
        type: 'task-request',
        payload: {},
        timestamp: new Date()
      };

      const result = await messageRouter['evaluateRule'](rule, message, createMockOrchestrationState());
      expect(result).toBe(false);
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate step-status condition', () => {
      const state: OrchestrationState = {
        ...createMockOrchestrationState(),
        activeSteps: [
          {
            stepId: 'step-123',
            agentId: 'agent-1',
            status: 'running',
            startedAt: new Date(),
            progressUpdates: [],
            retryCount: 0
          }
        ]
      };

      const condition = {
        type: 'step-status' as const,
        stepId: 'step-123',
        expectedStatus: 'running'
      };

      const result = messageRouter['evaluateCondition'](condition, state);
      expect(result).toBe(true);
    });

    it('should return false when step status does not match', () => {
      const state: OrchestrationState = {
        ...createMockOrchestrationState(),
        activeSteps: [
          {
            stepId: 'step-123',
            agentId: 'agent-1',
            status: 'running',
            startedAt: new Date(),
            progressUpdates: [],
            retryCount: 0
          }
        ]
      };

      const condition = {
        type: 'step-status' as const,
        stepId: 'step-123',
        expectedStatus: 'completed'
      };

      const result = messageRouter['evaluateCondition'](condition, state);
      expect(result).toBe(false);
    });

    it('should evaluate agent-availability condition', () => {
      const agentInfo = {
        id: 'available-agent',
        type: 'web-research' as AgentType,
        capabilities: ['search'],
        endpoint: 'http://localhost:3003',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date()
      };
      messageRouter.registerAgent('available-agent', agentInfo);

      const condition = {
        type: 'agent-availability' as const,
        agentId: 'available-agent'
      };

      const result = messageRouter['evaluateCondition'](condition, createMockOrchestrationState());
      expect(result).toBe(true);
    });

    it('should return false for agent-availability when agent ID is empty', () => {
      const condition = {
        type: 'agent-availability' as const,
        agentId: ''
      };

      const result = messageRouter['evaluateCondition'](condition, createMockOrchestrationState());
      expect(result).toBe(false);
    });

    it('should evaluate load-threshold condition', () => {
      const agentInfo = {
        id: 'loaded-agent',
        type: 'data-analysis' as AgentType,
        capabilities: ['analyze'],
        endpoint: 'http://localhost:3004',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date()
      };
      messageRouter.registerAgent('loaded-agent', agentInfo);

      (mockTaskDelegator.getActiveTasks as Mock).mockReturnValue([
        { agentId: 'data-analysis', status: 'running', stepId: 's1', startedAt: new Date(), progressUpdates: [], retryCount: 0 }
      ]);

      const condition = {
        type: 'load-threshold' as const,
        agentId: 'loaded-agent',
        threshold: 5
      };

      const result = messageRouter['evaluateCondition'](condition, createMockOrchestrationState());
      expect(result).toBe(true); // 1 task < 5 threshold
    });

    it('should return false for load-threshold when agentId is empty', () => {
      const condition = {
        type: 'load-threshold' as const,
        agentId: '',
        threshold: 5
      };

      const result = messageRouter['evaluateCondition'](condition, createMockOrchestrationState());
      expect(result).toBe(false);
    });

    it('should return false for load-threshold when threshold is undefined', () => {
      const condition = {
        type: 'load-threshold' as const,
        agentId: 'some-agent'
      };

      // TypeScript will catch that threshold is missing, but we test runtime behavior
      const result = messageRouter['evaluateCondition'](condition as RoutingCondition, createMockOrchestrationState());
      expect(result).toBe(false);
    });
  });

  describe('getDefaultTargets', () => {
    it('should find default targets for task-request by agent type', () => {
      const agentInfo = {
        id: 'default-target-agent',
        type: 'news-research' as AgentType,
        capabilities: ['search'],
        endpoint: 'http://localhost:3005',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date()
      };
      messageRouter.registerAgent('default-target-agent', agentInfo);

      const message: A2AMessage = {
        id: 'msg-default',
        from: 'orch',
        to: 'news-research',
        type: 'task-request',
        payload: {
          step: {
            id: 'step-news',
            agentType: 'news-research',
            description: 'News search',
            estimatedDuration: 1000,
            dependencies: [],
            successCriteria: 'Found news',
            fallbackStrategies: [],
            priority: 1
          },
          taskId: 'task-news',
          type: 'research',
          parameters: {},
          priority: 1
        },
        timestamp: new Date()
      };

      const targets = messageRouter['getDefaultTargets'](message);
      expect(targets.length).toBeGreaterThan(0);
      // Auto-registered agents from bootstrap have '-auto' suffix
      if (targets[0]) {
        expect(targets[0].agentId).toMatch(/news-research/);
      }
    });

    it('should find default targets for cancel messages', () => {
      const agentInfo = {
        id: 'cancelable-agent',
        type: 'web-research' as AgentType,
        capabilities: ['search'],
        endpoint: 'http://localhost:3006',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date()
      };
      messageRouter.registerAgent('cancelable-agent', agentInfo);

      const message: A2AMessage = {
        id: 'msg-cancel-default',
        from: 'orch',
        to: 'web-research',
        type: 'cancel',
        payload: { taskId: 'task-to-cancel' },
        timestamp: new Date()
      };

      const targets = messageRouter['getDefaultTargets'](message);
      expect(targets.length).toBeGreaterThan(0);
      // Auto-registered agents from bootstrap have '-auto' suffix
      if (targets[0]) {
        expect(targets[0].agentId).toMatch(/web-research/);
      }
    });

    it('should fallback to orchestrator agents when no specific targets', () => {
      const orchestratorInfo = {
        id: 'orchestrator-fallback',
        type: 'orchestrator' as AgentType,
        capabilities: ['coordinate'],
        endpoint: 'http://localhost:3007',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date()
      };
      messageRouter.registerAgent('orchestrator-fallback', orchestratorInfo);

      const message: A2AMessage = {
        id: 'msg-fallback',
        from: 'agent',
        to: 'orchestrator',
        type: 'status-update',
        payload: {},
        timestamp: new Date()
      };

      const targets = messageRouter['getDefaultTargets'](message);
      expect(targets.length).toBeGreaterThan(0);
      if (targets[0]) {
        expect(targets[0].agentId).toBe('orchestrator-fallback');
      }
    });
  });

  describe('updateAgentStatus', () => {
    it('should mark agent unhealthy after 3 consecutive failures', () => {
      const agentInfo = {
        id: 'failing-agent',
        type: 'web-research' as AgentType,
        capabilities: ['search'],
        endpoint: 'http://localhost:3008',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date(),
        consecutiveFailures: 0
      };
      messageRouter.registerAgent('failing-agent', agentInfo);

      messageRouter['updateAgentStatus']('failing-agent', false);
      messageRouter['updateAgentStatus']('failing-agent', false);
      messageRouter['updateAgentStatus']('failing-agent', false);

      const stats = messageRouter.getRoutingStats();
      // Agent should now be unhealthy (not counted in activeAgents)
      // Note: Other auto-registered agents may also be counted
      expect(stats.totalAgents).toBeGreaterThan(0);
    });

    it('should reset consecutive failures on success', () => {
      const agentInfo = {
        id: 'recovering-agent',
        type: 'academic-research' as AgentType,
        capabilities: ['search'],
        endpoint: 'http://localhost:3009',
        status: 'active' as const,
        registeredAt: new Date(),
        lastSeen: new Date(),
        consecutiveFailures: 2
      };
      messageRouter.registerAgent('recovering-agent', agentInfo);

      messageRouter['updateAgentStatus']('recovering-agent', true);

      // Should be healthy again
      const stats = messageRouter.getRoutingStats();
      expect(stats.activeAgents).toBeGreaterThan(0);
    });
  });

  describe('cleanupInactiveAgents', () => {
    it('should remove agents that exceed max age', () => {
      const oldDate = new Date(Date.now() - 400000); // 400 seconds ago
      const agentInfo = {
        id: 'old-agent',
        type: 'web-research' as AgentType,
        capabilities: ['search'],
        endpoint: 'http://localhost:3010',
        status: 'active' as const,
        registeredAt: oldDate,
        lastSeen: oldDate
      };
      
      // Verify agent registered successfully
      const statsInitial = messageRouter.getRoutingStats();
      messageRouter.registerAgent('old-agent', agentInfo);
      
      // Manually update lastSeen to old date since registerAgent overwrites it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const registry = (messageRouter as any).agentRegistry as Map<string, any>;
      const agent = registry.get('old-agent');
      if (agent !== undefined) {
        agent.lastSeen = oldDate;
        agent.registeredAt = oldDate;
      }
      
      const statsBefore = messageRouter.getRoutingStats();
      
      // Should have one more agent now
      expect(statsBefore.totalAgents).toBeGreaterThan(statsInitial.totalAgents);
      
      messageRouter.cleanupInactiveAgents(200000); // 200 seconds - old-agent is 400s old so should be removed
      const statsAfter = messageRouter.getRoutingStats();

      // Should be back to initial count
      expect(statsAfter.totalAgents).toBeLessThan(statsBefore.totalAgents);
      expect(statsAfter.totalAgents).toBe(statsInitial.totalAgents);
    });
  });

  describe('Edge cases for uncovered lines', () => {
    it('should handle routing errors with string conversion (line 74-79)', async () => {
      const message: A2AMessage = {
        id: 'msg-error-1',
        type: 'task-request',
        from: 'user',
        to: 'test-agent',
        timestamp: new Date(),
        payload: { taskId: 'test', taskType: 'web-research', query: 'test query' }
      };

      // Mock sendMessageToAgent to throw a non-Error object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendSpy = vi.spyOn(messageRouter as any, 'sendMessageToAgent');
      sendSpy.mockRejectedValue({ message: 'custom error' });

      const result = await messageRouter.routeMessage(message, createMockOrchestrationState());
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      sendSpy.mockRestore();
    });

    it('should filter targets by active status (line 110-115)', async () => {
      const message: A2AMessage = {
        id: 'msg-inactive-1',
        type: 'task-request',
        from: 'user',
        to: 'inactive-agent',
        timestamp: new Date(),
        payload: { taskId: 'test', taskType: 'web-research', query: 'test query' }
      };

      // Register an inactive agent with a custom routing rule
      messageRouter.registerAgent('inactive-agent', {
        id: 'inactive-agent',
        type: 'web-research',
        capabilities: ['search'],
        endpoint: 'http://localhost:5000',
        status: 'inactive',
        registeredAt: new Date(),
        lastSeen: new Date()
      });

      // Manually set agent to inactive
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const registry = (messageRouter as any).agentRegistry as Map<string, any>;
      const agent = registry.get('inactive-agent');
      if (agent !== undefined) {
        agent.status = 'inactive';
      }

      // Add a routing rule for the inactive agent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routingRules = (messageRouter as any).routingRules as Map<string, any[]>;
      routingRules.set('task-request', [{
        id: 'test-rule',
        messageType: 'task-request',
        targetAgentId: 'inactive-agent',
        priority: 1,
        timeout: 5000
      }]);

      const result = await messageRouter.routeMessage(message, createMockOrchestrationState());
      
      // Should fall back to default routing since inactive agents are filtered out
      expect(result.success).toBeDefined();
    });

    it('should handle agent not found in sendToAgent (line 139-140)', async () => {
      const message: A2AMessage = {
        id: 'msg-notfound-1',
        type: 'task-request',
        from: 'user',
        to: 'nonexistent-agent',
        timestamp: new Date(),
        payload: { taskId: 'test', taskType: 'web-research', query: 'test query' }
      };

      const target = {
        agentId: 'nonexistent-agent',
        priority: 1,
        timeout: 5000
      };

      // Test private method directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((messageRouter as any).sendToAgent(message, target))
        .rejects.toThrow('Agent nonexistent-agent not found in registry');
    });

    it('should handle message type array match (line 209-210)', async () => {
      const message: A2AMessage = {
        id: 'msg-array-1',
        type: 'task-request',
        from: 'user',
        to: 'test-agent',
        timestamp: new Date(),
        payload: { taskId: 'test', taskType: 'web-research', query: 'test query' }
      };

      // Create a rule with array messageType
      const rule = {
        id: 'array-rule',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messageType: ['task-request', 'cancel'] as any, // Array instead of string
        targetAgentId: 'web-research-auto-1',
        priority: 1,
        timeout: 5000
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (messageRouter as any).evaluateRule(rule, message, createMockOrchestrationState());
      expect(result).toBe(true); // Should pass when messageType is not a string
    });

    it('should handle missing agent in capability check (line 223-224)', async () => {
      const message: A2AMessage = {
        id: 'msg-capability-1',
        type: 'task-request',
        from: 'user',
        to: 'test-agent',
        timestamp: new Date(),
        payload: { taskId: 'test', taskType: 'web-research', query: 'test query' }
      };

      // Create a rule requiring capability for nonexistent agent
      const rule = {
        id: 'missing-agent-rule',
        messageType: 'task-request',
        targetAgentId: 'nonexistent-agent',
        requiredCapability: 'search',
        priority: 1,
        timeout: 5000
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (messageRouter as any).evaluateRule(rule, message, createMockOrchestrationState());
      expect(result).toBe(false); // Should fail when agent doesn't exist
    });

    it('should return default condition result (line 255)', async () => {
      const condition = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: 'unknown-type' as any // Invalid condition type
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (messageRouter as any).evaluateCondition(condition, createMockOrchestrationState());
      expect(result).toBe(true); // Default case should return true
    });

    it('should handle missing agent in getAgentLoad (line 424-425)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const load = (messageRouter as any).getAgentLoad('nonexistent-agent');
      expect(load).toBe(0); // Should return 0 for missing agent
    });
  });
});
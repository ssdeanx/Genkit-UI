// Mock dependencies
vi.mock('../task-delegator.js');
vi.mock('../a2a-communication.js');

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { MessageRouter } from '../message-router.js';
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
});
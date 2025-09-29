import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { StreamingHandler } from '../streaming-handler.js';
import type {
  OrchestrationState,
  ResearchStepExecution,
  A2AMessage,
  ResearchPlan,
  ResearchStep
} from '../../shared/interfaces.js';

// Mock the logger
vi.mock('./logger.js', () => ({
  log: vi.fn(),
}));

describe('StreamingHandler', () => {
  let streamingHandler: StreamingHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    streamingHandler = new StreamingHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to create valid ResearchPlan
  const createResearchPlan = (overrides: Partial<ResearchPlan> = {}): ResearchPlan => ({
    id: 'plan1',
    topic: 'Test topic',
    objectives: [],
    methodology: {
      approach: 'systematic' as const,
      justification: 'Test',
      phases: [],
      qualityControls: [],
    },
    dataSources: [],
    executionSteps: [],
    riskAssessment: [],
    contingencyPlans: [],
    qualityThresholds: [],
    estimatedTimeline: '',
    version: '1.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // Helper function to create valid OrchestrationState
  const createOrchestrationState = (overrides: Partial<OrchestrationState> = {}): OrchestrationState => ({
    researchId: 'research1',
    plan: createResearchPlan({}),
    currentPhase: 'execution',
    activeSteps: [],
    completedSteps: [],
    issues: [],
    progress: {
      completedSteps: 0,
      totalSteps: 1,
      estimatedTimeRemaining: 10,
      overallConfidence: 0.8,
    },
    startedAt: new Date(),
    lastUpdated: new Date(),
    ...overrides,
  });

  describe('startStream', () => {
    it('should create a new streaming session', () => {
      const orchestrationState = createOrchestrationState({
        plan: createResearchPlan({
          executionSteps: [
            { id: 'step1', description: 'Step 1', agentType: 'web-research', dependencies: [], estimatedDuration: 10, successCriteria: 'Success', fallbackStrategies: [], priority: 1 },
            { id: 'step2', description: 'Step 2', agentType: 'academic-research', dependencies: [], estimatedDuration: 10, successCriteria: 'Success', fallbackStrategies: [], priority: 1 },
          ] as ResearchStep[],
        }),
        progress: { completedSteps: 0, totalSteps: 2, estimatedTimeRemaining: 20, overallConfidence: 0.8 },
      });

      const session = streamingHandler.startStream('research1', orchestrationState);

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^stream-research1-\d+$/);
      expect(session.researchId).toBe('research1');
      expect(session.status).toBe('active');
      expect(session.totalSteps).toBe(2);
      expect(session.completedSteps).toBe(0);
      expect(session.progress).toBe(0);
    });
  });

  describe('updateProgress', () => {
    it('should update progress for an active stream', () => {
      const orchestrationState = createOrchestrationState({
        plan: createResearchPlan({ executionSteps: [] }),
      });

      streamingHandler.startStream('research1', orchestrationState);

      const stepExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'agent1',
        status: 'running',
        progressUpdates: [],
        retryCount: 0,
      };

      const progressUpdate = {
        timestamp: new Date(),
        message: 'Processing step 1',
        percentage: 50,
        currentActivity: 'Searching',
        estimatedTimeRemaining: 5,
      };

      streamingHandler.updateProgress('research1', stepExecution, progressUpdate);

      const session = streamingHandler.getStreamState('research1');
      expect(session?.currentStep).toBe('step1');
      expect(session?.lastUpdate).toBeInstanceOf(Date);
    });

    it('should not update progress for non-existent stream', () => {
      const stepExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'agent1',
        status: 'running',
        progressUpdates: [],
        retryCount: 0,
      };

      const progressUpdate = {
        timestamp: new Date(),
        message: 'Processing step 1',
        percentage: 50,
        currentActivity: 'Searching',
        estimatedTimeRemaining: 5,
      };

      // Should not throw
      expect(() => {
        streamingHandler.updateProgress('nonexistent', stepExecution, progressUpdate);
      }).not.toThrow();
    });
  });

  describe('subscribeToStream', () => {
    it('should subscribe to a research stream', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      const subscriber = {
        subscriptionId: '',
        subscribedAt: new Date(),
        callback: vi.fn(),
      };

      const subscriptionId = streamingHandler.subscribeToStream('research1', subscriber);

      expect(subscriptionId).toMatch(/^sub-research1-\d+-[a-z0-9]+$/);
      expect(subscriber.callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session-state',
          session: expect.any(Object),
        })
      );
    });
  });

  describe('unsubscribeFromStream', () => {
    it('should unsubscribe from a research stream', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      const subscriber = {
        subscriptionId: '',
        subscribedAt: new Date(),
        callback: vi.fn()
      };
      const subscriptionId = streamingHandler.subscribeToStream('research1', subscriber);

      const result = streamingHandler.unsubscribeFromStream('research1', subscriptionId);
      expect(result).toBe(true);
    });
  });

  describe('getStreamState', () => {
    it('should return stream state for active research', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      const state = streamingHandler.getStreamState('research1');
      expect(state).toBeDefined();
      expect(state?.researchId).toBe('research1');
      expect(state?.status).toBe('active');
    });
  });

  describe('getRecentProgress', () => {
    it('should return recent progress updates', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      const stepExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'agent1',
        status: 'running',
        progressUpdates: [],
        retryCount: 0,
      };

      // Add some progress updates
      for (let i = 0; i < 5; i++) {
        const progressUpdate = {
          timestamp: new Date(),
          message: `Update ${i}`,
          percentage: i * 20,
          currentActivity: 'Processing',
          estimatedTimeRemaining: 10 - i,
        };
        streamingHandler.updateProgress('research1', stepExecution, progressUpdate);
      }

      const recent = streamingHandler.getRecentProgress('research1', 3);
      expect(recent).toHaveLength(3);
      expect(recent[recent.length - 1]?.message).toBe('Update 4');
    });

    it('should limit results to specified count', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      const recent = streamingHandler.getRecentProgress('research1', 5);
      expect(recent).toHaveLength(0); // No updates yet
    });
  });

  describe('unsubscribeFromStream', () => {
    it('should unsubscribe from a research stream', () => {
      const orchestrationState = createOrchestrationState();
      streamingHandler.startStream('research1', orchestrationState);

      const subscriber = {
        subscriptionId: '',
        subscribedAt: new Date(),
        callback: vi.fn(),
      };
      const subscriptionId = streamingHandler.subscribeToStream('research1', subscriber);

      const result = streamingHandler.unsubscribeFromStream('research1', subscriptionId);
      expect(result).toBe(true);
    });

    it('should return false for non-existent subscription', () => {
      const result = streamingHandler.unsubscribeFromStream('research1', 'nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getStreamState', () => {
    it('should return stream state for active research', () => {
      const orchestrationState = createOrchestrationState();
      streamingHandler.startStream('research1', orchestrationState);

      const state = streamingHandler.getStreamState('research1');
      expect(state).toBeDefined();
      expect(state?.researchId).toBe('research1');
      expect(state?.status).toBe('active');
    });

    it('should return null for non-existent research', () => {
      const state = streamingHandler.getStreamState('nonexistent');
      expect(state).toBeNull();
    });
  });

  describe('getRecentProgress', () => {
    it('should return recent progress updates', () => {
      const orchestrationState = createOrchestrationState();
      streamingHandler.startStream('research1', orchestrationState);

      const stepExecution: ResearchStepExecution = {
        stepId: 'step1',
        agentId: 'agent1',
        status: 'running',
        progressUpdates: [],
        retryCount: 0,
      };

      // Add some progress updates
      for (let i = 0; i < 5; i++) {
        const progressUpdate = {
          timestamp: new Date(),
          message: `Update ${i}`,
          percentage: i * 20,
          currentActivity: 'Processing',
          estimatedTimeRemaining: 10 - i,
        };
        streamingHandler.updateProgress('research1', stepExecution, progressUpdate);
      }

      const recent = streamingHandler.getRecentProgress('research1', 3);
      expect(recent).toHaveLength(3);
      expect(recent[2]?.message).toBe('Update 4');
    });

    it('should limit results to specified count', () => {
      const orchestrationState = createOrchestrationState();
      streamingHandler.startStream('research1', orchestrationState);

      const recent = streamingHandler.getRecentProgress('research1', 5);
      expect(recent).toHaveLength(0); // No updates yet
    });
  });

  describe('handleStreamingMessage', () => {
    it('should handle status-update messages', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      const message: A2AMessage = {
        id: 'msg1',
        from: 'agent1',
        to: 'orchestrator',
        type: 'status-update',
        payload: {
          researchId: 'research1',
          stepId: 'step1',
          message: 'Processing complete',
          percentage: 100,
          currentActivity: 'Completed',
          estimatedTimeRemaining: 0,
          status: 'completed',
        },
        timestamp: new Date(),
      };

      streamingHandler.handleStreamingMessage(message);

      const session = streamingHandler.getStreamState('research1');
      expect(session?.currentStep).toBe('step1');
    });

    it('should ignore non-status-update messages', () => {
      const message: A2AMessage = {
        id: 'msg1',
        from: 'agent1',
        to: 'orchestrator',
        type: 'task-request',
        payload: {},
        timestamp: new Date(),
      };

      // Should not throw
      expect(() => {
        streamingHandler.handleStreamingMessage(message);
      }).not.toThrow();
    });

    it('should ignore messages for non-existent streams', () => {
      const message: A2AMessage = {
        id: 'msg1',
        from: 'agent1',
        to: 'orchestrator',
        type: 'status-update',
        payload: {
          researchId: 'nonexistent',
          stepId: 'step1',
          message: 'Processing',
        },
        timestamp: new Date(),
      };

      // Should not throw
      expect(() => {
        streamingHandler.handleStreamingMessage(message);
      }).not.toThrow();
    });
  });

  describe('handleA2AStreamEvent', () => {
    it('should handle message events', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      const event = {
        kind: 'message' as const,
        messageId: 'msg1',
        role: 'agent' as const,
        taskId: 'research1',
        parts: [{ kind: 'text' as const, text: 'Test message' }],
      };

      streamingHandler.handleA2AStreamEvent(event);

      const session = streamingHandler.getStreamState('research1');
      expect(session?.status).toBe('completed');
    });

    it('should handle task events', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      const event = {
        kind: 'task' as const,
        id: 'research1',
        contextId: 'ctx1',
        status: { state: 'working' as const },
      };

      streamingHandler.handleA2AStreamEvent(event);

      const session = streamingHandler.getStreamState('research1');
      expect(session?.status).toBe('active');
    });

    it('should handle status-update events', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      const event = {
        kind: 'status-update' as const,
        taskId: 'research1',
        contextId: 'ctx1',
        status: {
          state: 'completed' as const,
          message: {
            kind: 'message' as const,
            messageId: 'msg1',
            role: 'agent' as const,
            parts: [{ kind: 'text' as const, text: 'Completed' }]
          },
        },
        final: true,
      };

      streamingHandler.handleA2AStreamEvent(event);

      const session = streamingHandler.getStreamState('research1');
      expect(session?.status).toBe('completed');
    });

    it('should handle artifact-update events', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      const event = {
        kind: 'artifact-update' as const,
        taskId: 'research1',
        contextId: 'ctx1',
        artifact: {
          name: 'result',
          artifactId: 'art1',
          parts: [{ kind: 'text' as const, text: 'Result data' }]
        },
      };

      streamingHandler.handleA2AStreamEvent(event);

      const session = streamingHandler.getStreamState('research1');
      expect(session?.status).toBe('active');
    });

    it('should ignore events for non-existent streams', () => {
      const event = {
        kind: 'message' as const,
        messageId: 'msg1',
        role: 'agent' as const,
        taskId: 'nonexistent',
        parts: [{ kind: 'text' as const, text: 'Test' }],
      };

      // Should not throw
      expect(() => {
        streamingHandler.handleA2AStreamEvent(event);
      }).not.toThrow();
    });
  });

  describe('endStream', () => {
    it('should end an active stream with completed status', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      streamingHandler.endStream('research1', 'completed');

      const session = streamingHandler.getStreamState('research1');
      expect(session?.status).toBe('completed');
      expect(session?.endedAt).toBeInstanceOf(Date);
    });

    it('should end an active stream with failed status', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      streamingHandler.endStream('research1', 'failed');

      const session = streamingHandler.getStreamState('research1');
      expect(session?.status).toBe('failed');
    });

    it('should not throw for non-existent streams', () => {
      expect(() => {
        streamingHandler.endStream('nonexistent', 'completed');
      }).not.toThrow();
    });
  });

  describe('getStreamingStats', () => {
    it('should return streaming statistics', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      const stats = streamingHandler.getStreamingStats();

      expect(stats).toHaveProperty('activeStreams');
      expect(stats).toHaveProperty('totalSubscribers');
      expect(stats).toHaveProperty('averageProgress');
      expect(stats).toHaveProperty('oldestStream');
      expect(stats.activeStreams).toBe(1);
      expect(typeof stats.totalSubscribers).toBe('number');
    });

    it('should return zero stats when no streams are active', () => {
      const stats = streamingHandler.getStreamingStats();

      expect(stats.activeStreams).toBe(0);
      expect(stats.totalSubscribers).toBe(0);
      expect(stats.averageProgress).toBe(0);
      expect(stats.oldestStream).toBeNull();
    });
  });

  describe('cleanupInactiveStreams', () => {
    it('should clean up inactive streams', () => {
      const orchestrationState = createOrchestrationState({});
      streamingHandler.startStream('research1', orchestrationState);

      // Mock the session as old
      const session = streamingHandler.getStreamState('research1');
      if (session) {
        session.lastUpdate = new Date(Date.now() - 7200000); // 2 hours ago
      }

      streamingHandler.cleanupInactiveStreams(3600000); // 1 hour max age

      const cleanedSession = streamingHandler.getStreamState('research1');
      expect(cleanedSession).toBeNull();
    });
  });
});
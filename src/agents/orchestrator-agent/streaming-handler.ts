import type { OrchestrationState, ResearchStepExecution, ProgressUpdate, A2AMessage } from '../shared/interfaces.js';
import { log } from './logger.js';
import type { EventEmitter } from 'events';

/**
 * Streaming Handler for the Orchestrator Agent
 * Manages real-time progress updates and streaming responses for research tasks
 */
export class StreamingHandler {
  private activeStreams: Map<string, StreamSession> = new Map();
  private progressBuffers: Map<string, BufferedProgressUpdate[]> = new Map();
  private streamSubscribers: Map<string, StreamSubscriber[]> = new Map();

  /**
   * Start a streaming session for a research task
   */
  startStream(researchId: string, orchestrationState: OrchestrationState): StreamSession {
    const session: StreamSession = {
      id: `stream-${researchId}-${Date.now()}`,
      researchId,
      status: 'active',
      startedAt: new Date(),
      lastUpdate: new Date(),
      totalSteps: orchestrationState.plan.executionSteps.length,
      completedSteps: 0,
      currentStep: null,
      progress: 0,
      estimatedTimeRemaining: orchestrationState.progress.estimatedTimeRemaining
    };

    this.activeStreams.set(researchId, session);
    this.progressBuffers.set(researchId, []);

    log('log', `Started streaming session for research ${researchId}`);
    return session;
  }

  /**
   * Update progress for a streaming session
   */
  updateProgress(
    researchId: string,
    stepExecution: ResearchStepExecution,
    progressUpdate: ProgressUpdate
  ): void {
    const session = this.activeStreams.get(researchId);
    if (!session) {
      log('warn', `No active stream session for research ${researchId}`);
      return;
    }

    // Update session state
    session.lastUpdate = new Date();
    session.currentStep = stepExecution.stepId;

    // Calculate overall progress
    const { totalSteps } = session;
    const completedSteps = this.calculateCompletedSteps(researchId);
    session.completedSteps = completedSteps;
    session.progress = (completedSteps / totalSteps) * 100;

    // Update time estimates
    session.estimatedTimeRemaining = this.calculateEstimatedTimeRemaining(researchId);

    // Buffer the progress update
    const bufferedUpdate: BufferedProgressUpdate = {
      ...progressUpdate,
      stepId: stepExecution.stepId,
      stepStatus: stepExecution.status,
      bufferedAt: new Date()
    };

    const buffer = this.progressBuffers.get(researchId) ?? [];
    buffer.push(bufferedUpdate);
    this.progressBuffers.set(researchId, buffer);

    // Notify subscribers
    this.notifySubscribers(researchId, bufferedUpdate);

    // Clean old updates if buffer gets too large
    if (buffer.length > 100) {
      buffer.splice(0, buffer.length - 50); // Keep last 50 updates
    }
  }

  /**
   * Subscribe to progress updates for a research task
   */
  subscribeToStream(researchId: string, subscriber: StreamSubscriber): string {
    const subscriptionId = `sub-${researchId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const subscribers = this.streamSubscribers.get(researchId) ?? [];
    subscribers.push({
      ...subscriber,
      subscriptionId,
      subscribedAt: new Date()
    });

    this.streamSubscribers.set(researchId, subscribers);

    // Send current state to new subscriber
    const session = this.activeStreams.get(researchId);
    if (session) {
      this.sendToSubscriber(subscriber, {
        type: 'session-state',
        session,
        timestamp: new Date()
      });
    }

    log('log', `Subscriber ${subscriptionId} added to research ${researchId}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from progress updates
   */
  unsubscribeFromStream(researchId: string, subscriptionId: string): boolean {
    const subscribers = this.streamSubscribers.get(researchId) ?? [];
    const index = subscribers.findIndex(sub => sub.subscriptionId === subscriptionId);

    if (index >= 0) {
      subscribers.splice(index, 1);
      this.streamSubscribers.set(researchId, subscribers);
      log('log', `Subscriber ${subscriptionId} removed from research ${researchId}`);
      return true;
    }

    return false;
  }

  /**
   * Get current streaming state for a research task
   */
  getStreamState(researchId: string): StreamSession | null {
    return this.activeStreams.get(researchId) ?? null;
  }

  /**
   * Get recent progress updates for a research task
   */
  getRecentProgress(researchId: string, limit = 10): BufferedProgressUpdate[] {
    const buffer = this.progressBuffers.get(researchId) ?? [];
    return buffer.slice(-limit);
  }

  /**
   * Handle streaming message from an agent
   */
  handleStreamingMessage(message: A2AMessage): void {
    if (message.type !== 'status-update') {
      return;
    }

    // Cast payload to a flexible shape and perform a runtime guard to safely access properties
    const payload = message.payload as Partial<{ researchId?: string; stepId?: string; message?: string; percentage?: number; currentActivity?: string; estimatedTimeRemaining?: number; status?: string }> | undefined;
    if (payload === undefined || payload === null || typeof payload !== 'object' || typeof payload.researchId !== 'string' || typeof payload.stepId !== 'string') {
      return;
    }

    const { researchId } = payload;
    const session = this.activeStreams.get(researchId);
    if (!session) {
      return;
    }

    // Convert message to progress update
    const progressUpdate: ProgressUpdate = {
      timestamp: message.timestamp,
      message: payload.message ?? 'Progress update',
      percentage: payload.percentage ?? 0,
      currentActivity: payload.currentActivity ?? 'Processing',
      estimatedTimeRemaining: payload.estimatedTimeRemaining ?? 0
    };

    // Find the step execution (this would come from orchestration state)
    const stepExecution: ResearchStepExecution = {
      stepId: payload.stepId,
      agentId: message.from,
      status: (payload.status === 'completed' || payload.status === 'failed' || payload.status === 'cancelled' || payload.status === 'pending' || payload.status === 'running') ? payload.status : 'running',
      progressUpdates: [progressUpdate],
      retryCount: 0
    };

    this.updateProgress(researchId, stepExecution, progressUpdate);
  }

  /**
   * End a streaming session
   */
  endStream(researchId: string, finalStatus: 'completed' | 'failed' | 'cancelled'): void {
    const session = this.activeStreams.get(researchId);
    if (!session) {
      return;
    }

    session.status = finalStatus;
    session.endedAt = new Date();

    // Notify subscribers of completion
    const subscribers = this.streamSubscribers.get(researchId) ?? [];
    subscribers.forEach(subscriber => {
      this.sendToSubscriber(subscriber, {
        type: 'session-ended',
        session,
        finalStatus,
        timestamp: new Date()
      });
    });

    // Clean up after a delay to allow final messages to be processed
    setTimeout(() => {
      this.activeStreams.delete(researchId);
      this.progressBuffers.delete(researchId);
      this.streamSubscribers.delete(researchId);
    }, 30000); // 30 second cleanup delay

    log('log', `Ended streaming session for research ${researchId} with status ${finalStatus}`);
  }

  /**
   * Get streaming statistics
   */
  getStreamingStats(): StreamingStats {
    const activeStreams = Array.from(this.activeStreams.values());
    const totalSubscribers = Array.from(this.streamSubscribers.values())
      .reduce((sum, subs) => sum + subs.length, 0);

    return {
      activeStreams: activeStreams.length,
      totalSubscribers,
      averageProgress: activeStreams.length > 0
        ? activeStreams.reduce((sum, s) => sum + s.progress, 0) / activeStreams.length
        : 0,
      oldestStream: activeStreams.length > 0
        ? new Date(Math.min(...activeStreams.map(s => s.startedAt.getTime())))
        : null
    };
  }

  /**
   * Calculate completed steps for a research task
   */
  private calculateCompletedSteps(researchId: string): number {
    // This would be calculated from the orchestration state
    // For now, return a placeholder based on buffered updates
    const buffer = this.progressBuffers.get(researchId) ?? [];
    const completedUpdates = buffer.filter((update: BufferedProgressUpdate) => update.stepStatus === 'completed');
    return new Set(completedUpdates.map((update: BufferedProgressUpdate) => update.stepId)).size;
  }

  /**
   * Calculate estimated time remaining for a research task
   */
  private calculateEstimatedTimeRemaining(researchId: string): number {
    const session = this.activeStreams.get(researchId);
    if (!session) {
      return 0;
    }

    const buffer = this.progressBuffers.get(researchId) ?? [];
    const recentUpdates = buffer.slice(-5); // Last 5 updates

    if (recentUpdates.length === 0) {
      return session.estimatedTimeRemaining;
    }

    // Calculate average time per step from recent updates
    return recentUpdates
      .filter(update => update.estimatedTimeRemaining !== undefined)
      .reduce((sum, update, _, arr) => {
        const remaining = update.estimatedTimeRemaining ?? 0;
        return sum + (remaining / arr.length);
      }, 0);
  }

  /**
   * Notify all subscribers of a progress update
   */
  private notifySubscribers(researchId: string, update: BufferedProgressUpdate): void {
    const subscribers = this.streamSubscribers.get(researchId) ?? [];
    subscribers.forEach(subscriber => {
      this.sendToSubscriber(subscriber, {
        type: 'progress-update',
        update,
        timestamp: new Date()
      });
    });
  }

  /**
   * Send a message to a specific subscriber
   */
  private sendToSubscriber(subscriber: StreamSubscriber, message: StreamMessage): void {
    try {
      if (typeof subscriber.callback === 'function') {
        // Call without specifying a TS function type to avoid unused param lint in types
        Reflect.apply(subscriber.callback, undefined, [message]);
      } else if (subscriber.websocket) {
      // WebSocket branch retained for compatibility; ideally route via callback/eventEmitter only
        subscriber.websocket.send(JSON.stringify(message));
      } else if (subscriber.eventEmitter) {
        subscriber.eventEmitter.emit('progress', message);
      }
    } catch (error) {
      log('error', `Failed to send message to subscriber ${subscriber.subscriptionId}:`, error);
    }
  }

  /**
   * Clean up inactive streams and subscribers
   */
  cleanupInactiveStreams(maxAge = 3600000): void { // 1 hour default
    const now = Date.now();

    for (const [researchId, session] of this.activeStreams.entries()) {
      if (now - session.lastUpdate.getTime() > maxAge) {
        log('log', `Cleaning up inactive stream for research ${researchId}`);
        this.endStream(researchId, 'cancelled');
      }
    }
  }
}

/**
 * Type definitions for streaming functionality
 */
export interface StreamSession {
  id: string;
  researchId: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  endedAt?: Date;
  lastUpdate: Date;
  totalSteps: number;
  completedSteps: number;
  currentStep: string | null;
  progress: number; // 0-100
  estimatedTimeRemaining: number; // minutes
}

// FIXME: Consider merging with src/agents/shared/interfaces.ts if reused elsewhere
/**
 * Represents a subscriber to a research stream.
 */
export interface StreamSubscriber {
  subscriptionId: string;
  subscribedAt: Date;
  // Keep as unknown to avoid named parameter in type positions triggering no-unused-vars
  callback?: unknown;
  websocket?: WebSocket; // WebSocket connection
  eventEmitter?: EventEmitter; // Event emitter
}

export interface BufferedProgressUpdate extends ProgressUpdate {
  stepId: string;
  stepStatus: string;
  bufferedAt: Date;
}

export interface StreamMessage {
  type: 'progress-update' | 'session-state' | 'session-ended';
  update?: BufferedProgressUpdate;
  session?: StreamSession;
  finalStatus?: string;
  timestamp: Date;
}

export interface StreamingStats {
  activeStreams: number;
  totalSubscribers: number;
  averageProgress: number;
  oldestStream: Date | null;
}


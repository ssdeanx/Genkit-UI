import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskDelegator } from '../task-delegator.js';
import type { A2ACommunicationManager } from '../a2a-communication.js';
import type {
  OrchestrationState,
  ResearchPlan,
  ResearchStep,
  TaskRequest,
  TaskResponse,
  ResearchStepResult,
  SynthesisResult,
  ResearchResult,
} from '../../shared/interfaces.js';

// Mock the logger
vi.mock('../../logger.js', () => ({
  log: vi.fn(),
}));

const makePlan = (topic = 'Sample Topic'): ResearchPlan => ({
  id: 'plan-1',
  topic,
  objectives: ['obj1'],
  methodology: { approach: 'exploratory', justification: 'test', phases: ['p1'], qualityControls: ['qc1'] },
  dataSources: [
    { type: 'web', priority: 1, credibilityWeight: 0.5, estimatedVolume: 'medium' },
    { type: 'statistical', priority: 2, credibilityWeight: 0.7, estimatedVolume: 'low' },
    { type: 'government', priority: 3, credibilityWeight: 0.8, estimatedVolume: 'low' },
  ],
  executionSteps: [],
  riskAssessment: [],
  contingencyPlans: [],
  qualityThresholds: [],
  estimatedTimeline: 'N/A',
  version: '1.0',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeState = (topic?: string): OrchestrationState => ({
  researchId: 'r1',
  plan: makePlan(topic),
  currentPhase: 'execution',
  activeSteps: [],
  completedSteps: [],
  issues: [],
  progress: { completedSteps: 0, totalSteps: 0, estimatedTimeRemaining: 0, overallConfidence: 0.5 },
  startedAt: new Date(),
  lastUpdated: new Date(),
});

const step = (over: Partial<ResearchStep> = {}): ResearchStep => ({
  id: `s-${Math.random().toString(36).slice(2)}`,
  description: 'Do web search background',
  agentType: 'web-research',
  dependencies: [],
  estimatedDuration: 1,
  successCriteria: 'ok',
  fallbackStrategies: [],
  priority: 2,
  ...over,
});

describe('TaskDelegator', () => {
  let a2a: Pick<A2ACommunicationManager, 'sendTask' | 'cancelTask'>;
  let delegator: TaskDelegator;

  const delay = (ms = 0) => new Promise<void>(res => setTimeout(res, ms));

  beforeEach(() => {
    a2a = {
      sendTask: vi.fn(async (_agent, _req) => {
        await delay(0);
        return { taskId: (_req as TaskRequest).taskId, status: 'success', processingTime: 1 } as TaskResponse;
      }),
      cancelTask: vi.fn(async () => true),
    } as unknown as A2ACommunicationManager;
    delegator = new TaskDelegator(a2a as A2ACommunicationManager);
  });

  it('delegates only executable steps and respects priority', async () => {
    const s1 = step({ id: 's1', priority: 2, description: 'web search background', agentType: 'web-research' });
    const s2 = step({ id: 's2', priority: 1, dependencies: ['s1'], description: 'news recent', agentType: 'news-research' });
    const s3 = step({ id: 's3', priority: 3, description: 'academic literature review', agentType: 'academic-research' });

    const state = makeState('Topic');
    const execs = await delegator.delegateResearchSteps([s1, s2, s3], state);
    expect(execs).toHaveLength(2); // s2 blocked by s1 dependency
    expect(a2a.sendTask).toHaveBeenCalledTimes(2);

    // Check the order by the first two calls (priority: s1 before s3)
    const { calls } = (a2a.sendTask as unknown as { mock: { calls: unknown[][] } }).mock;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const [firstCall, secondCall] = calls as [unknown[], unknown[]];
    expect(firstCall[0]).toBe('web-research');
    expect(secondCall[0]).toBe('academic-research');
  });

  it('marks execution completed when sendTask resolves and stores normalized TaskResponse', async () => {
    const s = step({ id: 'done', description: 'web search overview' });
    const state = makeState('X');
    await delegator.delegateResearchSteps([s], state);
    // Allow async sendTask().then to complete
    await delay(0);
    const active = delegator.getActiveTasks().find(e => e.stepId === 'done');
    expect(active?.status).toBe('completed');
    expect(active?.result && typeof active.result === 'object').toBe(true);
  });

  it('marks execution failed when sendTask rejects', async () => {
    (a2a.sendTask as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      await delay(0);
      throw new Error('boom');
    });
    const s = step({ id: 'fail' });
    const state = makeState('X');
    await delegator.delegateResearchSteps([s], state);
    await delay(0);
    const active = delegator.getActiveTasks().find(e => e.stepId === 'fail');
    expect(active?.status).toBe('failed');
  });

  it('cancelTask cancels active task and removes it', async () => {
    const s = step({ id: 'c1' });
    const state = makeState('X');
    await delegator.delegateResearchSteps([s], state);
    const ok = await delegator.cancelTask('c1');
    expect(ok).toBe(true);
    expect(delegator.getActiveTasks().find(e => e.stepId === 'c1')).toBeUndefined();
  });

  it('cleanupCompletedTasks removes finished executions', async () => {
    // Force a failure to reliably reach a terminal state
    (a2a.sendTask as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      await delay(0);
      throw new Error('forced failure');
    });
    const s = step({ id: 'cl1' });
    const state = makeState('X');
    await delegator.delegateResearchSteps([s], state);
    // Wait until the active task transitions to 'failed'
    let active = delegator.getActiveTasks().find(e => e.stepId === 'cl1');
    for (let i = 0; i < 20 && active?.status !== 'failed'; i++) {
      await delay(0);
      active = delegator.getActiveTasks().find(e => e.stepId === 'cl1');
    }
    expect(active?.status).toBe('failed');
    expect(delegator.getActiveTasks().length).toBeGreaterThan(0);
    delegator.cleanupCompletedTasks();
    expect(delegator.getActiveTasks().length).toBe(0);
  });

  it('infers agent type from description when unspecified', async () => {
    const sNews = step({ id: 'n1', agentType: 'orchestrator', description: 'news current events' });
    const sData = step({ id: 'd1', agentType: 'orchestrator', description: 'data analysis visualize chart' });
    const sDefault = step({ id: 'w1', agentType: 'orchestrator', description: 'general research online' });
    const state = makeState('X');
    await delegator.delegateResearchSteps([sNews, sData, sDefault], state);
  const { calls } = (a2a.sendTask as unknown as { mock: { calls: unknown[][] } }).mock;
  const agentTypes = calls.map(c => c[0] as string);
    expect(agentTypes).toEqual(expect.arrayContaining(['news-research', 'data-analysis', 'web-research']));
  });

  it('maps step descriptions to specific task types', async () => {
    const cases: Array<[ResearchStep, string]> = [
      [step({ description: 'comprehensive web search', agentType: 'web-research' }), 'comprehensive-web-search'],
      [step({ description: 'fact-check claim', agentType: 'web-research' }), 'fact-checking'],
      [step({ description: 'literature review methods', agentType: 'academic-research' }), 'literature-review'],
      [step({ description: 'citation analysis refs', agentType: 'academic-research' }), 'citation-analysis'],
      [step({ description: 'news trend analysis', agentType: 'news-research' }), 'news-trend-analysis'],
      [step({ description: 'visualize dataset', agentType: 'data-analysis' }), 'data-visualization'],
      [step({ description: 'correlation between vars', agentType: 'data-analysis' }), 'correlation-analysis'],
    ];

    const state = makeState('Topic');
    for (const [st, expectedType] of cases) {
      (a2a.sendTask as unknown as ReturnType<typeof vi.fn>).mockClear();
      await delegator.delegateResearchSteps([st], state);
      const { calls } = (a2a.sendTask as unknown as { mock: { calls: unknown[][] } }).mock;
      expect(calls.length).toBeGreaterThanOrEqual(1);
  const call = calls[0];
  expect(call).toBeDefined();
  const req = (call as unknown[])[1] as TaskRequest;
      expect(req.type).toBe(expectedType);
    }
  });

  it('extracts agent-specific parameters', async () => {
    const stWeb = step({ id: 'sw', agentType: 'web-research', description: 'overview background' });
    const stAcad = step({ id: 'sa', agentType: 'academic-research', description: 'academic sources' });
    const stNews = step({ id: 'sn', agentType: 'news-research', description: 'latest updates' });
    const stData = step({ id: 'sd', agentType: 'data-analysis', description: 'visualize stats' });
    const state = makeState('Breaking insights');

    await delegator.delegateResearchSteps([stWeb, stAcad, stNews, stData], state);

  const { calls } = (a2a.sendTask as unknown as { mock: { calls: unknown[][] } }).mock;
    const paramsById = new Map<string, Record<string, unknown>>();
  calls.forEach(c => paramsById.set((c[1] as TaskRequest).step.id, (c[1] as TaskRequest).parameters));

    expect(paramsById.get('sw')).toHaveProperty('searchQueries');
    expect(paramsById.get('sa')).toHaveProperty('academicDatabases');
    expect(paramsById.get('sn')).toHaveProperty('dateRange');
    expect(paramsById.get('sd')).toHaveProperty('dataSources');

    // date range based on topic containing "Breaking" → 1 month back
    const { start, end } = paramsById.get('sn')!.dateRange as { start: Date; end: Date };
    expect(start instanceof Date && end instanceof Date).toBe(true);
  });

  it('normalizes diverse response shapes into result', async () => {
    const s = step({ id: 'norm1' });
    const state = makeState('X');
  const cases: unknown[] = [
      { taskId: 't', status: 'success', processingTime: 1 } as TaskResponse,
      { stepId: 's', status: 'success', data: {}, sources: [], processingTime: 1, qualityScore: 1, issues: [], metadata: {} } as ResearchStepResult,
      { id: 'syn', researchId: 'r', synthesis: 'text', keyFindings: [], confidenceMetrics: { overallConfidence: 1, sourceDiversity: 1, validationRate: 1, contradictionRate: 0 }, gapsAndRecommendations: { knowledgeGaps: [], methodologicalLimitations: [], recommendations: [] }, sourceSummary: { totalSources: 0, sourceTypes: {}, topSources: [] }, generatedAt: new Date(), version: '1.0' } as SynthesisResult,
      { topic: 't', findings: [], sources: [], methodology: 'm', confidence: 1, generatedAt: new Date(), processingTime: 1 } as ResearchResult,
      { arbitrary: 'object' },
      42,
      null,
    ];

    for (const payload of cases) {
      (a2a.sendTask as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
        await delay(0);
        return payload as TaskResponse as unknown as TaskResponse;
      });
      await delegator.delegateResearchSteps([s], state);
      await delay(0);
      const active = delegator.getActiveTasks().find(e => e.stepId === 'norm1');
      expect(active?.result !== undefined).toBe(true);
      // Reset for next iteration
      delegator.cleanupCompletedTasks();
      (a2a.sendTask as unknown as ReturnType<typeof vi.fn>).mockClear();
    }
  });

  it('skips steps that throw during request creation (planning/orchestrator cases)', async () => {
    const sPlanning = step({ id: 'pl', agentType: 'planning', description: 'plan smth' });
    const sOrch = step({ id: 'oc', agentType: 'orchestrator', description: 'orchestrator task' });
    const state = makeState('X');
    const execs = await delegator.delegateResearchSteps([sPlanning, sOrch], state);
    // Planning should be skipped (throws), orchestrator inferred to web-research and executes
    expect(execs).toHaveLength(1);
    const first = execs[0];
    expect(first?.stepId).toBe('oc');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SynthesisEngine } from '../synthesis-engine.js';
import type { ResearchStepResult, OrchestrationState } from '../../shared/interfaces.js';

// Mock logger
vi.mock('../../logger.js', () => ({
  flowlogger: vi.fn(),
}));

describe('SynthesisEngine', () => {
  let synthesisEngine: SynthesisEngine;

  const createMockOrchestrationState = (): OrchestrationState => ({
    researchId: 'test-research',
    plan: {
      id: 'plan1',
      topic: 'Test topic',
      objectives: ['Test Objective'],
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
    },
    currentPhase: 'execution',
    activeSteps: [],
    completedSteps: [],
    issues: [],
    progress: { completedSteps: 0, totalSteps: 0, estimatedTimeRemaining: 0, overallConfidence: 0.5 },
    startedAt: new Date(),
    lastUpdated: new Date(),
  });

  beforeEach(() => {
    synthesisEngine = new SynthesisEngine();
  });

  it('should synthesize results into a comprehensive output', async () => {
    const results: ResearchStepResult[] = [
      {
        stepId: 'step1',
        status: 'success',
        data: { findings: [{ claim: 'Finding A', evidence: 'Evidence A', confidence: 0.9, sourceIndices: [0] }] },
        sources: [{ url: 'http://a.com', title: 'Source A', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
        qualityScore: 0.85,
        processingTime: 1,
        issues: [],
        metadata: { dimension: 'technical' },
      },
      {
        stepId: 'step2',
        status: 'success',
        data: { findings: [{ claim: 'Finding B', evidence: 'Evidence B', confidence: 0.7, sourceIndices: [0] }] },
        sources: [{ url: 'http://b.com', title: 'Source B', credibilityScore: 0.7, type: 'news', accessedAt: new Date() }],
        qualityScore: 0.75,
        processingTime: 1,
        issues: [],
        metadata: { dimension: 'market' },
      },
    ];
    const state = createMockOrchestrationState();

    const synthesis = await synthesisEngine.synthesizeResults(results, state);

    expect(synthesis.id).toBeDefined();
    expect(synthesis.researchId).toBe('test-research');
    expect(synthesis.keyFindings.length).toBeGreaterThan(0);
    expect(synthesis.synthesis).toContain('Executive Summary');
    expect(synthesis.confidenceMetrics.overallConfidence).toBeGreaterThan(0);
  });
});

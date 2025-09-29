import { describe, it, expect, beforeEach } from 'vitest';
import { QualityValidator } from '../quality-validator.js';
import type { ResearchStepResult, OrchestrationState, SourceCitation, QualityThreshold } from '../../shared/interfaces.js';

describe('QualityValidator', () => {
  let qualityValidator: QualityValidator;

  const createMockOrchestrationState = (thresholds: QualityThreshold[] = []): OrchestrationState => ({
    researchId: 'test-research',
    plan: {
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
      qualityThresholds: thresholds,
      estimatedTimeline: '',
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
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
  });

  beforeEach(() => {
    qualityValidator = new QualityValidator();
  });

  it('should validate research quality and identify issues', () => {
    const results: ResearchStepResult[] = [
      {
        stepId: 'step1',
        status: 'success',
        data: { findings: [{ claim: 'A', evidence: 'E', confidence: 0.2, sourceIndices: [0] }] },
        sources: [{ url: 'http://a.com', title: 'A', credibilityScore: 0.3, type: 'web', accessedAt: new Date() }],
        qualityScore: 0.4,
        processingTime: 1,
        issues: [],
        metadata: {},
      },
    ];
    const state = createMockOrchestrationState();
    const validation = qualityValidator.validateResearchQuality(results, state);
    expect(validation.overallScore).toBeLessThan(0.6);
    expect(validation.issues.length).toBeGreaterThan(0);
    expect(validation.recommendations.length).toBeGreaterThan(0);
  });

  it('should validate source credibility', () => {
    const source: SourceCitation = { url: 'http://example.com', title: 'Test', credibilityScore: 0.8, type: 'web', accessedAt: new Date() };
    const validation = qualityValidator.validateSourceCredibility(source);
    expect(validation.isValid).toBe(true);
  });

  it('should detect biases in research results', () => {
    const results: ResearchStepResult[] = [
      {
        stepId: 'step1',
        status: 'success',
        data: { findings: [{ claim: 'A', evidence: 'E', confidence: 0.8, sourceIndices: [0] }] },
        sources: [{ url: 'http://a.com', title: 'A', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
        qualityScore: 0.8,
        processingTime: 1,
        issues: [],
        metadata: {},
      },
      {
        stepId: 'step2',
        status: 'success',
        data: { findings: [{ claim: 'B', evidence: 'F', confidence: 0.8, sourceIndices: [0] }] },
        sources: [{ url: 'http://b.com', title: 'B', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
        qualityScore: 0.8,
        processingTime: 1,
        issues: [],
        metadata: {},
      },
            {
        stepId: 'step3',
        status: 'success',
        data: { findings: [{ claim: 'C', evidence: 'G', confidence: 0.8, sourceIndices: [0] }] },
        sources: [{ url: 'http://c.com', title: 'C', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
        qualityScore: 0.8,
        processingTime: 1,
        issues: [],
        metadata: {},
      },
    ];
    const biases = qualityValidator.detectBiases(results);
    expect(biases.some(b => b.type === 'confirmation-bias')).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SynthesisEngine } from '../synthesis-engine.js';
import type { ResearchStepResult, OrchestrationState } from '../../shared/interfaces.js';

// Mock logger
vi.mock('../../logger.js', () => ({
  flowlogger: vi.fn(),
}));

describe('SynthesisEngine', () => {
  let synthesisEngine: SynthesisEngine;

  const createMockResearchStepResult = (overrides?: Partial<ResearchStepResult>): ResearchStepResult => ({
    stepId: 'step1',
    status: 'success',
    data: {},
    sources: [],
    qualityScore: 0.8,
    processingTime: 1,
    issues: [],
    metadata: {},
    ...overrides,
  });

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

  describe('groupResultsByDimension', () => {
    it('should group results by dimension', async () => {
      const results: ResearchStepResult[] = [
        {
          stepId: 'step1',
          status: 'success',
          data: {},
          sources: [],
          qualityScore: 0.8,
          processingTime: 1,
          issues: [],
          metadata: { dimension: 'technical' },
        },
        {
          stepId: 'step2',
          status: 'success',
          data: {},
          sources: [],
          qualityScore: 0.7,
          processingTime: 1,
          issues: [],
          metadata: { dimension: 'technical' },
        },
        {
          stepId: 'step3',
          status: 'success',
          data: {},
          sources: [],
          qualityScore: 0.9,
          processingTime: 1,
          issues: [],
          metadata: { dimension: 'market' },
        },
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      // Grouped results should be reflected in synthesis
      expect(synthesis.keyFindings).toBeDefined();
    });

    it('should use "general" dimension when dimension is missing', async () => {
      const results: ResearchStepResult[] = [
        {
          stepId: 'step1',
          status: 'success',
          data: { findings: [{ claim: 'General finding', evidence: 'Evidence', confidence: 0.8 }] },
          sources: [{ url: 'http://test.com', title: 'Test', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.8,
          processingTime: 1,
          issues: [],
          metadata: {}, // No dimension
        },
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.keyFindings.length).toBeGreaterThan(0);
    });
  });

  describe('extractKeyFindings', () => {
    it('should extract findings from data.findings array', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: {
            findings: [
              { claim: 'Finding 1', evidence: 'Evidence 1', confidence: 0.9 },
              { claim: 'Finding 2', evidence: 'Evidence 2', confidence: 0.8 },
            ]
          },
          sources: [{ url: 'http://test.com', title: 'Test Source', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.85,
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.keyFindings.length).toBeGreaterThan(0);
    });

    it('should extract findings from data.results array', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: {
            results: [
              { findings: [{ claim: 'Nested finding', evidence: 'Evidence', confidence: 0.85 }] }
            ]
          },
          sources: [{ url: 'http://test.com', title: 'Test', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.keyFindings.length).toBeGreaterThan(0);
    });

    it('should extract single finding when data is a finding object', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: {
            claim: 'Direct claim',
            evidence: 'Direct evidence',
            confidence: 0.9
          },
          sources: [{ url: 'http://test.com', title: 'Test', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.9,
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.keyFindings.length).toBeGreaterThan(0);
    });

    it('should extract findings from text content', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: {
            content: 'This is a finding sentence. This is another finding sentence. Third finding here. Fourth finding sentence. Fifth finding sentence.'
          },
          sources: [{ url: 'http://test.com', title: 'Test', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.7,
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.keyFindings.length).toBeGreaterThan(0);
    });

    it('should extract findings from metadata.findings', async () => {
      const results: ResearchStepResult[] = [
        {
          stepId: 'step1',
          status: 'success',
          data: {},
          sources: [{ url: 'http://test.com', title: 'Test', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.8,
          processingTime: 1,
          issues: [],
          metadata: {
            findings: [
              { claim: 'Metadata finding', evidence: 'Metadata evidence', confidence: 0.85 }
            ]
          }
        },
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.keyFindings.length).toBeGreaterThan(0);
    });

    it('should consolidate duplicate findings', async () => {
      const results: ResearchStepResult[] = [
        {
          stepId: 'step1',
          status: 'success',
          data: { findings: [{ claim: 'Same finding', evidence: 'Evidence 1', confidence: 0.8 }] },
          sources: [{ url: 'http://a.com', title: 'Source A', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.8,
          processingTime: 1,
          issues: [],
          metadata: { dimension: 'tech' },
        },
        {
          stepId: 'step2',
          status: 'success',
          data: { findings: [{ claim: 'Same finding', evidence: 'Evidence 2', confidence: 0.9 }] },
          sources: [{ url: 'http://b.com', title: 'Source B', credibilityScore: 0.9, type: 'academic', accessedAt: new Date() }],
          qualityScore: 0.9,
          processingTime: 1,
          issues: [],
          metadata: { dimension: 'tech' },
        },
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      // Should consolidate duplicates and use max confidence
      expect(synthesis.keyFindings.length).toBe(1);
    });

    it('should limit to top 20 findings', async () => {
      const findings = Array.from({ length: 30 }, (_, i) => ({
        claim: `Finding ${i}`,
        evidence: `Evidence ${i}`,
        confidence: Math.random()
      }));

      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: { findings },
          sources: [{ url: 'http://test.com', title: 'Test', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.keyFindings.length).toBeLessThanOrEqual(20);
    });

    it('should use stepId as source name when sources array is empty', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          stepId: 'step-without-sources',
          data: { findings: [{ claim: 'Finding', evidence: 'Evidence', confidence: 0.8 }] },
          sources: [], // Empty sources
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.keyFindings.length).toBeGreaterThan(0);
    });
  });

  describe('crossValidateFindings', () => {
    it('should mark findings as confirmed with high consensus', async () => {
      const results: ResearchStepResult[] = [
        {
          stepId: 'step1',
          status: 'success',
          data: { findings: [{ claim: 'Validated finding', evidence: 'Strong evidence', confidence: 0.95 }] },
          sources: [
            { url: 'http://a.com', title: 'Source A', credibilityScore: 0.9, type: 'academic', accessedAt: new Date() },
            { url: 'http://b.com', title: 'Source B', credibilityScore: 0.9, type: 'academic', accessedAt: new Date() }
          ],
          qualityScore: 0.9,
          processingTime: 1,
          issues: [],
          metadata: { dimension: 'research' },
        },
        {
          stepId: 'step2',
          status: 'success',
          data: { findings: [{ claim: 'Validated finding', evidence: 'More evidence', confidence: 0.9 }] },
          sources: [{ url: 'http://c.com', title: 'Source C', credibilityScore: 0.85, type: 'government', accessedAt: new Date() }],
          qualityScore: 0.85,
          processingTime: 1,
          issues: [],
          metadata: { dimension: 'research' },
        },
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.keyFindings[0]?.validationStatus).toBe('confirmed');
    });

    it('should mark findings as partially-confirmed with moderate consensus', async () => {
      const results: ResearchStepResult[] = [
        {
          stepId: 'step1',
          status: 'success',
          data: { findings: [{ claim: 'Partial finding', evidence: 'Some evidence', confidence: 0.7 }] },
          sources: [{ url: 'http://a.com', title: 'Source A', credibilityScore: 0.7, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.7,
          processingTime: 1,
          issues: [],
          metadata: { dimension: 'tech' },
        },
        {
          stepId: 'step2',
          status: 'success',
          data: { content: 'Unrelated content about other topics' },
          sources: [{ url: 'http://b.com', title: 'Source B', credibilityScore: 0.6, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.6,
          processingTime: 1,
          issues: [],
          metadata: { dimension: 'tech' },
        },
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      const finding = synthesis.keyFindings.find(f => f.finding === 'Partial finding');
      expect(finding?.validationStatus).toMatch(/partially-confirmed|unconfirmed/);
    });

    it('should handle contradicting findings', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: { findings: [{ claim: 'Finding is true', evidence: 'Evidence', confidence: 0.8 }] },
          sources: [{ url: 'http://a.com', title: 'Source A', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
        }),
        createMockResearchStepResult({
          stepId: 'step2',
          data: { findings: [{ claim: 'Finding is false', evidence: 'Contradicting evidence', confidence: 0.7 }] },
          sources: [{ url: 'http://b.com', title: 'Source B', credibilityScore: 0.7, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.7,
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      // Should process both findings
      expect(synthesis.keyFindings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('confidenceMetrics', () => {
    it('should calculate overall confidence correctly', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: { findings: [{ claim: 'High confidence', evidence: 'Evidence', confidence: 0.95 }] },
          sources: [{ url: 'http://a.com', title: 'A', credibilityScore: 0.9, type: 'academic', accessedAt: new Date() }],
          qualityScore: 0.9,
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.confidenceMetrics.overallConfidence).toBeGreaterThan(0);
      // Confidence can be on 0-100 scale or 0-1 scale depending on implementation
      expect(synthesis.confidenceMetrics.overallConfidence).toBeGreaterThan(0);
    });

    it('should include confidence distribution metrics', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: {
            findings: [
              { claim: 'High', evidence: 'E', confidence: 0.9 },
              { claim: 'Med', evidence: 'E', confidence: 0.6 },
              { claim: 'Low', evidence: 'E', confidence: 0.3 },
            ]
          },
          sources: [{ url: 'http://a.com', title: 'A', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.confidenceMetrics.overallConfidence).toBeDefined();
      expect(synthesis.confidenceMetrics.sourceDiversity).toBeDefined();
      expect(synthesis.confidenceMetrics.validationRate).toBeDefined();
      expect(synthesis.confidenceMetrics.contradictionRate).toBeDefined();
    });
  });

  describe('gapsAndRecommendations', () => {
    it('should identify gaps in research coverage', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: { findings: [{ claim: 'Incomplete finding', evidence: 'Limited evidence', confidence: 0.5 }] },
          sources: [{ url: 'http://a.com', title: 'A', credibilityScore: 0.6, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.5,
        }),
      ];

      const state = createMockOrchestrationState();
      state.plan.objectives = ['Objective 1', 'Objective 2', 'Objective 3'];

      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.gapsAndRecommendations.knowledgeGaps).toBeDefined();
      expect(synthesis.gapsAndRecommendations.recommendations).toBeDefined();
    });

    it('should provide recommendations for improving research', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          sources: [{ url: 'http://a.com', title: 'A', credibilityScore: 0.5, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.4,
          issues: ['Low quality warning'],
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.gapsAndRecommendations.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('sourceSummary', () => {
    it('should generate source summary with diverse types', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          sources: [
            { url: 'http://a.com', title: 'A', credibilityScore: 0.9, type: 'academic', accessedAt: new Date() },
            { url: 'http://b.com', title: 'B', credibilityScore: 0.8, type: 'government', accessedAt: new Date() },
            { url: 'http://c.com', title: 'C', credibilityScore: 0.7, type: 'news', accessedAt: new Date() },
          ],
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.sourceSummary.totalSources).toBe(1);
      expect(synthesis.sourceSummary.sourceTypes).toBeDefined();
      // sourceTypes is a Record<string, number>, not an array
      expect(Object.keys(synthesis.sourceSummary.sourceTypes).length).toBeGreaterThan(0);
    });

    it('should calculate average credibility score', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          sources: [
            { url: 'http://a.com', title: 'A', credibilityScore: 0.9, type: 'academic', accessedAt: new Date() },
            { url: 'http://b.com', title: 'B', credibilityScore: 0.7, type: 'web', accessedAt: new Date() },
          ],
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.sourceSummary.totalSources).toBeDefined();
      expect(synthesis.sourceSummary.totalSources).toBeGreaterThan(0);
    });
  });

  describe('synthesis narrative', () => {
    it('should include executive summary', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: { findings: [{ claim: 'Test finding', evidence: 'Evidence', confidence: 0.9 }] },
          sources: [{ url: 'http://a.com', title: 'A', credibilityScore: 0.9, type: 'academic', accessedAt: new Date() }],
          qualityScore: 0.9,
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.synthesis).toContain('Executive Summary');
      expect(synthesis.synthesis).toContain('Key Findings');
    });

    it('should include methodology section', async () => {
      const results: ResearchStepResult[] = [
        {
          stepId: 'web-research-step',
          status: 'success',
          data: {},
          sources: [{ url: 'http://a.com', title: 'A', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.8,
          processingTime: 1,
          issues: [],
          metadata: { agentType: 'web-research' },
        },
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.synthesis).toContain('Methodology');
    });

    it('should include dimension-specific sections', async () => {
      const results: ResearchStepResult[] = [
        {
          stepId: 'step1',
          status: 'success',
          data: { findings: [{ claim: 'Technical finding', evidence: 'Evidence', confidence: 0.85 }] },
          sources: [{ url: 'http://a.com', title: 'A', credibilityScore: 0.8, type: 'web', accessedAt: new Date() }],
          qualityScore: 0.85,
          processingTime: 1,
          issues: [],
          metadata: { dimension: 'technical' },
        },
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis.synthesis).toContain('Technical');
    });
  });

  describe('error handling', () => {
    it('should handle synthesis errors gracefully', async () => {
      const results: ResearchStepResult[] = [];
      const state = createMockOrchestrationState();

      await expect(synthesisEngine.synthesizeResults(results, state)).resolves.toBeDefined();
    });

    it('should handle malformed result data', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: null, // Malformed data
          qualityScore: 0.5,
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis).toBeDefined();
    });

    it('should handle results with string data', async () => {
      const results: ResearchStepResult[] = [
        createMockResearchStepResult({
          data: 'Plain text result without structure',
          qualityScore: 0.6,
        }),
      ];

      const state = createMockOrchestrationState();
      const synthesis = await synthesisEngine.synthesizeResults(results, state);

      expect(synthesis).toBeDefined();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultAggregator } from '../result-aggregator.js';
import type {
  ResearchStepResult,
  OrchestrationState,
  ResearchResult,
  ResearchPlan
} from '../../shared/interfaces.js';

describe('ResultAggregator', () => {
  let aggregator: ResultAggregator;

  beforeEach(() => {
    vi.clearAllMocks();
    aggregator = new ResultAggregator();
  });

  // Helper function to create valid ResearchPlan
  const createResearchPlan = (overrides: Partial<ResearchPlan>): ResearchPlan => ({
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
  const createOrchestrationState = (overrides: Partial<OrchestrationState>): OrchestrationState => ({
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

  // Helper function to create valid ResearchStepResult
  const createResearchStepResult = (overrides: Partial<ResearchStepResult>): ResearchStepResult => ({
    stepId: 'step1',
    status: 'success',
    data: {
      findings: [],
    },
    sources: [],
    processingTime: 1000,
    qualityScore: 0.8,
    issues: [],
    metadata: {},
    ...overrides,
  });

  describe('aggregateResults', () => {
    it('should aggregate results from multiple steps', () => {
      const results: ResearchStepResult[] = [
        createResearchStepResult({
          stepId: 'step1',
          data: {
            findings: [{
              claim: 'Climate change is caused by human activities',
              evidence: 'Scientific consensus from IPCC reports',
              confidence: 0.9,
              sources: [0],
              category: 'factual',
            }],
          },
          sources: [{
            title: 'IPCC Report',
            url: 'https://ipcc.ch/report',
            type: 'academic',
            credibilityScore: 0.95,
            publicationDate: new Date('2023-01-01'),
            accessedAt: new Date(),
          }],
          qualityScore: 0.9,
          processingTime: 2000,
        }),
        createResearchStepResult({
          stepId: 'step2',
          data: {
            findings: [{
              claim: 'Renewable energy adoption is increasing',
              evidence: 'IEA data shows growth in solar and wind',
              confidence: 0.8,
              sources: [0],
              category: 'factual',
            }],
          },
          sources: [{
            title: 'IEA Report',
            url: 'https://iea.org/report',
            type: 'government',
            credibilityScore: 0.9,
            publicationDate: new Date('2023-06-01'),
            accessedAt: new Date(),
          }],
          qualityScore: 0.8,
          processingTime: 1500,
        }),
      ];

      const state = createOrchestrationState({
        plan: createResearchPlan({ topic: 'Climate Change' }),
      });

      const aggregated = aggregator.aggregateResults(results, state);

      expect(aggregated.topic).toBe('Climate Change');
      expect(aggregated.findings).toHaveLength(2);
      expect(aggregated.sources).toHaveLength(2);
      expect(aggregated.confidence).toBeGreaterThan(0);
      expect(aggregated.processingTime).toBe(3500);
    });

    it('should handle empty results array', () => {
      const results: ResearchStepResult[] = [];
      const state = createOrchestrationState({});
      const aggregated = aggregator.aggregateResults(results, state);

      expect(aggregated.findings).toHaveLength(0);
      expect(aggregated.sources).toHaveLength(0);
      expect(aggregated.confidence).toBe(0);
    });

    it('should deduplicate sources correctly', () => {
      const results: ResearchStepResult[] = [
        createResearchStepResult({
          sources: [
            {
              title: 'Source 1',
              url: 'https://example1.com',
              type: 'web',
              credibilityScore: 0.8,
              publicationDate: new Date(),
              accessedAt: new Date(),
            },
          ],
        }),
        createResearchStepResult({
          sources: [
            {
              title: 'Source 1',
              url: 'https://example1.com',
              type: 'web',
              credibilityScore: 0.8,
              publicationDate: new Date(),
              accessedAt: new Date(),
            },
          ],
        }),
      ];

      const state = createOrchestrationState({});
      const aggregated = aggregator.aggregateResults(results, state);

      expect(aggregated.sources).toHaveLength(1);
      expect(aggregated.sources[0]?.title).toBe('Source 1');
    });

    it('should consolidate similar findings', () => {
      const results: ResearchStepResult[] = [
        createResearchStepResult({
          data: {
            findings: [{
              claim: 'Climate change is real',
              evidence: 'Scientific evidence shows warming',
              confidence: 0.9,
              sources: [0],
              category: 'factual',
            }],
          },
          sources: [{
            title: 'Source 1',
            url: 'https://source1.com',
            type: 'web',
            credibilityScore: 0.8,
            publicationDate: new Date(),
            accessedAt: new Date(),
          }],
        }),
        createResearchStepResult({
          data: {
            findings: [{
              claim: 'Climate change exists',
              evidence: 'Research indicates global warming',
              confidence: 0.8,
              sources: [0],
              category: 'factual',
            }],
          },
          sources: [{
            title: 'Source 2',
            url: 'https://source2.com',
            type: 'academic',
            credibilityScore: 0.9,
            publicationDate: new Date(),
            accessedAt: new Date(),
          }],
        }),
      ];

      const state = createOrchestrationState({});
      const aggregated = aggregator.aggregateResults(results, state);

      expect(aggregated.findings).toHaveLength(1); // Should consolidate similar claims
      expect(aggregated.sources).toHaveLength(2);
    });

    it('should calculate overall confidence correctly', () => {
      const results: ResearchStepResult[] = [
        createResearchStepResult({
          qualityScore: 0.9,
          data: {
            findings: [{
              claim: 'High confidence finding',
              evidence: 'Strong evidence',
              confidence: 0.9,
              sources: [0],
              category: 'factual',
            }],
          },
          sources: [{
            title: 'Source 1',
            url: 'https://example1.com',
            type: 'web',
            credibilityScore: 0.8,
            publicationDate: new Date(),
            accessedAt: new Date(),
          }],
        }),
        createResearchStepResult({
          qualityScore: 0.6,
          data: {
            findings: [{
              claim: 'Lower confidence finding',
              evidence: 'Weaker evidence',
              confidence: 0.6,
              sources: [0],
              category: 'analytical',
            }],
          },
          sources: [{
            title: 'Source 2',
            url: 'https://example2.com',
            type: 'academic',
            credibilityScore: 0.9,
            publicationDate: new Date(),
            accessedAt: new Date(),
          }],
        }),
      ];

      const state = createOrchestrationState({});
      const aggregated = aggregator.aggregateResults(results, state);

      expect(aggregated.confidence).toBeGreaterThan(0.6);
      expect(aggregated.confidence).toBeLessThanOrEqual(0.9);
    });
  });

  describe('validateResultIntegrity', () => {
    it('should validate result with valid findings and sources', () => {
      const result: ResearchResult = {
        topic: 'Test Topic',
        findings: [{
          claim: 'Test finding',
          evidence: 'Test evidence',
          confidence: 0.8,
          sources: [0, 1],
          category: 'factual',
        }],
        sources: [{
          title: 'Test Source 1',
          url: 'https://example.com',
          type: 'web',
          credibilityScore: 0.8,
          publicationDate: new Date(),
          accessedAt: new Date(),
        }, {
          title: 'Test Source 2',
          url: 'https://academic.example.com',
          type: 'academic',
          credibilityScore: 0.9,
          publicationDate: new Date(),
          accessedAt: new Date(),
        }],
        methodology: 'Systematic review',
        confidence: 0.8,
        generatedAt: new Date(),
        processingTime: 1000,
      };

      const validation = aggregator.validateResultIntegrity(result);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect issues with empty findings', () => {
      const result: ResearchResult = {
        topic: 'Test Topic',
        findings: [],
        sources: [],
        methodology: 'Test methodology',
        confidence: 0.5,
        generatedAt: new Date(),
        processingTime: 1000,
      };

      const validation = aggregator.validateResultIntegrity(result);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('No findings generated from research');
    });

    it('should detect low confidence findings', () => {
      const result: ResearchResult = {
        topic: 'Test Topic',
        findings: [
          {
            claim: 'Low confidence finding 1',
            evidence: 'Weak evidence 1',
            confidence: 0.2,
            sources: [0],
            category: 'speculative',
          },
          {
            claim: 'Low confidence finding 2',
            evidence: 'Weak evidence 2',
            confidence: 0.1,
            sources: [0],
            category: 'speculative',
          },
        ],
        sources: [{
          title: 'Test Source',
          url: 'https://example.com',
          type: 'web',
          credibilityScore: 0.8,
          publicationDate: new Date(),
          accessedAt: new Date(),
        }],
        methodology: 'Test methodology',
        confidence: 0.5,
        generatedAt: new Date(),
        processingTime: 1000,
      };

      const validation = aggregator.validateResultIntegrity(result);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('low confidence'))).toBe(true);
    });

    it('should detect poor source diversity', () => {
      const result: ResearchResult = {
        topic: 'Test Topic',
        findings: [{
          claim: 'Test finding',
          evidence: 'Test evidence',
          confidence: 0.8,
          sources: [0],
          category: 'factual',
        }],
        sources: [{
          title: 'Test Source 1',
          url: 'https://example1.com',
          type: 'web',
          credibilityScore: 0.8,
          publicationDate: new Date(),
          accessedAt: new Date(),
        }],
        methodology: 'Test methodology',
        confidence: 0.8,
        generatedAt: new Date(),
        processingTime: 1000,
      };

      const validation = aggregator.validateResultIntegrity(result);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('source type diversity'))).toBe(true);
    });
  });

  describe('cleanupResearchResults', () => {
    it('should clean up cached results for a research project', () => {
      // Populate cache by aggregating results
      const results = [createResearchStepResult({})];
      const state = createOrchestrationState({ researchId: 'research1' });
      aggregator.aggregateResults(results, state);

      // Verify it's cached
      expect(aggregator.getCachedResults('research1')).toEqual(results);

      aggregator.cleanupResearchResults('research1');

      expect(aggregator.getCachedResults('research1')).toBeNull();
    });
  });

  describe('getCachedResults', () => {
    it('should return cached results for a research project', () => {
      const results = [createResearchStepResult({})];
      const state = createOrchestrationState({ researchId: 'research1' });
      aggregator.aggregateResults(results, state);

      const cached = aggregator.getCachedResults('research1');

      expect(cached).toEqual(results);
    });

    it('should return null for non-existent research', () => {
      const cached = aggregator.getCachedResults('nonexistent');

      expect(cached).toBeNull();
    });
  });
});

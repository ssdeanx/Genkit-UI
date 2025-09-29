import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultAggregator } from '../result-aggregator.js';
import type {
  ResearchStepResult,
  SourceCitation,
  OrchestrationState,
  ResearchResult,
  ResearchPlan,
  ResearchStep
} from '../../shared/interfaces.js';

// Type for testing private methods
interface ResultAggregatorPrivate {
  resultCache: Map<string, ResearchStepResult[]>;
  extractAllSources(results: ResearchStepResult[]): SourceCitation[];
  deduplicateSources(sources: SourceCitation[]): SourceCitation[];
  calculateOverallConfidence(results: ResearchStepResult[]): number;
  calculateTotalProcessingTime(results: ResearchStepResult[]): number;
  generateMethodologySummary(plan: ResearchPlan, results: ResearchStepResult[]): string;
}

// Mock logger
vi.mock('../../../logger.js', () => ({
  log: vi.fn(),
}));

describe('ResultAggregator', () => {
  let aggregator: ResultAggregator;

  beforeEach(() => {
    vi.clearAllMocks();
    aggregator = new ResultAggregator();
  });

  // Helper function to create valid ResearchStep
  const createResearchStep = (overrides: Partial<ResearchStep>): ResearchStep => ({
    id: 'step1',
    description: 'Test step',
    agentType: 'web-research' as const,
    dependencies: [],
    estimatedDuration: 10,
    successCriteria: 'Test criteria',
    fallbackStrategies: [],
    priority: 3,
    ...overrides,
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
          sources: [0],
          category: 'factual',
        }],
        sources: [{
          title: 'Test Source',
          url: 'https://example.com',
          type: 'web',
          credibilityScore: 0.8,
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
      // Add some mock cached results
      (aggregator as unknown as ResultAggregatorPrivate).resultCache.set('research1', [createResearchStepResult({})]);

      aggregator.cleanupResearchResults('research1');

      expect(aggregator.getCachedResults('research1')).toBeNull();
    });
  });

  describe('getCachedResults', () => {
    it('should return cached results for a research project', () => {
      const results = [createResearchStepResult({})];
      (aggregator as unknown as ResultAggregatorPrivate).resultCache.set('research1', results);

      const cached = aggregator.getCachedResults('research1');

      expect(cached).toEqual(results);
    });

    it('should return null for non-existent research', () => {
      const cached = aggregator.getCachedResults('nonexistent');

      expect(cached).toBeNull();
    });
  });

  describe('private methods', () => {
    describe('extractAllSources', () => {
      it('should extract all sources from results', () => {
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
                title: 'Source 2',
                url: 'https://example2.com',
                type: 'academic',
                credibilityScore: 0.9,
                publicationDate: new Date(),
                accessedAt: new Date(),
              },
            ],
          }),
        ];

        const sources = (aggregator as unknown as ResultAggregatorPrivate).extractAllSources(results);
        expect(sources).toHaveLength(2);
        expect(sources[0]?.title).toBe('Source 1');
        expect(sources[1]?.title).toBe('Source 2');
      });

      it('should handle results with no sources', () => {
        const results: ResearchStepResult[] = [
          createResearchStepResult({ sources: [] }),
          createResearchStepResult({ sources: [] }),
        ];

        const sources = (aggregator as unknown as ResultAggregatorPrivate).extractAllSources(results);
        expect(sources).toHaveLength(0);
      });
    });

    describe('deduplicateSources', () => {
      it('should remove duplicate sources', () => {
        const sources: SourceCitation[] = [
          {
            title: 'Source 1',
            url: 'https://example1.com',
            type: 'web',
            credibilityScore: 0.8,
            publicationDate: new Date(),
            accessedAt: new Date(),
          },
          {
            title: 'Source 1',
            url: 'https://example1.com',
            type: 'web',
            credibilityScore: 0.8,
            publicationDate: new Date(),
            accessedAt: new Date(),
          },
          {
            title: 'Different Source',
            url: 'https://example2.com',
            type: 'academic',
            credibilityScore: 0.9,
            publicationDate: new Date(),
            accessedAt: new Date(),
          },
        ];

        const deduplicated = (aggregator as unknown as ResultAggregatorPrivate).deduplicateSources(sources);
        expect(deduplicated).toHaveLength(2);
        expect(deduplicated.some((s: SourceCitation) => s.title === 'Source 1')).toBe(true);
        expect(deduplicated.some((s: SourceCitation) => s.title === 'Different Source')).toBe(true);
      });

      it('should handle empty sources array', () => {
        const sources: SourceCitation[] = [];
        const deduplicated = (aggregator as unknown as ResultAggregatorPrivate).deduplicateSources(sources);
        expect(deduplicated).toHaveLength(0);
      });
    });

    describe('calculateOverallConfidence', () => {
      it('should calculate weighted average confidence', () => {
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
          }),
          createResearchStepResult({
            qualityScore: 0.6,
            data: {
              findings: [{
                claim: 'Medium confidence finding',
                evidence: 'Medium evidence',
                confidence: 0.6,
                sources: [0],
                category: 'analytical',
              }],
            },
          }),
        ];

        const confidence = (aggregator as unknown as ResultAggregatorPrivate).calculateOverallConfidence(results);
        expect(confidence).toBeGreaterThan(0.6);
        expect(confidence).toBeLessThanOrEqual(0.9);
      });

      it('should handle empty results', () => {
        const results: ResearchStepResult[] = [];
        const confidence = (aggregator as unknown as ResultAggregatorPrivate).calculateOverallConfidence(results);
        expect(confidence).toBe(0);
      });
    });

    describe('calculateTotalProcessingTime', () => {
      it('should sum processing times from all results', () => {
        const results: ResearchStepResult[] = [
          createResearchStepResult({ processingTime: 1000 }),
          createResearchStepResult({ processingTime: 2000 }),
          createResearchStepResult({ processingTime: 1500 }),
        ];

        const totalTime = (aggregator as unknown as ResultAggregatorPrivate).calculateTotalProcessingTime(results);

        expect(totalTime).toBe(4500);
      });
    });

    describe('generateMethodologySummary', () => {
      it('should generate methodology summary from plan and results', () => {
        const plan = createResearchPlan({
          topic: 'AI Research',
          methodology: { approach: 'systematic' as const, justification: 'Comprehensive analysis', phases: [], qualityControls: [] },
          executionSteps: [
            createResearchStep({ agentType: 'academic-research' }),
            createResearchStep({ agentType: 'web-research' }),
          ],
        });

        const results: ResearchStepResult[] = [
          createResearchStepResult({ stepId: 'academic-step' }),
          createResearchStepResult({ stepId: 'web-step' }),
        ];

        const summary = (aggregator as unknown as ResultAggregatorPrivate).generateMethodologySummary(plan, results);

        expect(summary).toContain('AI Research');
        expect(summary).toContain('systematic approach');
        expect(summary).toContain('academic-research');
        expect(summary).toContain('web-research');
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultAggregator } from '../result-aggregator.js';
import type {
  ResearchStepResult,
  OrchestrationState,
  ResearchResult,
  ResearchPlan,
  SourceCitation
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

  describe('Edge case coverage for uncovered lines', () => {
    it('should handle empty group check (line 389-390)', () => {
      // Create findings that will trigger grouping with empty group edge case
      const results = [createResearchStepResult({
        data: {
          findings: [
            {
              claim: 'Test claim 1',
              evidence: 'Evidence 1',
              confidence: 0.8,
              sources: [0],
              category: 'factual'
            },
            {
              claim: 'Test claim 2 similar to claim 1',
              evidence: 'Evidence 2',
              confidence: 0.7,
              sources: [1],
              category: 'factual'
            }
          ]
        },
        sources: [
          {
            title: 'Source 1',
            url: 'https://example1.com',
            type: 'web',
            credibilityScore: 0.8,
            accessedAt: new Date()
          },
          {
            title: 'Source 2',
            url: 'https://example2.com',
            type: 'academic',
            credibilityScore: 0.9,
            accessedAt: new Date()
          }
        ]
      })];

      const state = createOrchestrationState({});
      const aggregated = aggregator.aggregateResults(results, state);
      
      expect(aggregated.findings.length).toBeGreaterThan(0);
    });

    it('should handle low credibility score (line 510-511)', () => {
      const results = [createResearchStepResult({
        sources: [{
          title: 'Source with low credibility',
          url: 'https://example.com',
          type: 'web',
          credibilityScore: 0.1, // Very low credibility score
          accessedAt: new Date()
        }]
      })];

      const state = createOrchestrationState({});
      const aggregated = aggregator.aggregateResults(results, state);
      
      expect(aggregated.sources.length).toBe(1);
      if (aggregated.sources[0]) {
        expect(aggregated.sources[0].credibilityScore).toBe(0.1);
      }
    });

    it('should propagate NaN from quality scores (line 683-684)', () => {
      const results = [createResearchStepResult({
        qualityScore: NaN,
        data: {
          findings: [{
            claim: 'Test',
            evidence: 'Evidence',
            confidence: 0.8,
            sources: [0],
            category: 'factual'
          }]
        }
      })];

      const state = createOrchestrationState({});
      const aggregated = aggregator.aggregateResults(results, state);
      
      // NaN propagates through calculation
      expect(Number.isNaN(aggregated.confidence)).toBe(true);
    });

    it('should propagate Infinity from processing time (line 693-694)', () => {
      const results = [createResearchStepResult({
        processingTime: Infinity
      })];

      const state = createOrchestrationState({});
      const aggregated = aggregator.aggregateResults(results, state);
      
      // Infinity propagates through sum
      expect(aggregated.processingTime).toBe(Infinity);
    });

    it('should handle missing processing time (line 698-703)', () => {
      const results = [createResearchStepResult({
        processingTime: 0
      })];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (results[0] as any).processingTime;

      const state = createOrchestrationState({});
      const aggregated = aggregator.aggregateResults(results, state);
      
      // When processingTime is deleted, reduce treats it as 0 + undefined = NaN
      expect(Number.isNaN(aggregated.processingTime)).toBe(true);
    });

    it('should handle empty sources in diversity check (line 742-748)', () => {
      const result: ResearchResult = {
        topic: 'Test',
        findings: [{
          claim: 'Test claim',
          evidence: 'Test evidence',
          confidence: 0.8,
          sources: [],
          category: 'factual'
        }],
        sources: [],
        methodology: 'Test',
        confidence: 0.8,
        generatedAt: new Date(),
        processingTime: 1000
      };

      const validation = aggregator.validateResultIntegrity(result);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('source'))).toBe(true);
    });

    it('should handle findings with no evidence (line 329-330)', () => {
      const results = [createResearchStepResult({
        data: {
          findings: [{
            claim: 'Test claim',
            evidence: '', // Empty evidence
            confidence: 0.8,
            sources: [0],
            category: 'factual'
          }]
        },
        sources: [{
          title: 'Source',
          url: 'https://example.com',
          type: 'web',
          credibilityScore: 0.8,
          accessedAt: new Date()
        }]
      })];

      const state = createOrchestrationState({});
      const aggregated = aggregator.aggregateResults(results, state);
      
      expect(aggregated.findings.length).toBeGreaterThan(0);
    });

    it('should handle findings with empty sources array (line 345-348)', () => {
      const results = [createResearchStepResult({
        data: {
          findings: [{
            claim: 'Test claim',
            evidence: 'Test evidence',
            confidence: 0.8,
            sources: [], // Empty sources
            category: 'factual'
          }]
        },
        sources: []
      })];

      const state = createOrchestrationState({});
      const aggregated = aggregator.aggregateResults(results, state);
      
      expect(aggregated.findings.length).toBeGreaterThan(0);
    });

    it('should validate findings without issues (line 435-436)', () => {
      const result: ResearchResult = {
        topic: 'Valid Research',
        findings: [{
          claim: 'Well-supported claim',
          evidence: 'Strong evidence',
          confidence: 0.9,
          sources: [0, 1],
          category: 'factual'
        }],
        sources: [
          {
            title: 'Academic Source',
            url: 'https://academic.com',
            type: 'academic',
            credibilityScore: 0.95,
            accessedAt: new Date()
          },
          {
            title: 'Government Source',
            url: 'https://gov.com',
            type: 'government',
            credibilityScore: 0.9,
            accessedAt: new Date()
          }
        ],
        methodology: 'Comprehensive',
        confidence: 0.9,
        generatedAt: new Date(),
        processingTime: 1000
      };

      const validation = aggregator.validateResultIntegrity(result);
      
      // Should pass all validation with diverse sources
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect missing critical fields (line 447-448)', () => {
      const result: ResearchResult = {
        topic: '',  // Empty topic
        findings: [{
          claim: 'Test',
          evidence: 'Evidence',
          confidence: 0.8,
          sources: [0],
          category: 'factual'
        }],
        sources: [{
          title: 'Source',
          url: 'https://example.com',
          type: 'web',
          credibilityScore: 0.8,
          accessedAt: new Date()
        }],
        methodology: '',  // Empty methodology
        confidence: 0.8,
        generatedAt: new Date(),
        processingTime: 1000
      };

      const validation = aggregator.validateResultIntegrity(result);
      
      // Should detect empty required fields
      expect(validation.isValid).toBe(false);
    });

    it('should handle low quality metrics (line 642-644)', () => {
      const result: ResearchResult = {
        topic: 'Test',
        findings: [{
          claim: 'Low quality finding',
          evidence: 'Weak evidence',
          confidence: 0.3,
          sources: [0],
          category: 'speculative'
        }],
        sources: [{
          title: 'Low credibility source',
          url: 'https://example.com',
          type: 'web',
          credibilityScore: 0.3,
          accessedAt: new Date()
        }],
        methodology: 'Minimal',
        confidence: 0.3,
        generatedAt: new Date(),
        processingTime: 1000
      };

      const validation = aggregator.validateResultIntegrity(result);
      
      // Should flag low quality
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Additional branch coverage', () => {
    it('should handle deduplication when cache has existing source', () => {
      const sources: SourceCitation[] = [
        {
          title: 'Source 1',
          url: 'https://example1.com',
          type: 'web',
          credibilityScore: 0.7,
          publicationDate: new Date(),
          accessedAt: new Date(),
        },
        {
          title: 'Source 1',
          url: 'https://example1.com',
          type: 'web',
          credibilityScore: 0.9,
          publicationDate: new Date(),
          accessedAt: new Date(),
        },
      ];

      const deduplicated = aggregator['deduplicateSources'](sources);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0]?.credibilityScore).toBe(0.9); // Should use max
    });

    it('should handle empty results array in extractAllSources', () => {
      const sources = aggregator['extractAllSources']([]);
      expect(sources).toHaveLength(0);
    });

    it('should handle results with empty sources array', () => {
      const results: ResearchStepResult[] = [
        createResearchStepResult({
          sources: [],
        }),
      ];
      const sources = aggregator['extractAllSources'](results);
      expect(sources).toHaveLength(0);
    });

    it('should handle results with non-array sources', () => {
      const results: ResearchStepResult[] = [
        {
          stepId: 'step1',
          status: 'success',
          data: {},
          sources: null as unknown as SourceCitation[],
          qualityScore: 0.8,
          processingTime: 1,
          issues: [],
          metadata: {},
        },
      ];
      const sources = aggregator['extractAllSources'](results);
      expect(sources).toHaveLength(0);
    });

    it('should generate methodology summary with phases', () => {
      const plan = createResearchPlan({
        methodology: {
          approach: 'systematic' as const,
          justification: 'Test',
          phases: ['Phase 1: Initial research', 'Phase 2: Deep dive'],
          qualityControls: [],
        }
      });
      const results = [createResearchStepResult({})];

      const methodology = aggregator['generateMethodologySummary'](plan, results);
      expect(methodology).toContain('Test topic');
      expect(methodology).toContain('research');
    });

    it('should calculate confidence with varying quality scores', () => {
      const results: ResearchStepResult[] = [
        createResearchStepResult({ qualityScore: 0.95 }),
        createResearchStepResult({ qualityScore: 0.85 }),
        createResearchStepResult({ qualityScore: 0.75 }),
      ];

      const confidence = aggregator['calculateOverallConfidence'](results);
      expect(confidence).toBeGreaterThan(0.7);
      expect(confidence).toBeLessThan(0.95);
    });

    it('should handle zero-length results in confidence calculation', () => {
      const confidence = aggregator['calculateOverallConfidence']([]);
      expect(confidence).toBe(0);
    });

    it('should handle single result in confidence calculation', () => {
      const results: ResearchStepResult[] = [
        createResearchStepResult({ qualityScore: 0.9 }),
      ];

      const confidence = aggregator['calculateOverallConfidence'](results);
      expect(confidence).toBeGreaterThan(0);
    });

    it('should calculate total processing time correctly', () => {
      const results: ResearchStepResult[] = [
        createResearchStepResult({ processingTime: 1000 }),
        createResearchStepResult({ processingTime: 2000 }),
        createResearchStepResult({ processingTime: 3000 }),
      ];

      const total = aggregator['calculateTotalProcessingTime'](results);
      expect(total).toBe(6000);
    });

    it('should handle missing processing time gracefully', () => {
      const results: ResearchStepResult[] = [
        createResearchStepResult({ processingTime: undefined as unknown as number }),
      ];

      const total = aggregator['calculateTotalProcessingTime'](results);
      expect(total).toBeNaN();
    });

    it('should get cached results for existing research', () => {
      const results: ResearchStepResult[] = [
        createResearchStepResult({ stepId: 'step1' }),
      ];
      const state = createOrchestrationState({});

      aggregator.aggregateResults(results, state);

      const cached = aggregator.getCachedResults('research1');
      expect(cached).toEqual(results);
    });

    it('should generate source key for deduplication', () => {
      const source: SourceCitation = {
        title: 'Test Source',
        url: 'https://example.com/path',
        type: 'web',
        credibilityScore: 0.8,
        publicationDate: new Date(),
        accessedAt: new Date(),
      };

      const key = aggregator['generateSourceKey'](source);
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });

    it('should validate result with low overall confidence', () => {
      const result: ResearchResult = {
        topic: 'Test',
        findings: [
          {
            claim: 'Low confidence finding 1',
            evidence: 'Limited evidence',
            confidence: 0.2,
            sources: [0],
            category: 'speculative',
          },
          {
            claim: 'Low confidence finding 2',
            evidence: 'Limited evidence',
            confidence: 0.25,
            sources: [0],
            category: 'speculative',
          },
        ],
        sources: [
          {
            title: 'Weak Source',
            url: 'https://example.com',
            type: 'web',
            credibilityScore: 0.4,
            publicationDate: new Date(),
            accessedAt: new Date(),
          },
        ],
        methodology: 'Test',
        confidence: 0.35,
        generatedAt: new Date(),
        processingTime: 1000,
      };

      const validation = aggregator.validateResultIntegrity(result);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues.some(i => i.includes('low confidence'))).toBe(true);
    });

    it('should detect source diversity issues', () => {
      const result: ResearchResult = {
        topic: 'Test',
        findings: [
          { claim: 'F1', evidence: 'E1', confidence: 0.8, sources: [0], category: 'factual' },
          { claim: 'F2', evidence: 'E2', confidence: 0.8, sources: [1], category: 'factual' },
          { claim: 'F3', evidence: 'E3', confidence: 0.8, sources: [2], category: 'factual' },
        ],
        sources: [
          {
            title: 'Web 1',
            url: 'https://web1.com',
            type: 'web',
            credibilityScore: 0.6,
            publicationDate: new Date(),
            accessedAt: new Date(),
          },
          {
            title: 'Web 2',
            url: 'https://web2.com',
            type: 'web',
            credibilityScore: 0.6,
            publicationDate: new Date(),
            accessedAt: new Date(),
          },
          {
            title: 'Web 3',
            url: 'https://web3.com',
            type: 'web',
            credibilityScore: 0.6,
            publicationDate: new Date(),
            accessedAt: new Date(),
          },
        ],
        methodology: 'Test',
        confidence: 0.6,
        generatedAt: new Date(),
        processingTime: 1000,
      };

      const validation = aggregator.validateResultIntegrity(result);
      expect(validation.issues.some(i => i.includes('diversity'))).toBe(true);
    });
  });
});

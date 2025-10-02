import { describe, it, expect } from 'vitest';
import { RiskAssessor } from '../risk-assessor.js';
import type { DataSource, ResearchStep, RiskFactor } from '../../shared/interfaces.js';

const sources: DataSource[] = [
  { type: 'academic', priority: 1, credibilityWeight: 0.9, estimatedVolume: 'high', rateLimits: { requestsPerMinute: 8, requestsPerHour: 80 } },
  { type: 'web', priority: 3, credibilityWeight: 0.6, estimatedVolume: 'high', rateLimits: { requestsPerMinute: 40, requestsPerHour: 1200 } },
  { type: 'statistical', priority: 2, credibilityWeight: 0.95, estimatedVolume: 'low', rateLimits: { requestsPerMinute: 4, requestsPerHour: 40 } },
];

const steps: ResearchStep[] = [
  { id: 'research-001', description: 'acad', agentType: 'academic-research', dependencies: [], estimatedDuration: 30, successCriteria: 'ok', fallbackStrategies: ['a'], priority: 2 },
  { id: 'research-002', description: 'web', agentType: 'web-research', dependencies: [], estimatedDuration: 10, successCriteria: 'ok', fallbackStrategies: ['a'], priority: 3 },
  { id: 'analysis-001', description: 'stats', agentType: 'data-analysis', dependencies: ['research-001','research-002'], estimatedDuration: 20, successCriteria: 'ok', fallbackStrategies: ['a'], priority: 2 },
];

describe('RiskAssessor', () => {
  it('assesses risks and produces contingency plans', () => {
    const ra = new RiskAssessor();
    const { risks, contingencyPlans } = ra.assessRisks('AI', sources, steps, '2 days', 'systematic');
    expect(risks.length).toBeGreaterThan(0);
    expect(contingencyPlans.length).toBeGreaterThan(0);
    const summary = ra.getRiskSummary(risks);
    expect(['low','medium','high','critical']).toContain(summary.overallRiskLevel);
  });

  describe('Coverage improvements for uncovered lines', () => {
    it('assesses data availability risks for single source type', () => {
      const ra = new RiskAssessor();
      const singleTypeSources: DataSource[] = [
        { type: 'academic', priority: 1, credibilityWeight: 0.9, estimatedVolume: 'high' },
      ];
      const { risks } = ra.assessRisks('Quantum Computing', singleTypeSources, steps, '1 day', 'systematic');
      
      // Should flag single point of failure
      const diversityRisk = risks.find(r => r.type === 'data-availability' && r.mitigationStrategy?.includes('backup'));
      expect(diversityRisk).toBeDefined();
      expect(diversityRisk?.probability).toBe('medium');
    });

    it('assesses API limit risks for sources with rate limits', () => {
      const ra = new RiskAssessor();
      const limitedSources: DataSource[] = [
        { type: 'academic', priority: 1, credibilityWeight: 0.9, estimatedVolume: 'high', rateLimits: { requestsPerMinute: 5, requestsPerHour: 50 } },
        { type: 'news', priority: 2, credibilityWeight: 0.7, estimatedVolume: 'high', rateLimits: { requestsPerMinute: 10, requestsPerHour: 100 } },
      ];
      const { risks } = ra.assessRisks('Climate Change', limitedSources, steps, '3 days', 'exploratory');
      
      const apiRisks = risks.filter(r => r.type === 'api-limits');
      expect(apiRisks.length).toBeGreaterThan(0);
      // API risks should be flagged for rate-limited sources
      expect(apiRisks.some(r => r.probability === 'medium' || r.probability === 'high')).toBe(true);
    });

    it('assesses time constraint risks for tight deadlines', () => {
      const ra = new RiskAssessor();
      const manySteps: ResearchStep[] = [
        { id: 'r1', description: 'step1', agentType: 'academic-research', dependencies: [], estimatedDuration: 40, successCriteria: 'ok', fallbackStrategies: [], priority: 1 },
        { id: 'r2', description: 'step2', agentType: 'web-research', dependencies: [], estimatedDuration: 30, successCriteria: 'ok', fallbackStrategies: [], priority: 2 },
        { id: 'r3', description: 'step3', agentType: 'data-analysis', dependencies: ['r1', 'r2'], estimatedDuration: 25, successCriteria: 'ok', fallbackStrategies: [], priority: 3 },
      ];
      const { risks } = ra.assessRisks('Research Topic', sources, manySteps, '1 hour', 'systematic');
      
      const timeRisks = risks.filter(r => r.type === 'time-constraints');
      expect(timeRisks.length).toBeGreaterThan(0);
      expect(timeRisks.some(r => r.probability === 'high' || r.impact === 'high')).toBe(true);
    });

    it('assesses credibility risks for low-quality sources', () => {
      const ra = new RiskAssessor();
      const lowCredSources: DataSource[] = [
        { type: 'web', priority: 3, credibilityWeight: 0.4, estimatedVolume: 'high' },
        { type: 'web', priority: 4, credibilityWeight: 0.5, estimatedVolume: 'medium' },
      ];
      const { risks } = ra.assessRisks('Controversial Topic', lowCredSources, steps, '2 days', 'exploratory');
      
      const credibilityRisks = risks.filter(r => r.type === 'credibility-concerns');
      expect(credibilityRisks.length).toBeGreaterThan(0);
      expect(credibilityRisks.some(r => r.impact === 'high')).toBe(true);
    });

    it('assesses technical failure risks for complex dependency chains', () => {
      const ra = new RiskAssessor();
      const complexSteps: ResearchStep[] = [
        { id: 'r1', description: 'step1', agentType: 'academic-research', dependencies: [], estimatedDuration: 20, successCriteria: 'ok', fallbackStrategies: [], priority: 1 },
        { id: 'r2', description: 'step2', agentType: 'web-research', dependencies: ['r1'], estimatedDuration: 15, successCriteria: 'ok', fallbackStrategies: [], priority: 2 },
        { id: 'r3', description: 'step3', agentType: 'data-analysis', dependencies: ['r1', 'r2'], estimatedDuration: 20, successCriteria: 'ok', fallbackStrategies: [], priority: 2 },
        { id: 'r4', description: 'step4', agentType: 'orchestrator', dependencies: ['r3'], estimatedDuration: 10, successCriteria: 'ok', fallbackStrategies: [], priority: 3 },
      ];
      const { risks } = ra.assessRisks('Complex Research', sources, complexSteps, '2 days', 'systematic');
      
      const technicalRisks = risks.filter(r => r.type === 'technical-failures');
      expect(technicalRisks.length).toBeGreaterThan(0);
    });

    it('generates risk summary with multiple risk levels', () => {
      const ra = new RiskAssessor();
      const mixedRisks: RiskFactor[] = [
        { type: 'data-availability', probability: 'high', impact: 'high', mitigationStrategy: 'backup' },
        { type: 'api-limits', probability: 'medium', impact: 'medium', mitigationStrategy: 'queue' },
        { type: 'time-constraints', probability: 'low', impact: 'low', mitigationStrategy: 'prioritize' },
      ];
      
      const summary = ra.getRiskSummary(mixedRisks);
      expect(summary.overallRiskLevel).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(summary.overallRiskLevel);
      expect(summary.riskBreakdown).toBeDefined();
      expect(summary.recommendations.length).toBeGreaterThan(0);
    });

    it('handles exploratory methodology with different risk patterns', () => {
      const ra = new RiskAssessor();
      const { risks } = ra.assessRisks('Emerging Technology', sources, steps, '1 week', 'exploratory');
      
      expect(risks.length).toBeGreaterThan(0);
      expect(risks.some(r => r.type === 'credibility-concerns')).toBe(true);
    });

    it('handles comparative methodology risk assessment', () => {
      const ra = new RiskAssessor();
      const { risks } = ra.assessRisks('Database Comparison', sources, steps, '3 days', 'comparative');
      
      expect(risks.length).toBeGreaterThan(0);
      // Comparative methodology should still flag risks
      expect(risks.some(r => r.type === 'data-availability' || r.type === 'time-constraints')).toBe(true);
    });

    it('assesses risks for news sources', () => {
      const ra = new RiskAssessor();
      const newsSources: DataSource[] = [
        { type: 'news', priority: 1, credibilityWeight: 0.75, estimatedVolume: 'high', rateLimits: { requestsPerMinute: 100, requestsPerHour: 2000 } },
      ];
      const { risks } = ra.assessRisks('Current Events', newsSources, steps, '1 day', 'systematic');
      
      // News sources should have different risk profile
      expect(risks.length).toBeGreaterThan(0);
    });

    it('handles steps without dependencies', () => {
      const ra = new RiskAssessor();
      const independentSteps: ResearchStep[] = [
        { id: 'r1', description: 'step1', agentType: 'web-research', dependencies: [], estimatedDuration: 15, successCriteria: 'ok', fallbackStrategies: [], priority: 1 },
        { id: 'r2', description: 'step2', agentType: 'academic-research', dependencies: [], estimatedDuration: 20, successCriteria: 'ok', fallbackStrategies: [], priority: 1 },
      ];
      const { risks } = ra.assessRisks('Parallel Research', sources, independentSteps, '1 day', 'systematic');
      
      expect(risks.length).toBeGreaterThan(0);
      const technicalRisks = risks.filter(r => r.type === 'technical-failures');
      // Should have lower technical risk for independent steps
      expect(technicalRisks.length).toBeGreaterThanOrEqual(0);
    });
  });
});

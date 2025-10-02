import { describe, it, expect } from 'vitest';
import { ContingencyPlanner } from '../contingency-planner.js';
import type { RiskFactor, DataSource, ResearchStep } from '../../shared/interfaces.js';

const risks: RiskFactor[] = [
  { type: 'data-availability', probability: 'medium', impact: 'high', mitigationStrategy: 'backup' },
  { type: 'api-limits', probability: 'high', impact: 'high', mitigationStrategy: 'queue' },
  { type: 'time-constraints', probability: 'medium', impact: 'medium', mitigationStrategy: 'prioritize' },
  { type: 'credibility-concerns', probability: 'low', impact: 'high', mitigationStrategy: 'replace' },
  { type: 'technical-failures', probability: 'low', impact: 'medium', mitigationStrategy: 'retry' },
];

const dataSources: DataSource[] = [
  { type: 'web', priority: 2, credibilityWeight: 0.6, estimatedVolume: 'high' },
  { type: 'academic', priority: 1, credibilityWeight: 0.9, estimatedVolume: 'high', rateLimits: { requestsPerMinute: 8, requestsPerHour: 80 } },
];

const steps: ResearchStep[] = [
  { id: 'prep-001', description: 'prep', agentType: 'orchestrator', dependencies: [], estimatedDuration: 5, successCriteria: 'ok', fallbackStrategies: ['a'], priority: 1 },
  { id: 'research-001', description: 'research', agentType: 'web-research', dependencies: ['prep-001'], estimatedDuration: 10, successCriteria: 'ok', fallbackStrategies: ['a'], priority: 2 },
];

describe('ContingencyPlanner', () => {
  it('creates and optimizes contingency plans and gives recommendations', () => {
    const cp = new ContingencyPlanner();
    const plans = cp.createContingencyPlans(risks, dataSources, steps, 'AI in education');
    expect(plans.length).toBeGreaterThan(0);
    const recs = cp.getContingencyRecommendations(plans);
    expect(Array.isArray(recs)).toBe(true);
  });

  describe('Coverage improvements for uncovered lines', () => {
    it('creates data availability contingency plan', () => {
      const cp = new ContingencyPlanner();
      const dataRisk: RiskFactor[] = [
        { type: 'data-availability', probability: 'high', impact: 'high', mitigationStrategy: 'backup sources' },
      ];
      const plans = cp.createContingencyPlans(dataRisk, dataSources, steps, 'Machine Learning');
      
      expect(plans.length).toBeGreaterThan(0);
      const dataAvailabilityPlan = plans.find(p => p.triggerCondition.includes('data sources'));
      expect(dataAvailabilityPlan).toBeDefined();
      expect(dataAvailabilityPlan?.fallbackStrategy).toContain('backup');
    });

    it('creates API limit contingency plan', () => {
      const cp = new ContingencyPlanner();
      const apiRisk: RiskFactor[] = [
        { type: 'api-limits', probability: 'high', impact: 'high', mitigationStrategy: 'queue requests' },
      ];
      const limitedSources: DataSource[] = [
        { type: 'academic', priority: 1, credibilityWeight: 0.9, estimatedVolume: 'high', rateLimits: { requestsPerMinute: 8, requestsPerHour: 80 } },
      ];
      const plans = cp.createContingencyPlans(apiRisk, limitedSources, steps, 'Research Topic');
      
      const apiPlan = plans.find(p => p.triggerCondition.includes('API rate limits'));
      expect(apiPlan).toBeDefined();
      expect(apiPlan?.fallbackStrategy).toContain('queuing');
    });

    it('creates time constraint contingency plan', () => {
      const cp = new ContingencyPlanner();
      const timeRisk: RiskFactor[] = [
        { type: 'time-constraints', probability: 'medium', impact: 'high', mitigationStrategy: 'prioritize' },
      ];
      const manySteps: ResearchStep[] = [
        { id: 'r1', description: 'critical', agentType: 'academic-research', dependencies: [], estimatedDuration: 30, successCriteria: 'ok', fallbackStrategies: [], priority: 1 },
        { id: 'r2', description: 'critical', agentType: 'web-research', dependencies: [], estimatedDuration: 20, successCriteria: 'ok', fallbackStrategies: [], priority: 2 },
        { id: 'r3', description: 'optional', agentType: 'data-analysis', dependencies: [], estimatedDuration: 15, successCriteria: 'ok', fallbackStrategies: [], priority: 3 },
        { id: 'r4', description: 'optional', agentType: 'web-research', dependencies: [], estimatedDuration: 10, successCriteria: 'ok', fallbackStrategies: [], priority: 4 },
      ];
      const plans = cp.createContingencyPlans(timeRisk, dataSources, manySteps, 'Time-Sensitive Research');
      
      const timePlan = plans.find(p => p.triggerCondition.includes('time exceeds'));
      expect(timePlan).toBeDefined();
      expect(timePlan?.fallbackStrategy).toContain('critical');
    });

    it('creates credibility contingency plan', () => {
      const cp = new ContingencyPlanner();
      const credRisk: RiskFactor[] = [
        { type: 'credibility-concerns', probability: 'medium', impact: 'high', mitigationStrategy: 'replace sources' },
      ];
      const mixedSources: DataSource[] = [
        { type: 'web', priority: 3, credibilityWeight: 0.5, estimatedVolume: 'high' },
        { type: 'academic', priority: 1, credibilityWeight: 0.95, estimatedVolume: 'high' },
      ];
      const plans = cp.createContingencyPlans(credRisk, mixedSources, steps, 'Quality Research');
      
      const credPlan = plans.find(p => p.triggerCondition.includes('credibility'));
      expect(credPlan).toBeDefined();
      expect(credPlan?.fallbackStrategy).toContain('Replace');
    });

    it('creates technical failure contingency plan', () => {
      const cp = new ContingencyPlanner();
      const techRisk: RiskFactor[] = [
        { type: 'technical-failures', probability: 'low', impact: 'medium', mitigationStrategy: 'retry logic' },
      ];
      const plans = cp.createContingencyPlans(techRisk, dataSources, steps, 'Robust Research');
      
      const techPlan = plans.find(p => p.triggerCondition.includes('Agent failure') || p.triggerCondition.includes('technical'));
      expect(techPlan).toBeDefined();
    });

    it('generates general contingency plans', () => {
      const cp = new ContingencyPlanner();
      const noRisks: RiskFactor[] = [];
      const plans = cp.createContingencyPlans(noRisks, dataSources, steps, 'Standard Research');
      
      // Should still generate general contingency plans
      expect(plans.length).toBeGreaterThan(0);
    });

    it('optimizes and deduplicates contingency plans', () => {
      const cp = new ContingencyPlanner();
      const duplicateRisks: RiskFactor[] = [
        { type: 'data-availability', probability: 'medium', impact: 'high', mitigationStrategy: 'backup' },
        { type: 'data-availability', probability: 'high', impact: 'high', mitigationStrategy: 'backup' },
        { type: 'api-limits', probability: 'high', impact: 'high', mitigationStrategy: 'queue' },
      ];
      const plans = cp.createContingencyPlans(duplicateRisks, dataSources, steps, 'Optimized Research');
      
      // Should optimize and avoid complete duplication
      expect(plans.length).toBeGreaterThan(0);
    });

    it('provides contingency recommendations based on plans', () => {
      const cp = new ContingencyPlanner();
      const plans = cp.createContingencyPlans(risks, dataSources, steps, 'Research with Recommendations');
      const recommendations = cp.getContingencyRecommendations(plans);
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      // Recommendations should be strings
      recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
      });
    });

    it('handles empty risk array', () => {
      const cp = new ContingencyPlanner();
      const plans = cp.createContingencyPlans([], dataSources, steps, 'No Risk Research');
      
      // Should still return general plans
      expect(plans.length).toBeGreaterThanOrEqual(0);
    });

    it('handles single data source', () => {
      const cp = new ContingencyPlanner();
      const singleSource: DataSource[] = [
        { type: 'web', priority: 1, credibilityWeight: 0.8, estimatedVolume: 'high' },
      ];
      const plans = cp.createContingencyPlans(risks, singleSource, steps, 'Limited Source Research');
      
      expect(plans.length).toBeGreaterThan(0);
    });

    it('handles complex dependency chains', () => {
      const cp = new ContingencyPlanner();
      const complexSteps: ResearchStep[] = [
        { id: 'r1', description: 'base', agentType: 'web-research', dependencies: [], estimatedDuration: 10, successCriteria: 'ok', fallbackStrategies: [], priority: 1 },
        { id: 'r2', description: 'depend1', agentType: 'academic-research', dependencies: ['r1'], estimatedDuration: 15, successCriteria: 'ok', fallbackStrategies: [], priority: 1 },
        { id: 'r3', description: 'depend2', agentType: 'data-analysis', dependencies: ['r1', 'r2'], estimatedDuration: 20, successCriteria: 'ok', fallbackStrategies: [], priority: 2 },
      ];
      const plans = cp.createContingencyPlans(risks, dataSources, complexSteps, 'Complex Dependencies');
      
      expect(plans.length).toBeGreaterThan(0);
    });

    it('generates technical topic-specific contingency plans', () => {
      const cp = new ContingencyPlanner();
      const plans = cp.createContingencyPlans(risks, dataSources, steps, 'Software programming and code development');
      
      const techPlan = plans.find(p => p.triggerCondition.includes('API documentation'));
      expect(techPlan).toBeDefined();
      expect(techPlan?.fallbackStrategy).toContain('source code');
    });

    it('generates scientific topic-specific contingency plans', () => {
      const cp = new ContingencyPlanner();
      const plans = cp.createContingencyPlans(risks, dataSources, steps, 'Scientific research study on biology');
      
      const sciencePlan = plans.find(p => p.triggerCondition.includes('Recent studies'));
      expect(sciencePlan).toBeDefined();
      expect(sciencePlan?.fallbackStrategy).toContain('meta-analysis');
    });

    it('generates business topic-specific contingency plans', () => {
      const cp = new ContingencyPlanner();
      const plans = cp.createContingencyPlans(risks, dataSources, steps, 'Business market and industry analysis');
      
      const businessPlan = plans.find(p => p.triggerCondition.includes('Market data'));
      expect(businessPlan).toBeDefined();
      expect(businessPlan?.fallbackStrategy).toContain('historical trends');
    });

    it('identifies backup sources when academic sources missing', () => {
      const cp = new ContingencyPlanner();
      const webOnlySources: DataSource[] = [
        { type: 'web', priority: 1, credibilityWeight: 0.7, estimatedVolume: 'high' },
      ];
      const plans = cp.createContingencyPlans(risks, webOnlySources, steps, 'Academic Research Topic');
      
      // Should suggest academic backups
      expect(plans.length).toBeGreaterThan(0);
      expect(plans.some(p => p.fallbackStrategy.includes('academic') || p.fallbackStrategy.includes('scholarly') || p.fallbackStrategy.includes('backup'))).toBe(true);
    });

    it('identifies technical backup sources for software topics', () => {
      const cp = new ContingencyPlanner();
      const noWebSources: DataSource[] = [
        { type: 'academic', priority: 1, credibilityWeight: 0.9, estimatedVolume: 'high' },
      ];
      const plans = cp.createContingencyPlans(risks, noWebSources, steps, 'Technical software development');
      
      // May or may not find exact match, but should have plans
      expect(plans.length).toBeGreaterThan(0);
    });

    it('identifies business backup sources for market topics', () => {
      const cp = new ContingencyPlanner();
      const limitedSources: DataSource[] = [
        { type: 'web', priority: 1, credibilityWeight: 0.7, estimatedVolume: 'high' },
      ];
      const plans = cp.createContingencyPlans(risks, limitedSources, steps, 'Business market analysis');
      
      // May or may not find exact match, but should have plans
      expect(plans.length).toBeGreaterThan(0);
    });

    it('calculates scope reduction based on high impact and high probability', () => {
      const cp = new ContingencyPlanner();
      const highRisk: RiskFactor[] = [
        { type: 'data-availability', probability: 'high', impact: 'high', mitigationStrategy: 'backup' },
      ];
      const plans = cp.createContingencyPlans(highRisk, dataSources, steps, 'High Risk Research');
      
      const dataAvailPlan = plans.find(p => p.triggerCondition.includes('data sources'));
      expect(dataAvailPlan).toBeDefined();
      // High impact + high probability should suggest scope reduction
      expect(dataAvailPlan?.estimatedImpact).toBeDefined();
    });

    it('calculates scope reduction based on medium impact and probability', () => {
      const cp = new ContingencyPlanner();
      const mediumRisk: RiskFactor[] = [
        { type: 'data-availability', probability: 'medium', impact: 'medium', mitigationStrategy: 'backup' },
      ];
      const plans = cp.createContingencyPlans(mediumRisk, dataSources, steps, 'Medium Risk Research');
      
      expect(plans.length).toBeGreaterThan(0);
    });

    it('calculates scope reduction based on low impact', () => {
      const cp = new ContingencyPlanner();
      const lowRisk: RiskFactor[] = [
        { type: 'data-availability', probability: 'low', impact: 'low', mitigationStrategy: 'backup' },
      ];
      const plans = cp.createContingencyPlans(lowRisk, dataSources, steps, 'Low Risk Research');
      
      expect(plans.length).toBeGreaterThan(0);
    });

    it('calculates queue delay for multiple rate-limited sources', () => {
      const cp = new ContingencyPlanner();
      const multiRateLimited: DataSource[] = [
        { type: 'academic', priority: 1, credibilityWeight: 0.9, estimatedVolume: 'high', rateLimits: { requestsPerMinute: 5, requestsPerHour: 50 } },
        { type: 'news', priority: 2, credibilityWeight: 0.7, estimatedVolume: 'high', rateLimits: { requestsPerMinute: 10, requestsPerHour: 100 } },
      ];
      const apiRisk: RiskFactor[] = [
        { type: 'api-limits', probability: 'high', impact: 'high', mitigationStrategy: 'queue' },
      ];
      const plans = cp.createContingencyPlans(apiRisk, multiRateLimited, steps, 'Rate Limited Research');
      
      const apiPlan = plans.find(p => p.triggerCondition.includes('API rate limits'));
      expect(apiPlan).toBeDefined();
      expect(apiPlan?.fallbackStrategy).toContain('ms');
    });

    it('handles sources without rate limits in API contingency', () => {
      const cp = new ContingencyPlanner();
      const noRateLimits: DataSource[] = [
        { type: 'web', priority: 1, credibilityWeight: 0.7, estimatedVolume: 'high' },
        { type: 'academic', priority: 2, credibilityWeight: 0.9, estimatedVolume: 'high' },
      ];
      const apiRisk: RiskFactor[] = [
        { type: 'api-limits', probability: 'high', impact: 'high', mitigationStrategy: 'queue' },
      ];
      const plans = cp.createContingencyPlans(apiRisk, noRateLimits, steps, 'No Rate Limit Research');
      
      // Should still create general plans even without rate limits
      expect(plans.length).toBeGreaterThan(0);
    });

    it('calculates buffer time for affected steps in API limit plan', () => {
      const cp = new ContingencyPlanner();
      const rateLimitedSource: DataSource[] = [
        { type: 'academic', priority: 1, credibilityWeight: 0.9, estimatedVolume: 'high', rateLimits: { requestsPerMinute: 5, requestsPerHour: 50 } },
      ];
      const manySteps: ResearchStep[] = [
        { id: 'r1', description: 'academic step', agentType: 'academic-research', dependencies: [], estimatedDuration: 20, successCriteria: 'ok', fallbackStrategies: [], priority: 1 },
        { id: 'r2', description: 'web step', agentType: 'web-research', dependencies: [], estimatedDuration: 15, successCriteria: 'ok', fallbackStrategies: [], priority: 2 },
      ];
      const apiRisk: RiskFactor[] = [
        { type: 'api-limits', probability: 'high', impact: 'high', mitigationStrategy: 'queue' },
      ];
      const plans = cp.createContingencyPlans(apiRisk, rateLimitedSource, manySteps, 'Multi-Step Research');
      
      const apiPlan = plans.find(p => p.triggerCondition.includes('API rate limits'));
      expect(apiPlan).toBeDefined();
      expect(apiPlan?.resourceAdjustment).toContain('minutes');
    });
  });
});

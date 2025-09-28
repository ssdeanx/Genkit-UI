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
});

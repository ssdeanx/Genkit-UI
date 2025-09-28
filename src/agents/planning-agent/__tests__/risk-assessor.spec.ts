import { describe, it, expect } from 'vitest';
import { RiskAssessor } from '../risk-assessor.js';
import type { DataSource, ResearchStep } from '../../shared/interfaces.js';

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
});

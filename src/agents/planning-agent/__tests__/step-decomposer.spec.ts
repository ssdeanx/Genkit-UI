import { describe, it, expect } from 'vitest';
import { StepDecomposer } from '../step-decomposer.js';
import type { DataSource, ResearchDimension } from '../../shared/interfaces.js';

const dims: ResearchDimension[] = [
  { type: 'academic', relevance: 0.9, priority: 'high' },
  { type: 'web', relevance: 0.7, priority: 'medium' },
  { type: 'statistical', relevance: 0.8, priority: 'high' },
];

const sources: DataSource[] = [
  { type: 'academic', priority: 1, credibilityWeight: 0.9, estimatedVolume: 'high' },
  { type: 'web', priority: 2, credibilityWeight: 0.6, estimatedVolume: 'high' },
  { type: 'statistical', priority: 1, credibilityWeight: 0.95, estimatedVolume: 'low' },
];

describe('StepDecomposer', () => {
  it('decomposes into preparation, research, analysis, and validation steps', () => {
    const sd = new StepDecomposer();
    const steps = sd.decomposeIntoSteps('AI', 'systematic', sources, dims, 'medium');
    const ids = steps.map(s => s.id);
    expect(ids.find(id => id.startsWith('prep-'))).toBeDefined();
    expect(ids.find(id => id.startsWith('research-'))).toBeDefined();
    expect(ids.find(id => id.startsWith('analysis-'))).toBeDefined();
    expect(ids.find(id => id.startsWith('validation-'))).toBeDefined();
  });

  it('optimizes for parallel execution and computes critical path', () => {
    const sd = new StepDecomposer();
    const steps = sd.decomposeIntoSteps('AI', 'comparative', sources, dims, 'comprehensive');
    const result = sd.optimizeForParallelExecution(steps);
    expect(result.parallelGroups.length).toBeGreaterThan(0);
    expect(result.criticalPath.length).toBeGreaterThan(0);
    expect(result.estimatedTotalTime).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { MethodologySelector } from '../methodology-selector.js';
import type { ResearchDimension } from '../../shared/interfaces.js';

const baseAnalysis = {
  scopeDimensions: [],
  knowledgeGaps: [],
  stakeholderNeeds: [],
  researchDimensions: [],
  complexity: 'moderate' as const,
  estimatedScope: 'medium' as const,
};

describe('MethodologySelector', () => {
  it('selects systematic for expert or comprehensive', () => {
    const ms = new MethodologySelector();
    const m1 = ms.selectMethodology({ ...baseAnalysis, complexity: 'expert' }, 'AI');
    expect(m1.approach).toBe('systematic');
    const m2 = ms.selectMethodology({ ...baseAnalysis, estimatedScope: 'comprehensive' }, 'AI');
    expect(m2.approach).toBe('systematic');
    expect(m1.phases.length).toBeGreaterThan(0);
    expect(m1.qualityControls).toContain('Source credibility verification');
  });

  it('selects comparative when comparative scope present', () => {
    const ms = new MethodologySelector();
    const m = ms.selectMethodology({ ...baseAnalysis, scopeDimensions: ['comparative'] }, 'Compare DBs');
    expect(m.approach).toBe('comparative');
    // validation should detect if methodology not comparative
    const validation = ms.validateMethodology(m, { ...baseAnalysis, scopeDimensions: ['comparative'], researchDimensions: [] });
    expect(validation.isValid).toBe(true);
  });

  it('selects case-study for complex + narrow', () => {
    const ms = new MethodologySelector();
    const m = ms.selectMethodology({ ...baseAnalysis, complexity: 'complex', estimatedScope: 'narrow' }, 'Edge case');
    expect(m.approach).toBe('case-study');
  });

  it('selects exploratory when broad scope or fundamental understanding gap', () => {
    const ms = new MethodologySelector();
    const m1 = ms.selectMethodology({ ...baseAnalysis, estimatedScope: 'broad' }, 'Topic');
    expect(m1.approach).toBe('exploratory');
    const m2 = ms.selectMethodology({ ...baseAnalysis, knowledgeGaps: ['fundamental understanding'] }, 'Topic');
    expect(m2.approach).toBe('exploratory');
  });

  it('validateMethodology flags academic needs vs exploratory', () => {
    const ms = new MethodologySelector();
    const rd: ResearchDimension[] = [{ type: 'academic', relevance: 0.9, priority: 'high' }];
    const analysis = {
      scopeDimensions: [],
      knowledgeGaps: [],
      stakeholderNeeds: ['analysis'],
      researchDimensions: rd,
      complexity: 'complex' as const,
    };
    const m = ms.selectMethodology({ ...baseAnalysis, estimatedScope: 'broad' }, 'Topic'); // exploratory
    const res = ms.validateMethodology(m, analysis);
    expect(res.isValid).toBe(false);
    expect(res.issues.length).toBeGreaterThan(0);
    expect(res.recommendations.join(' ')).toContain('systematic');
  });
});

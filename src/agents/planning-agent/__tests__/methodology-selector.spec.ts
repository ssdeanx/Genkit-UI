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

  describe('Coverage improvements for uncovered lines', () => {
    it('handles global scope dimension for quality controls', () => {
      const ms = new MethodologySelector();
      const globalAnalysis = {
        ...baseAnalysis,
        scopeDimensions: ['global'],
        complexity: 'complex' as const,
      };
      const methodology = ms.selectMethodology(globalAnalysis, 'Global topic');
      expect(methodology.qualityControls).toContain('Cultural and contextual adaptation');
    });

    it('handles expert complexity with peer validation', () => {
      const ms = new MethodologySelector();
      const expertAnalysis = {
        ...baseAnalysis,
        complexity: 'expert' as const,
      };
      const methodology = ms.selectMethodology(expertAnalysis, 'Expert topic');
      expect(methodology.qualityControls).toContain('Expert peer validation');
      expect(methodology.qualityControls).toContain('Methodological transparency');
    });

    it('adds academic source controls when academic dimension present', () => {
      const ms = new MethodologySelector();
      const academicDims: ResearchDimension[] = [
        { type: 'academic', relevance: 0.9, priority: 'high' },
      ];
      const methodology = ms.selectMethodology({
        ...baseAnalysis,
        researchDimensions: academicDims,
      }, 'Academic research');
      expect(methodology.qualityControls).toContain('Academic rigor standards');
    });

    it('adds statistical validation when statistical dimension present', () => {
      const ms = new MethodologySelector();
      const statDims: ResearchDimension[] = [
        { type: 'statistical', relevance: 0.85, priority: 'high' },
      ];
      const methodology = ms.selectMethodology({
        ...baseAnalysis,
        researchDimensions: statDims,
      }, 'Statistical research');
      expect(methodology.qualityControls).toContain('Statistical validity checks');
    });

    it('suggests comparative methodology when comparative scope present', () => {
      const ms = new MethodologySelector();
      const exploratory = ms.selectMethodology({
        ...baseAnalysis,
        estimatedScope: 'broad',
      }, 'Topic');
      
      const validation = ms.validateMethodology(exploratory, {
        ...baseAnalysis,
        scopeDimensions: ['comparative'],
      });
      
      expect(validation.recommendations.some((s: string) => s.includes('comparative'))).toBe(true);
    });

    it('suggests systematic approach for complex analysis needs', () => {
      const ms = new MethodologySelector();
      const exploratory = ms.selectMethodology({
        ...baseAnalysis,
        estimatedScope: 'broad',
      }, 'Topic');
      
      const validation = ms.validateMethodology(exploratory, {
        scopeDimensions: [],
        knowledgeGaps: [],
        stakeholderNeeds: ['analysis'],
        researchDimensions: [],
      });
      
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.recommendations.some((s: string) => s.includes('systematic') || s.includes('case-study'))).toBe(true);
    });

    it('returns standard phases for all methodologies', () => {
      const ms = new MethodologySelector();
      // Test that systematic methodology returns correct phases
      const systematic = ms.selectMethodology({
        ...baseAnalysis,
        complexity: 'expert' as const,
      }, 'Expert topic');
      
      expect(systematic.phases.length).toBeGreaterThan(0);
      expect(systematic.phases).toContain('Research question formulation');
      expect(systematic.phases).toContain('Systematic literature review');
    });

    it('validates with no issues for well-aligned methodology', () => {
      const ms = new MethodologySelector();
      const systematic = ms.selectMethodology({
        ...baseAnalysis,
        complexity: 'expert' as const,
      }, 'Expert topic');
      
      const validation = ms.validateMethodology(systematic, {
        scopeDimensions: [],
        knowledgeGaps: [],
        stakeholderNeeds: [],
        researchDimensions: [],
      });
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues.length).toBe(0);
    });

    it('provides methodology recommendations with details', () => {
      const ms = new MethodologySelector();
      const recommendations = ms.getMethodologyRecommendations();
      
      expect(recommendations.systematic).toBeDefined();
      expect(recommendations.systematic?.approach).toBe('systematic');
      expect(recommendations.systematic?.strengths.length).toBeGreaterThan(0);
      expect(recommendations.systematic?.limitations.length).toBeGreaterThan(0);
      
      expect(recommendations.exploratory).toBeDefined();
      expect(recommendations.exploratory?.whenToUse).toContain('New or broad');
      
      expect(recommendations.comparative).toBeDefined();
      expect(recommendations.comparative?.strengths).toContain('Highlights differences and similarities');
      
      expect(recommendations['case-study']).toBeDefined();
      expect(recommendations['case-study']?.limitations).toContain('Limited generalizability');
    });
  });
});

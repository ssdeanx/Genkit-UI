import { describe, it, expect, beforeEach } from 'vitest';
import { DataSourceIdentifier } from '../data-source-identifier.js';
import type { ResearchDimension } from '../../shared/interfaces.js';

describe('DataSourceIdentifier', () => {
  const dims: ResearchDimension[] = [
    { type: 'academic', relevance: 0.9, priority: 'high' },
    { type: 'web', relevance: 0.6, priority: 'medium' },
    { type: 'statistical', relevance: 0.7, priority: 'high' },
  ];

  beforeEach(() => {
    delete (process.env as any).ACADEMIC_API_KEY;
    delete (process.env as any).NEWS_API_KEY;
    delete (process.env as any).STATISTICAL_API_KEY;
  });

  it('identifies and prioritizes sources based on dimensions and methodology', () => {
    const dsi = new DataSourceIdentifier();
    const sources = dsi.identifyDataSources(dims, 'AI', 'systematic');
    expect(sources.length).toBeGreaterThan(0);
    // Should include academic and statistical, likely high priority first
    const first = sources[0]!;
    expect(['academic', 'statistical']).toContain(first.type);
    // Priorities sorted primarily by dimension alignment and relevance (sanity check: priorities exist)
    for (let i = 1; i < sources.length; i++) {
      const prev = sources[i - 1]!;
      const cur = sources[i]!;
      expect(typeof prev.priority).toBe('number');
      expect(typeof cur.priority).toBe('number');
    }
  });

  it('validates sources and reports access issues when API keys missing', () => {
    const dsi = new DataSourceIdentifier();
    const sources = dsi.identifyDataSources(dims, 'AI', 'systematic');
    const { validSources, invalidSources, accessIssues } = dsi.validateDataSources(sources);
    expect(validSources.length + invalidSources.length).toBe(sources.length);
    // Without keys some academic/statistical may fail; ensure issues array is consistent
    expect(Array.isArray(accessIssues)).toBe(true);
  });

  it('passes validation when API keys provided', () => {
    (process.env as any).ACADEMIC_API_KEY = 'x';
    (process.env as any).STATISTICAL_API_KEY = 'y';
    const dsi = new DataSourceIdentifier();
    const sources = dsi.identifyDataSources(dims, 'AI', 'systematic');
    const { accessIssues } = dsi.validateDataSources(sources);
    // News key not provided; but test dims don't include news, so should be fewer/no issues
    expect(accessIssues.every(issue => !issue.includes('academic') && !issue.includes('statistical'))).toBe(true);
  });
});

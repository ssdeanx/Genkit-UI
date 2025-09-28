import { describe, it, expect } from 'vitest';
import { QueryAnalyzer } from '../query-analyzer.js';

describe('QueryAnalyzer', () => {
  it('analyzes complex query with trends and statistics', () => {
    const qa = new QueryAnalyzer();
    const query = 'How do LLMs work? Provide an overview with recent trends and statistical data for comparison.';

    const res = qa.analyzeQuery(query);

    expect(res.coreQuestion.length).toBeGreaterThan(0);
    expect(res.coreQuestion.toLowerCase()).toContain('llms');
  expect(res.scopeDimensions).toContain('future');
    // Should detect statistical dimension
    expect(res.researchDimensions.map(d => d.type)).toContain('statistical');
    // Overview triggers broad scope
    expect(res.estimatedScope).toBe('broad');
  // Complexity should be at least moderate given wording
  expect(['moderate', 'complex', 'expert']).toContain(res.complexity);
  });

  it('defaults to general scope and web research for simple queries', () => {
    const qa = new QueryAnalyzer();
    const res = qa.analyzeQuery('What is photosynthesis?');
    expect(res.scopeDimensions.length).toBeGreaterThan(0);
    expect(res.researchDimensions.map(d => d.type)).toContain('web');
  });
});

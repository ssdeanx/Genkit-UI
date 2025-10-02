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

  describe('Coverage improvements for uncovered lines', () => {
    it('detects comparative dimensions with versus/vs keywords', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Compare Python versus JavaScript for web development');
      
      expect(res.scopeDimensions).toContain('comparative');
      expect(res.coreQuestion.toLowerCase()).toContain('python');
    });

    it('detects global geographic dimensions', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('What are the global impacts of climate change worldwide?');
      
      expect(res.scopeDimensions).toContain('global');
    });

    it('detects local/regional geographic dimensions', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('What are local trends in regional housing markets?');
      
      expect(res.scopeDimensions).toContain('local');
    });

    it('detects methodological dimensions with how/process keywords', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('How does the process of photosynthesis work using scientific methods?');
      
      expect(res.scopeDimensions).toContain('methodological');
    });

    it('detects causal dimensions with why/cause/reason keywords', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Why did the Roman Empire fall? What were the causes and reasons?');
      
      expect(res.scopeDimensions).toContain('causal');
    });

    it('identifies fundamental understanding knowledge gaps', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('The effects of quantum computing are unknown and unclear, not sure about impacts');
      
      expect(res.knowledgeGaps).toContain('fundamental understanding');
    });

    it('identifies empirical evidence knowledge gaps', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Need research and study to investigate machine learning effectiveness');
      
      expect(res.knowledgeGaps).toContain('empirical evidence');
    });

    it('identifies comparative analysis knowledge gaps', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Which database is better? Need to compare and find the best option');
      
      expect(res.knowledgeGaps).toContain('comparative analysis');
    });

    it('identifies temporal analysis knowledge gaps', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('How have AI trends changed and evolved over time?');
      
      expect(res.knowledgeGaps).toContain('temporal analysis');
    });

    it('identifies explanation stakeholder needs', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('How does blockchain work? Why is it secure? Please explain the technology');
      
      expect(res.stakeholderNeeds).toContain('explanation');
    });

    it('identifies decision support stakeholder needs', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Which framework should I choose? Recommend the best option for my project');
      
      expect(res.stakeholderNeeds).toContain('decision support');
    });

    it('identifies analysis stakeholder needs', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Analyze the market trends and evaluate the potential risks, assess the opportunities');
      
      expect(res.stakeholderNeeds).toContain('analysis');
    });

    it('detects academic research dimensions', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Find scholarly research and peer-reviewed journal studies on academic topics');
      
      const academicDim = res.researchDimensions.find(d => d.type === 'academic');
      expect(academicDim).toBeDefined();
      expect(academicDim?.priority).toBe('high');
    });

    it('detects web/general knowledge dimensions', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('General overview and basic introduction to machine learning definitions');
      
      const webDim = res.researchDimensions.find(d => d.type === 'web');
      expect(webDim).toBeDefined();
    });

    it('assesses expert complexity level', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Provide a comprehensive meta-analysis and systematic review of the theoretical framework and methodology for quantum computing research applications');
      
      expect(res.complexity).toBe('expert');
    });

    it('assesses complex complexity level', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Compare and analyze the impact of different approaches, evaluate the relationship between factors');
      
      expect(res.complexity).toBe('complex');
    });

    it('assesses moderate complexity level', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('How does this process work and why is it important? Please explain');
      
      expect(res.complexity).toBe('moderate');
    });

    it('assesses simple complexity level', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('What is AI?');
      
      expect(res.complexity).toBe('simple');
    });

    it('estimates comprehensive scope', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Provide a comprehensive and complete thorough exhaustive analysis');
      
      expect(res.estimatedScope).toBe('comprehensive');
    });

    it('estimates broad scope', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Give me a general overview of the broad and wide landscape');
      
      expect(res.estimatedScope).toBe('broad');
    });

    it('estimates medium scope for longer queries', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('What are the key factors influencing modern software development practices today?');
      
      expect(res.estimatedScope).toBe('medium');
    });

    it('estimates narrow scope for short queries', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Define recursion');
      
      expect(res.estimatedScope).toBe('narrow');
    });

    it('defaults to information for stakeholder needs when no specific keywords', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Tell me about cats');
      
      expect(res.stakeholderNeeds).toContain('information');
    });

    it('defaults to general scope dimension when no specific dimensions detected', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Random query without specific dimension keywords');
      
      expect(res.scopeDimensions).toContain('general');
    });

    it('handles queries with multiple dimension types', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Compare global trends in local markets using historical data and future predictions, explain the causes and methods');
      
      expect(res.scopeDimensions.length).toBeGreaterThan(3);
      expect(res.scopeDimensions).toContain('comparative');
      expect(res.scopeDimensions).toContain('global');
      expect(res.scopeDimensions).toContain('local');
    });

    it('handles queries with all research dimension types', () => {
      const qa = new QueryAnalyzer();
      const res = qa.analyzeQuery('Find academic research papers, current news articles, statistical data, and general web information');
      
      expect(res.researchDimensions.length).toBeGreaterThan(0);
      expect(res.researchDimensions.map(d => d.type)).toContain('academic');
    });
  });
});

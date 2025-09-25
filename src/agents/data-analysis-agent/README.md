# Data Analysis Agent

An A2A-compliant agent that conducts statistical analysis, quantitative research, and data-driven insights with rigorous methodological standards.

## Overview

The Data Analysis Agent specializes in quantitative research methodologies, providing comprehensive statistical analysis, data visualization guidance, and evidence-based insights. It follows scientific standards for statistical testing, effect size evaluation, and methodological rigor.

## Capabilities

- **Statistical Analysis**: Hypothesis testing, correlation analysis, regression modeling
- **Data Visualization**: Chart recommendations, visualization principles, data presentation
- **Quantitative Insights**: Effect size interpretation, confidence intervals, practical significance
- **Methodological Rigor**: Assumption testing, robustness checks, alternative analyses
- **Research Standards**: Statistical power analysis, reproducibility assessment, data transparency

## Agent Card

```json
{
  "protocolVersion": "1.0",
  "name": "Data Analysis Agent",
  "description": "An agent that conducts statistical analysis, quantitative research, and data-driven insights with rigorous methodological standards.",
  "url": "http://localhost:41247/",
  "capabilities": {
    "streaming": true,
    "pushNotifications": false,
    "stateTransitionHistory": true
  },
  "skills": [
    {
      "id": "data_analysis",
      "name": "Data Analysis",
      "description": "Conducts comprehensive statistical analysis with hypothesis testing, data visualization, and quantitative insights from research data.",
      "tags": ["statistics", "quantitative", "analysis", "visualization"]
    }
  ]
}
```

## Usage

### Starting the Agent

```bash
# From project root
npm run agents:data-analysis

# Or run directly
npx tsx src/agents/data-analysis-agent/index.ts
```

### Environment Variables

- `GEMINI_API_KEY`: Required for AI model access
- `DATA_ANALYSIS_AGENT_PORT`: Override default port (41247)

### Testing with CLI

```bash
# Start agent in one terminal
npm run agents:data-analysis

# Test in another terminal
npm run a2a:cli http://localhost:41247
```

### Example Queries

```text
"Analyze the statistical significance of these survey results: [data]"
"Create visualizations for this experimental data: [dataset]"
"Perform regression analysis on these variables: [variables]"
"Evaluate the effect sizes in this research study: [findings]"
"Assess the statistical power of this analysis: [methodology]"
```

## Technical Implementation

### Architecture

- **Framework**: Genkit with Google Gemini 2.5 Flash
- **Protocol**: A2A (Agent-to-Agent) protocol
- **Server**: Express.js with CORS support
- **Execution**: Direct TypeScript execution via tsx

### Key Components

- `DataAnalysisAgentExecutor`: Core execution logic for statistical analysis
- `genkit.ts`: AI model configuration with thinking capabilities
- `data_analysis.prompt`: Comprehensive statistical methodology framework

### Statistical Methodologies

The agent supports various statistical approaches:

- **Descriptive Statistics**: Central tendency, variability, distribution analysis
- **Inferential Statistics**: Hypothesis testing, confidence intervals, p-values
- **Correlation Analysis**: Pearson, Spearman, Kendall correlations
- **Regression Analysis**: Linear, logistic, multivariate regression
- **Non-parametric Tests**: Chi-square, Mann-Whitney, Kruskal-Wallis
- **Effect Size Measures**: Cohen's d, odds ratios, relative risk
- **Power Analysis**: Sample size calculations, statistical power assessment

### Data Visualization

Provides recommendations for:

- **Chart Types**: Scatter plots, histograms, box plots, bar charts
- **Statistical Graphics**: Q-Q plots, residual plots, confidence bands
- **Dashboard Elements**: KPI cards, trend lines, comparative visualizations
- **Best Practices**: Color schemes, labeling, scale selection

## Integration

### A2A Protocol Integration

The agent fully implements the A2A protocol:

- **Agent Card**: Published at `/.well-known/agent-card.json`
- **Task Management**: Full task lifecycle with status updates
- **Streaming**: Real-time progress updates during analysis
- **Event Publishing**: Status transitions and completion notifications

### Multi-Agent Coordination

Designed to work with other research agents:

- **Orchestrator Agent**: Receives analysis tasks and coordinates execution
- **Web Research Agent**: Provides data sources for analysis
- **Academic Research Agent**: Supplies methodological frameworks
- **News Research Agent**: Delivers current data for analysis

## Quality Assurance

### Statistical Standards

- **Methodological Rigor**: Follows APA and statistical best practices
- **Assumption Testing**: Validates statistical test assumptions
- **Robustness Checks**: Alternative analysis methods
- **Transparency**: Documents all analysis decisions

### Validation Framework

- **Data Quality Assessment**: Evaluates data completeness and reliability
- **Statistical Power**: Ensures adequate sample sizes
- **Effect Size Reporting**: Provides practical significance measures
- **Reproducibility**: Documents analysis methods for replication

## Development

### File Structure

```text
src/agents/data-analysis-agent/
├── index.ts              # Server setup and agent executor
├── genkit.ts             # AI model configuration
├── data_analysis.prompt  # Statistical methodology framework
└── README.md             # This documentation
```

### Dependencies

- `@a2a-js/sdk`: A2A protocol implementation
- `@genkit-ai/ai`: Genkit AI framework
- `@genkit-ai/googleai`: Google Gemini integration
- `express`: HTTP server framework
- `uuid`: Unique identifier generation

## Future Enhancements

- **Advanced Analytics**: Machine learning integration, predictive modeling
- **Real-time Data**: Streaming data analysis capabilities
- **Interactive Visualizations**: Web-based chart generation
- **Statistical Software Integration**: R/Python connectivity
- **Collaborative Analysis**: Multi-agent statistical workflows

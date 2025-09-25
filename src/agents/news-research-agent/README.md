# News Research Agent

The News Research Agent specializes in current events analysis, media credibility assessment, and breaking news investigation.

## Overview

This agent conducts comprehensive news research by:

- **Current Events Tracking**: Monitoring breaking news, developing stories, and real-time updates
- **Media Credibility Assessment**: Evaluating journalistic standards, source transparency, and fact-checking
- **Cross-Media Analysis**: Comparing coverage across multiple news outlets for comprehensive understanding
- **Bias Detection**: Identifying media bias patterns and editorial perspectives
- **Timeline Reconstruction**: Building chronological narratives from multiple news sources

## Agent Capabilities

- **Multi-Source News Analysis**: Research across major news outlets, wire services, and specialized publications
- **Real-Time Event Tracking**: Monitor breaking news and rapidly developing stories
- **Credibility Scoring**: Evaluate source reliability and journalistic standards
- **Media Bias Analysis**: Identify political leanings and editorial perspectives
- **Impact Assessment**: Evaluate significance and broader implications of news events

## Configuration

### Environment Variables

- `GEMINI_API_KEY`: Required for AI model access
- `NEWS_RESEARCH_AGENT_PORT`: Port for the agent server (default: 41246)

### Dependencies

- Google Gemini 2.5 Flash model with thinking capabilities
- A2A protocol for inter-agent communication

## Usage

### Starting the Agent

```bash
# From the project root
npm run agents:news-research-agent
```

### Testing with CLI

```bash
# Connect to the news research agent
npm run a2a:cli http://localhost:41246

# Example research request
"Research media coverage of recent technological breakthroughs"
```

## Research Methodology

### Source Selection Strategy

1. **Major News Outlets**: CNN, BBC, Reuters, Associated Press, major newspapers
2. **Wire Services**: AP, Reuters, AFP for factual reporting baseline
3. **Specialized Publications**: Industry-specific news, regional coverage, international perspectives
4. **Digital-Native Media**: Online news sites with strong editorial standards

### Credibility Assessment Framework

- **Journalistic Standards**: Editorial oversight, fact-checking processes, corrections policies
- **Source Transparency**: Funding disclosure, conflict of interest statements, ownership transparency
- **Historical Accuracy**: Track record of accurate reporting and responsible corrections
- **Independence**: Editorial separation from political or commercial influences

### News Analysis Process

- **Event Reconstruction**: Build complete timelines from multiple source accounts
- **Stakeholder Mapping**: Identify all parties involved and their perspectives
- **Impact Evaluation**: Assess short-term developments and long-term consequences
- **Context Provision**: Supply necessary background for complex news stories

## Output Format

The agent provides news research results in structured JSON format including:

- **News Search Parameters**: Timeframes, sources, and geographic scope
- **News Findings**: Event timelines with multi-source coverage and credibility scores
- **Media Analysis**: Coverage consensus, bias observations, and fact-checking status
- **Context & Analysis**: Historical background, expert reactions, and future implications

## Integration Points

### Input Sources

- **Orchestrator Agent**: Receives research tasks requiring current events analysis
- **Planning Agent**: Gets temporal requirements and news focus areas
- **User Requests**: Accepts queries about breaking news and current developments

### Output Destinations

- **Orchestrator Agent**: Provides current events data and media analysis
- **Web Research Agent**: Supplies news context for general web findings
- **Data Analysis Agent**: Delivers news data for trend analysis and sentiment tracking

## Development Status

**Current Implementation**: Basic news research framework with credibility assessment and media analysis.

**Next Steps**:

- Integrate with news APIs (NewsAPI, Google News, etc.)
- Add real-time news monitoring capabilities
- Implement advanced media bias detection algorithms
- Develop breaking news alert systems
- Enhance fact-checking integration

## API Reference

### Agent Card Endpoint

```http
GET /.well-known/agent-card.json
```

Returns the agent's capabilities and supported operations.

### Task Execution

The agent accepts news research requests and conducts current events analysis through the A2A task protocol.

## Error Handling

- **Source Unavailability**: Fallback to alternative news sources and cached content
- **Breaking News Overload**: Prioritize most credible and recent sources
- **Fact-Checking Delays**: Provisional reporting with verification status updates
- **Geographic Restrictions**: Appropriate source selection for regional news access

## Monitoring and Logging

- Console logging for news source evaluation and credibility scoring
- Progress updates published via A2A events
- Breaking news detection and alert monitoring
- Media bias analysis and coverage diversity tracking

## Future Enhancements

- **Real-Time News APIs**: Direct integration with major news aggregation services
- **Breaking News Alerts**: Automated detection and notification systems
- **Multimedia News Analysis**: Research involving video, audio, and social media content
- **Sentiment Analysis**: Public reaction tracking and social media monitoring
- **International News Networks**: Multi-language news research capabilities

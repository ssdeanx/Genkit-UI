# Web Research Agent

The Web Research Agent specializes in comprehensive online information gathering, source credibility assessment, and synthesis of findings from diverse web sources.

## Overview

This agent conducts thorough web-based research by:

- **Strategic Search**: Designing effective search strategies across multiple platforms
- **Source Evaluation**: Assessing credibility, authority, and reliability of web sources
- **Content Analysis**: Extracting key information and insights from web content
- **Cross-Validation**: Comparing information across multiple sources
- **Synthesis**: Combining findings into coherent, well-supported conclusions

## Agent Capabilities

- **Multi-Source Research**: Searches across search engines, academic sites, news outlets, and government resources
- **Credibility Assessment**: Evaluates source authority, objectivity, and trustworthiness
- **Content Extraction**: Identifies and extracts relevant information from web pages
- **Insight Synthesis**: Combines findings from multiple sources into actionable insights
- **Gap Analysis**: Identifies missing information and recommends further research

## Configuration

### Environment Variables

- `GEMINI_API_KEY`: Required for AI model access
- `WEB_RESEARCH_AGENT_PORT`: Port for the agent server (default: 41244)

### Dependencies

- Google Gemini 2.5 Flash model with thinking capabilities
- A2A protocol for inter-agent communication

## Usage

### Starting the Agent

```bash
# From the project root
npm run agents:web-research-agent
```

### Testing with CLI

```bash
# Connect to the web research agent
npm run a2a:cli http://localhost:41244

# Example research request
"Research the latest developments in renewable energy technology"
```

## Research Methodology

### Search Strategy

1. **Query Optimization**: Creates targeted search queries with Boolean operators
2. **Source Diversification**: Uses multiple search platforms and source types
3. **Time Filtering**: Applies recency filters when current information is needed
4. **Depth Control**: Balances breadth and depth based on research requirements

### Credibility Framework

- **High Credibility**: Government, academic, peer-reviewed sources
- **Medium Credibility**: Established news outlets, professional organizations
- **Low Credibility**: General web content, blogs, social media

### Quality Assurance

- **Cross-Verification**: Validates critical claims across multiple sources
- **Fact-Checking**: Identifies and flags contradictory information
- **Completeness Assessment**: Ensures comprehensive coverage of research topics
- **Uncertainty Quantification**: Provides confidence scores for all findings

## Output Format

The agent provides research results in structured JSON format including:

- **Search Strategy**: Queries used and sources searched
- **Findings**: Key information organized by topic with source attribution
- **Analysis**: Insights, contradictions, and gaps identified
- **Metadata**: Source counts, credibility scores, and research metrics

## Integration Points

### Input Sources

- **Orchestrator Agent**: Receives research tasks with specific requirements
- **Planning Agent**: Gets research scope and quality thresholds
- **User Requests**: Accepts direct research queries

### Output Destinations

- **Orchestrator Agent**: Provides research findings and source credibility data
- **Data Analysis Agent**: Supplies raw data for quantitative analysis
- **Reporting Systems**: Delivers synthesized insights for final reports

## Development Status

**Current Implementation**: Basic web research framework with credibility assessment and structured output.

**Next Steps**:

- Implement actual web search APIs (Google, Bing, etc.)
- Add web scraping capabilities for content extraction
- Integrate with academic databases and news APIs
- Enhance credibility scoring algorithms
- Add caching for improved performance

## API Reference

### Agent Card Endpoint

```http
GET /.well-known/agent-card.json
```

Returns the agent's capabilities and supported operations.

### Task Execution

The agent accepts research requests and conducts web investigations through the A2A task protocol.

## Error Handling

- **Search Failures**: Automatic retry with alternative search strategies
- **Source Unavailability**: Fallback to cached or alternative sources
- **Credibility Issues**: Filtering of low-quality sources with user notification
- **Rate Limiting**: Respectful crawling with appropriate delays

## Monitoring and Logging

- Console logging for search strategies and source evaluation
- Progress updates published via A2A events
- Credibility scoring and research metrics tracking
- Performance monitoring for search efficiency

## Future Enhancements

- **Advanced Search**: Integration with premium search APIs and academic databases
- **Real-time Monitoring**: Tracking of breaking news and current events
- **Multimedia Analysis**: Research involving images, videos, and documents
- **Collaborative Research**: Multi-agent research session coordination
- **Personalized Research**: User preference learning and customization

# Planning Agent

An A2A-compliant agent that creates comprehensive, evidence-based research strategies with systematic planning, risk assessment, and execution blueprints.

## Overview

The Planning Agent specializes in research methodology and strategic planning, providing systematic approaches to complex research questions. It excels at breaking down topics, designing methodologies, mapping data sources, and creating executable research plans with risk management.

## Capabilities

- **Research Strategy Development**: Systematic planning frameworks for academic, market, and technical research
- **Methodology Design**: Selection of appropriate research approaches (systematic, exploratory, comparative, case study)
- **Data Source Mapping**: Identification and prioritization of relevant information sources
- **Execution Planning**: Creation of atomic, parallelizable research steps with dependencies
- **Risk Assessment**: Identification of obstacles and development of mitigation strategies
- **Quality Assurance**: Establishment of validation criteria and success metrics

## Agent Card

```json
{
  "protocolVersion": "1.0",
  "name": "Planning Agent",
  "description": "An agent that creates comprehensive, evidence-based research strategies with systematic planning, risk assessment, and execution blueprints.",
  "url": "http://localhost:41245/",
  "capabilities": {
    "streaming": true,
    "pushNotifications": false,
    "stateTransitionHistory": true
  },
  "skills": [
    {
      "id": "research_planning",
      "name": "Research Planning",
      "description": "Creates systematic research strategies with methodology design, data source mapping, execution planning, and risk management.",
      "tags": ["planning", "strategy", "methodology", "research"]
    }
  ]
}
```

## Usage

### Starting the Agent

```bash
# From project root
npm run agents:planning

# Or run directly
npx tsx src/agents/planning-agent/index.ts
```

### Environment Variables

- `GEMINI_API_KEY`: Required for AI model access
- `PLANNING_AGENT_PORT`: Override default port (41245)

### Testing with CLI

```bash
# Start agent in one terminal
npm run agents:planning

# Test in another terminal
npm run a2a:cli http://localhost:41245
```

### Example Queries

```text
"Develop a research plan for analyzing the impact of social media on mental health"
"Create a systematic review methodology for renewable energy technologies"
"Design an investigation strategy for market entry in emerging economies"
"Plan a multi-disciplinary study on climate change adaptation"
"Develop a research strategy for evaluating educational technology effectiveness"
```

## Technical Implementation

### Architecture

- **Framework**: Genkit with Google Gemini 2.5 Flash
- **Protocol**: A2A (Agent-to-Agent) protocol
- **Server**: Express.js with CORS support
- **Execution**: Direct TypeScript execution via tsx

### Key Components

- `PlanningAgentExecutor`: Core execution logic for research planning
- `genkit.ts`: AI model configuration with thinking capabilities
- `planning_agent.prompt`: Comprehensive research planning framework

### Research Planning Framework

The agent uses a structured framework covering:

- **Query Analysis**: Core questions, scope dimensions, knowledge gaps, stakeholder needs
- **Methodology Design**: Primary approaches, research phases, quality controls
- **Data Strategy**: Source categories, prioritization logic, diversity requirements
- **Execution Blueprint**: Atomic steps, parallel opportunities, dependency chains
- **Risk Management**: Critical risks, mitigation strategies, contingency triggers
- **Success Metrics**: Completion criteria, quality thresholds

### Planning Methodologies

Supports various research approaches:

- **Systematic Research**: Comprehensive coverage with structured protocols
- **Exploratory Research**: Discovery-oriented approaches for new topics
- **Comparative Research**: Side-by-side analysis of multiple cases
- **Case Study Research**: In-depth investigation of specific examples
- **Multi-disciplinary Research**: Integration of multiple knowledge domains

## Integration

### A2A Protocol Integration

The agent fully implements the A2A protocol:

- **Agent Card**: Published at `/.well-known/agent-card.json`
- **Task Management**: Full task lifecycle with status updates
- **Streaming**: Real-time progress updates during planning
- **Event Publishing**: Status transitions and completion notifications

### Multi-Agent Coordination

Designed to coordinate with other research agents:

- **Orchestrator Agent**: Receives planning tasks and manages overall research execution
- **Web Research Agent**: Executes data collection plans from planning agent
- **Academic Research Agent**: Follows scholarly research methodologies
- **News Research Agent**: Implements current events investigation strategies
- **Data Analysis Agent**: Applies statistical analysis to collected data

## Quality Assurance

### Planning Standards

- **Methodological Rigor**: Evidence-based planning approaches
- **Risk Assessment**: Comprehensive identification of potential obstacles
- **Contingency Planning**: Multiple fallback strategies
- **Quality Controls**: Source credibility and validation requirements

### Validation Framework

- **Scope Definition**: Clear boundaries and success criteria
- **Dependency Mapping**: Logical sequencing of research activities
- **Time Estimation**: Realistic duration estimates
- **Resource Planning**: Appropriate allocation of research resources

## Development

### File Structure

```text
src/agents/planning-agent/
├── index.ts              # Server setup and agent executor
├── genkit.ts             # AI model configuration
├── planning_agent.prompt # Research planning framework
└── README.md             # This documentation
```

### Dependencies

- `@a2a-js/sdk`: A2A protocol implementation
- `@genkit-ai/ai`: Genkit AI framework
- `@genkit-ai/googleai`: Google Gemini integration
- `express`: HTTP server framework
- `uuid`: Unique identifier generation

## Future Enhancements

- **Advanced Methodologies**: Machine learning-driven research design
- **Collaborative Planning**: Multi-stakeholder research coordination
- **Real-time Adaptation**: Dynamic plan adjustment based on findings
- **Integration Tools**: Research management software connectivity
- **Automated Execution**: Direct integration with research tools and APIs

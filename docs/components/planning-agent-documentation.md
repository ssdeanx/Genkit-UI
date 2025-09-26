---
title: "Planning Agent - Technical Documentation"
component_path: "src/agents/planning-agent"
version: "1.0"
date_created: 2025-09-26
last_updated: 2025-09-26
owner: "team"
tags:
  - "agent"
  - "planning"
  - "a2a"
  - "documentation"
  - "architecture"
  - "component"
  - "research"
---
## Planning Agent — Component Documentation

Purpose
-------
The Planning Agent (src/agents/planning-agent) is responsible for taking a free-form research query and producing an actionable, executable ResearchPlan. It encapsulates the analysis, methodology selection, step decomposition, risk assessment, and contingency planning needed to turn a question into a set of delegated tasks that other agents (orchestrator, web/academic/news/data-analysis, etc.) can execute.

This document summarizes the component responsibilities, public interfaces, architecture, key algorithms, error handling, testing guidance, and usage notes. Use it as a reference for maintaining, extending, or integrating the Planning Agent.

Where to find the code
----------------------

- Entrypoint / executor: `src/agents/planning-agent/index.ts`
- Genkit config: `src/agents/planning-agent/genkit.ts`
- Subsystems:
  - Query analysis: `src/agents/planning-agent/query-analyzer.ts`
  - Methodology selection: `src/agents/planning-agent/methodology-selector.ts`
  - Data source identification: `src/agents/planning-agent/data-source-identifier.ts` (if present)
  - Step decomposition: `src/agents/planning-agent/step-decomposer.ts`
  - Risk assessment: `src/agents/planning-agent/risk-assessor.ts`
  - Contingency planning: `src/agents/planning-agent/contingency-planner.ts`
  - Prompt definitions: `src/agents/planning-agent/planning_agent.prompt` (prompt directory loaded by genkit)

Responsibilities and behaviour
------------------------------

- Analyze a natural-language research query to extract core question, scope, complexity, research dimensions, and stakeholder needs (QueryAnalyzer).
- Select one or more research methodologies appropriate to the query (MethodologySelector).
- Identify and prioritize data sources for the planned work (DataSourceIdentifier).
- Decompose the plan into atomic, parallelizable ResearchStep items with estimated durations, dependencies, priorities and agent assignments (StepDecomposer).
- Assess risks (availability, API limits, time constraints, credibility, technical failures) and produce mitigation strategies (RiskAssessor).
- Generate contingency plans and merge/optimize them to produce actionable fallback strategies (ContingencyPlanner).
- Use Genkit (ai) to synthesize a final, human-readable ResearchPlan and to fill in timeline/formatting/details (`generateComprehensivePlan` in index.ts).

Public classes and interfaces (summary)
-------------------------------------

- ResearchPlanner (src/agents/planning-agent/index.ts)
  - execute(query: string): Promise<ResearchPlan>
    - High-level entrypoint. Runs the entire planning pipeline and returns a ResearchPlan.
  - generateComprehensivePlan(...) : Promise<ResearchPlan>
    - Wraps a Genkit prompt to produce the final plan. Validates/massages outputs into canonical shapes.

- QueryAnalyzer (src/agents/planning-agent/query-analyzer.ts)
  - analyzeQuery(query: string)
    - Returns coreQuestion, scopeDimensions, knowledgeGaps, stakeholderNeeds, researchDimensions, complexity, estimatedScope.

- MethodologySelector (src/agents/planning-agent/methodology-selector.ts)
  - selectMethodology(queryAnalysis, topic)
    - Chooses approach (systematic, exploratory, comparative, case-study), defines phases and quality controls.

- StepDecomposer (src/agents/planning-agent/step-decomposer.ts)
  - decomposeIntoSteps(topic, methodology, dataSources, researchDimensions, estimatedScope)
    - Produces an ordered list of ResearchStep objects, assigns agentType (web-research, academic-research, news-research, data-analysis), dependencies, estimatedDuration, successCriteria, fallbackStrategies and priority.
  - optimizeForParallelExecution(steps)
    - Groups steps that can run in parallel, estimates total time and critical path.

- RiskAssessor (src/agents/planning-agent/risk-assessor.ts)
  - assessRisks(topic, dataSources, executionSteps, estimatedTimeline, methodology)
    - Returns risks and contingencyPlans. Covers availability, API limits, time, credibility, technical failures.

- ContingencyPlanner (src/agents/planning-agent/contingency-planner.ts)
  - createContingencyPlans(risks, dataSources, executionSteps, topic)
    - Generates fallback strategies for each risk and general contingency plans; deduplicates and merges similar plans.

Key data shapes (high level)
----------------------------

- ResearchPlan (canonicalized by generateComprehensivePlan)
  - id, topic, objectives[], methodology, dataSources[], executionSteps[], riskAssessment[], contingencyPlans[], qualityThresholds[], estimatedTimeline, createdAt, updatedAt

- ResearchStep
  - id, description, agentType, dependencies[], estimatedDuration, priority, successCriteria, fallbackStrategies

Design and architecture notes
-----------------------------

- Pipeline is composed and synchronous within a single agent process: QueryAnalyzer -> MethodologySelector -> DataSourceIdentifier -> StepDecomposer -> RiskAssessor -> ContingencyPlanner -> Genkit prompt.
- The final plan generation delegates human-friendly synthesis and timeline estimation to Genkit but the agent normalizes outputs to the typed ResearchPlan interface to preserve internal invariants.
- Subcomponents are intentionally small and unit-testable. Core heuristic functions (e.g., calculateStepDuration, calculateStepPriority, calculateDataAvailabilityRisk) are encapsulated inside StepDecomposer and RiskAssessor.

Important implementation details
--------------------------------

- Genkit usage
  - `src/agents/planning-agent/genkit.ts` creates an `ai` instance using the googleAI plugin and `gemini-2.5-flash` model. The Planning Agent loads prompts from its directory via genkit's promptDir.
  - `generateComprehensivePlan` wraps a Genkit-defined prompt (`comprehensive-research-planning`) with explicit Zod input/output shapes. The agent further massages the result into the ResearchPlan shape and provides sensible defaults where fields are missing.

- Type normalization and defensive coding
  - Many helper functions normalize loose or untyped results (e.g., raw dataSources may be strings or objects). The planner explicitly narrows/validates types and applies defaults for missing fields (priority mapping, credibilityWeight defaults).

- Heuristics and constants
  - Duration and priority calculations are heuristic-based (e.g., baseDuration adjustments per sourceType and methodology, square-root scaling by number of sources).
  - Risk thresholds (credibility < 0.7) and buffer heuristics (30% buffer for affected steps) are embedded in RiskAssessor/ContingencyPlanner and can be tuned centrally.

Error handling and observability
--------------------------------

- The ResearchPlanner.catch wraps the entire pipeline and throws a descriptive Error on failure. Logs are emitted (console.log/console.error) at key pipeline steps for debugging.
- When Genkit outputs are malformed, the agent provides fallbacks (default methodology, default dataSource mapping) to avoid crashing the pipeline. This keeps the planner robust but may surface reduced plan fidelity — these cases should be surfaced to monitoring.

Testing guidance
----------------

- Unit tests to add (recommended):
  - QueryAnalyzer: test analyzeQuery on a variety of queries (simple, comparative, temporal, technical). Assert extracted coreQuestion and dimensions.
  - MethodologySelector: verify approach selection for edge cases (expert-level, comparative scope, narrow case-study scenarios).
  - StepDecomposer: test creation of preparation/research/analysis/validation steps and priority/duration calculations for varied inputs.
  - RiskAssessor: create synthetic lists of dataSources and steps to validate the risk types generated and mitigation suggestions.
  - ContingencyPlanner: verify deduplication and merging behaviors, and that generated plans include triggerCondition and fallbackStrategy.
  - generateComprehensivePlan: mock the Genkit prompt to return minimal output and verify the normalization logic produces a valid ResearchPlan.

- Where to put tests: follow existing convention under `src/agents/planning-agent/__tests__/` using Vitest. Compare with `src/agents/orchestrator-agent/__tests__/orchestrator.spec.ts` for examples.

Usage examples
--------------

- Basic programmatic usage:

  const planner = new ResearchPlanner();
  const plan = await planner.execute('What is the impact of remote work on software developer productivity?');

  // plan.executionSteps -> array of ResearchStep with agentType assignments like 'web-research', 'data-analysis'

Integration notes
-----------------

- The Orchestrator agent expects the Planning Agent to produce ResearchPlan.executionSteps with agentType values that match registered agent names (e.g., 'web-research', 'academic-research', 'news-research', 'data-analysis'). Keep agent-type strings in sync across agents and the orchestrator's TaskDelegator.
- The Planning Agent's Genkit prompt lives in the same directory and may be edited to tune plan wording or to add extra output fields. Any change in prompt output shape should be reflected in `generateComprehensivePlan`'s normalization.

Extensibility
-------------

- Add new research dimensions or agent types by:
  1. Extending `QueryAnalyzer.extractResearchDimensions` to detect new keywords.

 2. Updating `StepDecomposer.mapSourceTypeToAgent` and its mapping rules.
 3. Adding heuristics for duration/priority where appropriate.

- Replace or augment Genkit with additional rule-based post-processing if stricter guarantees are required before the orchestrator accepts a plan (for example, verifying that each ResearchStep has agentType in a allow-list).

Files referenced
----------------

- [index.ts](../../src/agents/planning-agent/index.ts) — ResearchPlanner and generateComprehensivePlan
- [genkit.ts](../../src/agents/planning-agent/genkit.ts) — ai instance configuration
- [query-analyzer.ts](../../src/agents/planning-agent/query-analyzer.ts) — query parsing heuristics
- [methodology-selector.ts](../../src/agents/planning-agent/methodology-selector.ts) — methodology heuristics
- [step-decomposer.ts](../../src/agents/planning-agent/step-decomposer.ts) — step creation and parallelization helpers
- [risk-assessor.ts](../../src/agents/planning-agent/risk-assessor.ts) — risk detection and mitigation
- [contingency-planner.ts](../../src/agents/planning-agent/contingency-planner.ts) — contingency merging and optimization

Next steps and suggestions
---------------------------

- Add unit tests for all subcomponents and a mocked-genkit integration test for `generateComprehensivePlan`.
- Centralize tunable constants (thresholds, multipliers) into a small config module so behavior can be adjusted without editing heuristics in many places.
- Add telemetry hooks (metrics for plan length, number of steps, average estimatedDuration) so the orchestrator can monitor planning performance.

Contact
-------
For questions about the planning heuristics or to propose changes, review commit history for the planning-agent files and coordinate with the maintainers listed in the repository's README.

---
Generated by GitHub Copilot (assistant) from source files in `src/agents/planning-agent/`.

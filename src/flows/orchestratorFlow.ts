import { ai } from '../config.js';
import { z } from 'genkit';
import { v4 as uuidv4 } from 'uuid';
import type { TaskRequest, TaskResponse } from '../agents/shared/interfaces.js';

export const orchestratorFlow = ai.defineFlow(
  {
    name: 'orchestratorFlow',
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ planId: z.string() }),
  },
  async ({ query }) => {
    // Real A2A delegation: send a TaskRequest to the Orchestrator Agent HTTP endpoint.
    const orchestratorUrl = process.env.ORCHESTRATOR_AGENT_URL ?? 'http://localhost:41243';

    const taskId = `task-${uuidv4()}`;
    const taskRequest: TaskRequest = {
      taskId,
      type: 'orchestration',
      parameters: { query },
      priority: 1,
      timeout: 5 * 60 * 1000, // 5 minutes
      metadata: { source: 'orchestratorFlow' },
      // For orchestration, include a minimal step object so agent can use it if needed
      step: {
        id: `step-${taskId}`,
        description: `Orchestrate research for query: ${query}`,
        agentType: 'orchestrator',
        dependencies: [],
        estimatedDuration: 5,
        successCriteria: 'Plan generated',
        fallbackStrategies: [],
        priority: 1,
      },
    } as TaskRequest;

    const res = await fetch(`${orchestratorUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskRequest),
    });

    if (!res.ok) {
      throw new Error(`Failed to delegate to orchestrator agent: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as TaskResponse;

    // Validate TaskResponse shape
    if (typeof json.taskId !== 'string') {
      throw new Error('Orchestrator agent returned invalid TaskResponse');
    }

    // Use the agent's taskId as the planId to correlate
    return { planId: json.taskId };
  }
);

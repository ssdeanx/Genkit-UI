# Firebase Functions - Agents

This directory contains the source code for deploying the Genkit agents and flows as Firebase Functions. The `index.ts` file in this directory is the entry point for the functions that will be deployed.

Each agent is defined in the `src/agents` directory and is wrapped in an Express server. The `functions/src/index.ts` file imports these agents and exposes them as callable functions.

For more information on the overall agent architecture, see the root [AGENTS.md](../AGENTS.md) file.

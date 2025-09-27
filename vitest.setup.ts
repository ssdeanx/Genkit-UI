/* eslint-disable no-console */
// Ensure test env is set
process.env.NODE_ENV = 'test';

// Silence console error noise from tests unless explicitly asserted
const origError = console.error;
console.error = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.includes('[OrchestratorAgentExecutor]')) {
    return;
  }
  origError(...args);
};

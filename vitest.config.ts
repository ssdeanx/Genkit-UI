import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: [
      'functions/**',
      'node_modules/**',
      'dist/**',
      'lib/**',
      // common generated or cache dirs
      '.genkit/**',
      '.next/**',
      'coverage/**',
    ],
    globals: true,
    reporters: [
      'default',
      ['json', { outputFile: 'tests/test-results.json' }],
    ],
    // Increase timeouts for flows/tools that may perform async work
    testTimeout: 20000,
    hookTimeout: 20000,
    // Run in Node worker threads (default), explicit for clarity
    pool: 'threads',
    coverage: {
      enabled: true,
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/index.ts', 'src/**/*.d.ts', 'src/**/index.ts'],
      all: false,
      provider: 'v8',
      thresholds: {
        lines: 0.6,
        functions: 0.6,
        branches: 0.5,
        statements: 0.6,
      },
    },
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ['vitest.setup.ts'],
  },
});

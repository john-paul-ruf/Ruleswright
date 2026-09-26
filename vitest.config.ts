import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // D4 — node env locally; the browser determinism leg is a v1.1 follow-up (tracked in ci.yml's header, README says so)
    include: ['tests/**/*.test.ts'],
    coverage: {
      // Measured coverage (FR-2's validator, the engine, and the compiler are the
      // product; tests, scripts, and config are not). v8 provider via the
      // installed @vitest/coverage-v8. `pnpm test --coverage` prints the summary.
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text-summary'],
    },
  },
});

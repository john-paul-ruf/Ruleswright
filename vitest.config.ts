import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node env here. The browser determinism leg runs from vitest.browser.config.ts
    // (`pnpm test:browser`); its file uses global WebCrypto, which Node 18 lacks.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'tests/browser/**'],
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

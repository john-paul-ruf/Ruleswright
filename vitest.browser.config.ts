import { defineConfig } from 'vitest/config';

// Browser determinism leg (FR-1, NFR-Determinism). One engine per run: `--browser.name=chromium|firefox|webkit`.
export default defineConfig({
  test: {
    include: [
      'tests/browser/**/*.test.ts',
      'tests/core/rng.test.ts',
      'tests/core/dice.test.ts',
      'tests/core/tables.test.ts',
      'tests/schema/version.test.ts',
      'tests/compiler/themes.test.ts',
    ],
    browser: {
      enabled: true,
      provider: 'playwright',
      name: 'chromium',
      headless: true,
      // A failing test must not write PNGs into tests/**/__screenshots__/.
      screenshotFailures: false,
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // D4 — node env locally; the browser determinism leg is a v1.1 follow-up (tracked in ci.yml's header, README says so)
    include: ['tests/**/*.test.ts'],
  },
});
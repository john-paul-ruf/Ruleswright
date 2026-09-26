import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // D4 — the browser determinism matrix is CI's job (S08)
    include: ['tests/**/*.test.ts'],
  },
});
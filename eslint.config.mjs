/**
 * ESLint flat config (eslint 10). Two layers:
 *
 * 1. Base TypeScript hygiene for everything tsconfig covers (src/ + tests/).
 * 2. The engine security posture, applied to `src/**` only — the bans that keep
 *    the engine's determinism and no-codegen guarantees enforceable by lint,
 *    not just by review. `scripts/check-security-lint.mjs` re-sweeps the same
 *    constructs over the built `dist/` in CI; ESLint rules guard the sources,
 *    the sweep guards the artifact.
 */
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'program/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2020 },
    },
  },
  {
    // Node scripts run under plain node, not tsconfig — declare their globals.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    // The engine path: no ambient entropy, no ambient clock, no dynamic code
    // execution — ever. All randomness flows through core/rng.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'no ambient randomness — route all entropy through core/rng (Rng).',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'no ambient clock in engine code.',
        },
        {
          object: 'global',
          property: 'eval',
          message: 'no dynamic code execution.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Function']",
          message: 'no `new Function` — DSLs are AST-interpreted, never codegen.',
        },
        {
          selector: "Identifier[name='eval']",
          message: 'no direct `eval`.',
        },
        {
          selector: 'ImportExpression',
          message: 'no data-driven dynamic imports.',
        },
      ],
    },
  },
);

/** ESLint 8 flat-of-its-time (.eslintrc.cjs): engine hygiene rules that keep FR-1/NFR-Security true. */
module.exports = {
  root: true,
  env: {
    es2020: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/', 'node_modules/', 'program/', 'coverage/'],
  overrides: [
    {
      // The engine path: no ambient entropy, no ambient clock, no dynamic code execution —
      // ever (FR-1, NFR-Security). All randomness flows through core/rng.
      files: ['src/**/*.ts'],
      rules: {
        'no-restricted-properties': [
          'error',
          {
            object: 'Math',
            property: 'random',
            message: 'FR-1: no ambient randomness — route all entropy through core/rng (Rng).',
          },
          {
            object: 'Date',
            property: 'now',
            message: 'NFR-Determinism: no ambient clock in engine code.',
          },
          {
            object: 'global',
            property: 'eval',
            message: 'NFR-Security: no dynamic code execution.',
          },
        ],
        'no-restricted-syntax': [
          'error',
          {
            selector: "NewExpression[callee.name='Function']",
            message: 'NFR-Security: no `new Function` — DSLs are AST-interpreted, never codegen.',
          },
          {
            selector: "Identifier[name='eval']",
            message: 'NFR-Security: no direct `eval`.',
          },
          {
            selector: 'ImportExpression',
            message: 'NFR-Security: no data-driven dynamic imports.',
          },
        ],
      },
    },
  ],
};
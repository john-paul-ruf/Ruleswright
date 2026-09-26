/**
 * Build config (M05, S08): per-entry dual-format builds. Four entries — the
 * three subpath surfaces plus the dumb root re-export — each emitting ESM (.mjs)
 * + CJS (.cjs) + rolled dts, target es2020 (Node 18 floor + evergreen browsers),
 * side-effect-free for tree-shaking (FR-22).
 *
 * The runtime-only bundle is a proof, not a promise: scripts/check-runtime-isolation.mjs
 * greps this output for the compiler's `generateCampaign` string (packaging.html's check).
 */
import { defineConfig } from 'tsup';

const shared = {
  target: 'es2020',
  splitting: false,
  treeshake: true,
  sourcemap: true,
  keepNames: true,
};

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
  },
  {
    ...shared,
    entry: { schema: 'src/schema/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
  },
  {
    ...shared,
    entry: { runtime: 'src/runtime/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
  },
  {
    ...shared,
    entry: { compiler: 'src/compiler/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
  },
]);
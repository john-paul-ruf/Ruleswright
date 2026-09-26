/**
 * Bundle-isolation proof (FR-22, packaging.html's check): the runtime-only
 * bundle is a proof, not a promise. Greps the built runtime entries for the
 * compiler's `generateCampaign` string and fails CI if it appears — a runtime
 * consumer ships none of the generator.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const RUNTIME_STEMS = ['runtime.js', 'runtime.cjs'];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const missing = RUNTIME_STEMS.filter((name) => !exists(join(DIST, name)));
if (missing.length > 0) {
  fail(`dist/ is missing the runtime bundle(s): ${missing.join(', ')} — run \`pnpm build\` first.`);
}

const FORBIDDEN = 'generateCampaign';
for (const name of RUNTIME_STEMS) {
  const source = readFileSync(join(DIST, name), 'utf8');
  if (source.includes(FORBIDDEN)) {
    fail(`the string "${FORBIDDEN}" appears in ${name} — the runtime surface imports generator code (FR-22).`);
  }
  console.log(`✓ ${name}: "${FORBIDDEN}" absent`);
}

const distFiles = readdirSync(DIST);
const hasEsm = distFiles.some((name) => name.endsWith('.js') || name.endsWith('.mjs'));
const hasCjs = distFiles.some((name) => name.endsWith('.cjs'));
const hasDts = distFiles.some((name) => name.endsWith('.d.ts') || name.endsWith('.d.cts'));
if (!hasEsm || !hasCjs || !hasDts) {
  fail(`dist/ must emit dual ESM/CJS with dts — got ESM:${hasEsm} CJS:${hasCjs} dts:${hasDts}.`);
}
console.log(`✓ dist/ emits dual ESM/CJS with dts (${distFiles.length} files)`);

function exists(path) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}
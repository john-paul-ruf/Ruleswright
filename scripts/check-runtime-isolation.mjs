/**
 * Bundle-isolation proof (FR-22, packaging.html's check): the runtime-only
 * bundle is a proof, not a promise. Greps the built runtime entries for the
 * compiler's generator symbols and fails CI if either appears — a runtime
 * consumer ships none of the generator.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--fixture-dir' || !isAbsolute(args[1])))
  fail('Usage: check-runtime-isolation.mjs [--fixture-dir <absolute-directory>]');
const DIST = args[1] ?? 'dist';
const RUNTIME_STEMS = ['runtime.js', 'runtime.cjs'];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const required = [...RUNTIME_STEMS, 'runtime.d.ts', 'runtime.d.cts'];
const missing = required.filter((name) => !exists(join(DIST, name)));
if (missing.length > 0) {
  fail(`${DIST} is missing required runtime output(s): ${missing.join(', ')} — run \`pnpm build\` first.`);
}

const FORBIDDEN = ['generateCampaign', 'generateAdventure'];
for (const name of RUNTIME_STEMS) {
  const source = readFileSync(join(DIST, name), 'utf8');
  for (const symbol of FORBIDDEN) {
    if (source.includes(symbol))
      fail(`the string "${symbol}" appears in ${name} — the runtime surface imports generator code (FR-22).`);
    console.log(`✓ ${name}: "${symbol}" absent`);
  }
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

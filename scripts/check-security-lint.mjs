/**
 * The security-lint belt (NFR-Security): a mechanical sweep over `src/` and
 * `dist/` for dynamic code execution and ambient entropy — `eval(`, `new
 * Function`, `Math.random`, `Date.now`. CI-invocable so the posture holds
 * against the built artifact, not just the sources (the ESLint rules on
 * `src/**` are the suspenders; this is the belt over both layers).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src', 'dist'];
const SCAN_SUFFIXES = /\.(ts|js|mjs|cjs)$/;
const DTS_SUFFIX = /\.d\.[cm]?ts$/;

const BANNED = [
  { pattern: /\beval\s*\(/, label: 'eval(…)' },
  { pattern: /\bnew\s+Function\s*\(/, label: 'new Function(…)' },
  { pattern: /Math\.random\s*\(/, label: 'Math.random()' },
  { pattern: /Date\.now\s*\(/, label: 'Date.now()' },
];

const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!SCAN_SUFFIXES.test(entry) || DTS_SUFFIX.test(entry)) continue;
    const source = readFileSync(path, 'utf8');
    for (const { pattern, label } of BANNED) {
      if (pattern.test(source)) {
        offenders.push(`${path}: ${label}`);
      }
    }
  }
}

for (const root of ROOTS) {
  try {
    walk(root);
  } catch {
    // an absent root (e.g. dist before the first build) has nothing to sweep
  }
}

if (offenders.length > 0) {
  console.error('✗ security sweep found banned constructs:');
  for (const line of offenders) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`✓ security sweep clean: no eval/new Function/Math.random/Date.now in src/ + dist/`);
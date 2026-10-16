/** A failing child must propagate a nonzero status; all artifacts are isolated fixtures. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const gate = fileURLToPath(new URL('../../scripts/check-runtime-isolation.mjs', import.meta.url));
const artifacts = ['runtime.js', 'runtime.cjs', 'runtime.d.ts', 'runtime.d.cts'];
function runFixture(edit: (directory: string) => void = () => {}) {
  const directory = mkdtempSync(join(tmpdir(), 'ruleswright-isolation-'));
  try {
    for (const name of artifacts) writeFileSync(join(directory, name), '/* clean runtime artifact */');
    edit(directory);
    const result = spawnSync(process.execPath, [gate, '--fixture-dir', directory], {
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('runtime isolation gate behavioral controls', () => {
  it('accepts complete clean ESM/CJS/declaration outputs', () => {
    const result = runFixture();
    expect(result.status).toBe(0);
    expect(result.output).toContain('generateCampaign');
    expect(result.output).toContain('generateAdventure');
    expect(result.output).toContain('dual ESM/CJS with dts');
  });
  it.each(artifacts)('rejects missing %s with a real child-process failure', (name) => {
    const result = runFixture((dir) => rmSync(join(dir, name)));
    expect(result.status).toBe(1);
    expect(result.output).toContain(`missing required runtime output(s): ${name}`);
  });
  it.each(
    ['runtime.js', 'runtime.cjs'].flatMap((name) =>
      ['generateCampaign', 'generateAdventure'].map((symbol) => [name, symbol] as const),
    ),
  )('rejects %s containing %s', (name, symbol) => {
    const result = runFixture((dir) => writeFileSync(join(dir, name), `function ${symbol}() {}`));
    expect(result.status).toBe(1);
    expect(result.output).toContain(`"${symbol}" appears in ${name}`);
  });
  it('rejects implicit or relative fixture overrides', () => {
    const result = spawnSync(process.execPath, [gate, '--fixture-dir', 'dist'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage:');
  });
});
